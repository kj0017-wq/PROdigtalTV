import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { initializeApp, applicationDefault, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Read-only audit using the application's current list and recipient functions.
const app = initializeApp({ credential: applicationDefault(), projectId: "prodigitaltv-da47b" });
const db = getFirestore(app);
const deadline = setTimeout(() => { console.error("Audit timed out; no data changed."); process.exit(1); }, 45000);
try {
  const snapshots = await Promise.all(["members", "users", "contacts"].map((name) => db.collection(name).get()));
  const [members, users, contacts] = snapshots.map((snapshot) => snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id })));
  const testGroupSnapshot = await db.collection("settings").doc("notificationTestGroup").get();
  const cms = await readFile(new URL("../src/cms/cmsPages.js", import.meta.url), "utf8");
  const backend = await readFile(new URL("../functions/index.js", import.meta.url), "utf8");
  function extract(source, name) {
    const start = source.indexOf(`function ${name}(`);
    if (start < 0) throw new Error(`Function missing: ${name}`);
    const end = source.indexOf("\n}", start);
    if (end < 0) throw new Error(`Function end missing: ${name}`);
    return source.slice(start, end + 2);
  }
  const context = vm.createContext({ members, users, contacts, clean: (value = "") => String(value || "").trim() });
  for (const name of ["userIsActive", "peopleContactType", "peopleMailingDisabled", "peopleMemberEmails", "peopleMemberIsActive", "peopleMemberContactRows", "peopleUserContactRows", "mergePeopleContactsAndMembers"]) {
    vm.runInContext(extract(cms, name), context);
  }
  for (const name of ["normalizedMemberEmails", "memberCanMatchRegistration", "memberIsNotificationTestGroup", "memberIsMailingEligible", "notificationTestGroupTargets", "eventNotificationTargets"]) {
    vm.runInContext(`${["eventNotificationTargets", "notificationTestGroupTargets"].includes(name) ? "async " : ""}${extract(backend, name)}`, context);
  }
  const dataByCollection = { members, users, contacts };
  context.db = { collection(name) { return { doc() { return { async get() { return testGroupSnapshot; } }; }, async get() { return { docs: (dataByCollection[name] || []).map((record) => ({ id: record.id, data: () => record })) }; } }; } };
  context.HttpsError = class extends Error { constructor(code, message) { super(message); this.code = code; } };
  context.registrationIsActive = () => true;
  const rows = vm.runInContext("mergePeopleContactsAndMembers(contacts, members, users)", context);
  const targets = await vm.runInContext('eventNotificationTargets("", { recipientGroup: "members" })', context);
  const testTargets = await vm.runInContext('eventNotificationTargets("", { recipientGroup: "test_group", includeMembers: true, includeContacts: true })', context).catch((error) => ({ error: error.message }));
  const emailOf = (record) => String(record.email || record.contactEmail || record.primaryEmail || "").trim().toLowerCase();
  const valid = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const byEmail = new Map();
  rows.forEach((row) => { const email = emailOf(row); byEmail.set(email, [...(byEmail.get(email) || []), row]); });
  const targetEmails = new Set(targets.map(emailOf));
  const active = members.filter((member) => !["archived", "deleted", "inactive", "cancelled"].includes(String(member.status || "active").toLowerCase()) && !["inactive", "cancelled"].includes(String(member.membershipAccessStatus || "active").toLowerCase()));
  function expectedEmails(member) {
    return [...new Set([
      ...context.normalizedMemberEmails(member), member.primaryEmail,
      ...(member.eventContacts || []).map((contact) => contact.contactEmail),
      ...users.filter((user) => user.memberId === member.id && context.userIsActive(user)).map(emailOf)
    ].filter(Boolean).map((email) => String(email).trim().toLowerCase()))];
  }
  const checks = active.map((member) => {
    const emails = expectedEmails(member);
    const present = emails.filter((email) => byEmail.has(email));
    const wrongLabels = present.filter((email) => byEmail.get(email).some((row) => context.peopleContactType(row) !== "member"));
    return {
      member: member.name || member.company || member.id, id: member.id,
      emails, present, missing: emails.filter((email) => !byEmail.has(email)), wrongLabels,
      notInMemberDelivery: emails.filter((email) => !targetEmails.has(email)),
      optOut: member.notificationOptOut === true || member.mailingDisabled === true || member.reminderConsent === false
    };
  });
  const optOutDisplayMismatch = rows.filter((row) => {
    const email = emailOf(row);
    return !context.peopleMailingDisabled(row) && [...members.filter((member) => expectedEmails(member).includes(email)), ...users.filter((user) => emailOf(user) === email), ...contacts.filter((contact) => emailOf(contact) === email)]
      .some((record) => record.notificationOptOut === true || record.mailingDisabled === true || record.reminderConsent === false);
  }).map((row) => ({ email: emailOf(row), type: context.peopleContactType(row), deliveredToMembers: targetEmails.has(emailOf(row)) }));
  console.log(JSON.stringify({
    checkedAt: new Date().toISOString(), counts: { members: members.length, activeMembers: active.length, users: users.length, contacts: contacts.length, mailingRows: rows.length, memberLabeledRows: rows.filter((row) => context.peopleContactType(row) === "member").length, memberDeliveryRecipients: targets.length, activeMembersWithAnyMailingRow: checks.filter((item) => item.present.length).length, activeMembersWithAllEmails: checks.filter((item) => item.emails.length && !item.missing.length).length },
    testGroupRecipients: testTargets,
    legacyTestSelection: members.filter((member) => member.notificationTestGroup || member.isNotificationTestGroup || member.testGroup || member.notificationTester).map((member) => ({ name: member.name || member.id, status: member.status || "", access: member.membershipAccessStatus || "", emails: context.normalizedMemberEmails(member), selected: context.memberIsNotificationTestGroup(member) })),
    activeMemberEmailCount: new Set(checks.flatMap((item) => item.emails)).size,
    wrongLabelCount: new Set(checks.flatMap((item) => item.wrongLabels)).size,
    inactiveMemberStatuses: members.filter((member) => !active.includes(member)).map((member) => ({ name: member.name || member.id, status: member.status || "", access: member.membershipAccessStatus || "" })),
    deliveryOutsideActiveMembers: targets.filter((target) => !checks.some((item) => item.emails.includes(emailOf(target)))).map((target) => ({ email: emailOf(target), memberId: target.memberId || "" })),
    missingEntirely: checks.filter((item) => !item.present.length),
    missingEmails: checks.filter((item) => item.missing.length && item.present.length),
    wrongLabels: checks.filter((item) => item.wrongLabels.length),
    excludedFromDelivery: checks.filter((item) => item.notInMemberDelivery.length),
    optOutDisplayMismatch,
    duplicateEmails: [...byEmail].filter(([email, items]) => email && items.length > 1).map(([email, items]) => ({ email, count: items.length, types: items.map((row) => context.peopleContactType(row)) })),
    invalidEmails: [...new Set(checks.flatMap((item) => item.emails).filter((email) => !valid(email)))],
    unlinkedMemberContacts: contacts.filter((contact) => context.peopleContactType(contact) === "member" && !checks.some((item) => item.emails.includes(emailOf(contact)))).map((contact) => ({ email: emailOf(contact), company: contact.company || "", memberId: contact.memberId || "", status: contact.status || "" }))
  }, null, 2));
} finally {
  clearTimeout(deadline);
  await db.terminate();
  await deleteApp(app);
}
