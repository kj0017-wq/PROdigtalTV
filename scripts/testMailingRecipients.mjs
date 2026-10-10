import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const backend = await readFile(new URL("../functions/index.js", import.meta.url), "utf8");
const cms = await readFile(new URL("../src/cms/cmsPages.js", import.meta.url), "utf8");
const context = vm.createContext({ clean: (value = "") => String(value || "").trim(), registrationIsActive: () => true,
  HttpsError: class extends Error { constructor(code, message) { super(message); this.code = code; } }
});
function load(source, names) {
  for (const name of names) {
    const start = source.indexOf(`function ${name}(`);
    assert.ok(start >= 0, name);
    const end = source.indexOf("\n}", start);
    const prefix = source.slice(start - 6, start) === "async " ? "async " : "";
    vm.runInContext(prefix + source.slice(start, end + 2), context);
  }
}
load(backend, ["mailingExcludedEmails", "mailingEmailIsExcluded", "notificationRegisteredEmails", "notificationPersonNames", "assertNotificationRecipientNames", "normalizedMemberPhones", "normalizedMemberEmails", "memberCanMatchRegistration", "memberIsNotificationTestGroup", "memberIsMailingEligible", "notificationTestGroupTargets", "eventNotificationTargets"]);
context.phoneNumber = (value = "") => String(value || "").trim();
load(cms, ["userIsActive", "peopleContactType", "peopleMailingDisabled", "peopleMemberEmails", "peopleMemberIsActive", "peopleExistingNames", "peopleMemberContactRows", "peopleUserContactRows", "mergePeopleContactsAndMembers"]);
const members = [
  { id: "one", email: "one@example.com", firstName: "Jürgen", lastName: "Sewczyk", notificationTestGroup: true },
  { id: "two", email: "two@example.com", notificationTestGroup: true },
  { id: "three", email: "three@example.com", notificationTestGroup: true },
  { id: "other", email: "other@example.com" },
  { id: "removed", email: "removed@example.com", notificationTestGroup: false, testGroup: true },
  { id: "cancelled", email: "cancelled@example.com", status: "active", membershipAccessStatus: "cancelled", notificationTestGroup: true }
];
const users = [
  { id: "linked", email: "linked@example.com", memberId: "other", role: "admin" },
  { id: "nameless", email: "one@example.com", memberId: "one", role: "member" },
  { id: "unlinked", email: "unlinked@example.com", role: "member" },
  { id: "old", email: "old@example.com", memberId: "cancelled", role: "member" }
];
const contacts = [{ id: "contact", email: "one@example.com", type: "contact", newsletterAllowed: false, notificationOptOut: true }];
let saved = null;
context.db = { collection(name) { return {
  doc(id) { return {
    async get() { return { exists: saved !== null, data: () => saved }; },
    async set(value) { assert.equal(name, "settings"); assert.equal(id, "notificationTestGroup"); saved = value; }
  }; },
  async get() { return { docs: ({ members, users, contacts }[name] || []).map((record) => ({ id: record.id, data: () => record })) }; }
}; } };
const emails = (targets) => Array.from(targets, (target) => target.email).sort();
const group = () => context.eventNotificationTargets("", { recipientGroup: "test_group", includeMembers: true, includeContacts: true, includeRegistered: true, includeSpeakers: true });
assert.deepEqual(emails(await group()), ["one@example.com", "three@example.com", "two@example.com"], "Legacy group must exclude unrelated users and cancelled members");
saved = { emails: ["new@example.com", " ONE@example.com ", "new@example.com"] };
assert.deepEqual(emails(await group()), ["new@example.com", "one@example.com"], "Saved addresses are authoritative and deduplicated");
saved = { emails: [] };
await assert.rejects(group, /gueltige Adresse/, "An empty group must never fall back to all members");
saved = { emails: ["invalid"] };
await assert.rejects(group, /gueltige Adresse/);
saved = {};
await assert.rejects(group, /ungueltig/);
saved = { emails: ["one@example.com"] };
const namedGroup = await group();
assert.equal(namedGroup[0].firstName, "Jürgen", "Test recipients must preserve names");
const namedTargets = await context.eventNotificationTargets("", { recipientGroup: "members" });
const named = namedTargets.find((target) => target.email === "one@example.com");
assert.equal(named.firstName, "Jürgen", "An empty login name must not erase member names");
assert.equal(named.lastName, "Sewczyk");
assert.equal(context.notificationPersonNames({ displayName: "Herr Jürgen Sewczyk" }).lastName, "Sewczyk");
assert.equal(context.notificationPersonNames({ name: "JS Consult" }, "member").displayName, "", "Company names are not personal names");
assert.throws(() => context.assertNotificationRecipientNames({ shortText: "Sehr geehrte/r {{firstName}} {{lastName}}," }, [{ email: "unknown@example.com" }]), /Namensdaten/);
assert.doesNotThrow(() => context.assertNotificationRecipientNames({ shortText: "Guten Tag {{firstName}} {{lastName}}," }, [named]));
const targets = emails(await context.eventNotificationTargets("", { recipientGroup: "members" }));
assert.ok(targets.includes("linked@example.com"));
assert.ok(!targets.includes("cancelled@example.com"));
assert.ok(!targets.includes("old@example.com"));
assert.ok(!targets.includes("unlinked@example.com"));
const rows = context.mergePeopleContactsAndMembers(contacts, members, users);
const matched = rows.find((row) => row.email === "one@example.com");
assert.equal(matched.type, "member");
assert.equal(matched.memberId, "one");
assert.equal(matched.newsletterAllowed, false);
assert.equal(matched.notificationOptOut, true);
assert.equal(rows.filter((row) => row.email === "one@example.com").length, 1);
assert.equal(contacts[0].type, "contact", "Rendering must not mutate stored contact records");
context.exports = {};
context.onCall = (_, handler) => handler;
context.region = "test";
context.requireEditor = async (request) => {
  if (!request.auth) throw new Error("unauthorized");
  return { email: "editor@example.com" };
};
context.FieldValue = { serverTimestamp: () => "test-timestamp" };
vm.runInContext(backend.slice(backend.indexOf("exports.saveNotificationTestGroup ="), backend.indexOf("exports.createEventNotification =")), context);
const save = (values, auth = { uid: "editor" }) => context.exports.saveNotificationTestGroup({ data: { emails: values }, auth });
await assert.rejects(() => save(["new@example.com"], null), /unauthorized/);
await assert.rejects(() => save(["invalid"]), /gueltige/);
await save([" ADDED@example.com ", "added@example.com", "one@example.com"]);
assert.deepEqual(emails(await group()), ["added@example.com", "one@example.com"], "Saving and reloading must keep new recipients");
assert.equal(saved.updatedBy, "editor@example.com");
await save([]);
await assert.rejects(group, /gueltige Adresse/, "Clearing the saved selection must not restore legacy test members");
const aliasMembers = [{ id: "house", email: "dirk@company.example", firstName: "Dirk", lastName: "Martens", eventContacts: [{ firstName: "Dirk", lastName: "Martens", email: "dirk.alt@company.example" }, { firstName: "Anna", lastName: "Other", email: "anna@company.example" }] }];
const aliasUsers = [{ id: "dirk", email: "dirk@association.example", memberId: "house" }];
const aliasRegistrations = [{ email: "dirk@association.example", firstName: "Dirk", lastName: "Martens", status: "checked_in" }];
const registeredAliases = context.notificationRegisteredEmails(aliasRegistrations, aliasMembers, aliasUsers);
assert.ok(registeredAliases.has("dirk@company.example"), "Member address must be recognised through linked login");
assert.ok(registeredAliases.has("dirk.alt@company.example"), "Same person's event contact address must be recognised");
assert.ok(!registeredAliases.has("anna@company.example"), "Other people at the company must remain eligible");
const unrelatedAliases = context.notificationRegisteredEmails([{ email: "unrelated@example.com", firstName: "Dirk", lastName: "Martens" }], aliasMembers, aliasUsers);
assert.ok(!unrelatedAliases.has("dirk@company.example"), "Names alone must not connect unrelated records");
context.mailAddress = (value = "") => String(value || "").trim();
context.compactNameParts = (person) => [person.firstName, person.lastName].filter(Boolean).join(" ") || person.name || "";
context.notificationExtraSpeakerEventIds = () => [];
const aliasData = { members: aliasMembers, users: aliasUsers, contacts: [{ id: "dirk-contact", email: "dirk@company.example", firstName: "Dirk", lastName: "Martens" }, { id: "anna-contact", email: "anna@company.example", firstName: "Anna", lastName: "Other" }], registrations: aliasRegistrations, speakers: [{ id: "dirk-speaker", email: "dirk@company.example", firstName: "Dirk", lastName: "Martens" }], topics: [] };
context.db = { collection(name) { const query = { where() { return query; }, async get() { return { docs: (aliasData[name] || []).map((record, index) => ({ id: record.id || String(index), data: () => record })) }; }, doc(id) { return { async get() { return { id, exists: true, data: () => ({ date: "2026-10-23", speakerIds: ["dirk-speaker"] }) }; } }; } }; return query; } };
const invitationTargets = await context.eventNotificationTargets("heuking", { recipientGroup: "contacts", includeSpeakers: true, registrationStatus: "unregistered" });
assert.deepEqual(emails(invitationTargets), ["anna@company.example"], "Checked-in aliases and speakers must be excluded, without excluding coworkers or adding members");
const participantTargets = await context.eventNotificationTargets("heuking", { recipientGroup: "contacts", registrationStatus: "registered" });
assert.deepEqual(emails(participantTargets), ["dirk@company.example"], "Participant information must still reach registered aliases");
console.log("Mailing recipient regression checks passed; no network calls or messages.");

const single = await context.eventNotificationTargets('heuking',{recipientGroup:'single_person',singleRecipientEmail:' ANNA@company.example ',includeMembers:true,includeSpeakers:true});
assert.deepEqual(emails(single),['anna@company.example'],'Single selection must never expand to members or speakers');
assert.deepEqual(emails(await context.eventNotificationTargets('heuking',{recipientGroup:'single_person',singleRecipientEmail:'dirk@company.example'})),['dirk@company.example'],'Registered person can be selected individually');
await assert.rejects(()=>context.eventNotificationTargets('heuking',{recipientGroup:'single_person',singleRecipientEmail:'anna@company.example,dirk@company.example'}),/genau eine/);
await assert.rejects(()=>context.eventNotificationTargets('heuking',{recipientGroup:'single_person',singleRecipientEmail:''}),/genau eine/);
await assert.rejects(()=>context.eventNotificationTargets('heuking',{recipientGroup:'single_person',singleRecipientEmail:'unknown@example.com'}),/nicht erreichbar/);
aliasData.contacts.push({id:'blocked',email:'blocked@example.com',notificationOptOut:true,firstName:'Blocked',lastName:'Contact'});
await assert.rejects(()=>context.eventNotificationTargets('heuking',{recipientGroup:'single_person',singleRecipientEmail:'blocked@example.com'}),/nicht erreichbar/);
console.log('Single-recipient targeting tests passed.');
