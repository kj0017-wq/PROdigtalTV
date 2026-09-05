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
load(backend, ["normalizedMemberEmails", "memberCanMatchRegistration", "memberIsNotificationTestGroup", "memberIsMailingEligible", "notificationTestGroupTargets", "eventNotificationTargets"]);
load(cms, ["userIsActive", "peopleContactType", "peopleMailingDisabled", "peopleMemberEmails", "peopleMemberIsActive", "peopleMemberContactRows", "peopleUserContactRows", "mergePeopleContactsAndMembers"]);
const members = [
  { id: "one", email: "one@example.com", notificationTestGroup: true },
  { id: "two", email: "two@example.com", notificationTestGroup: true },
  { id: "three", email: "three@example.com", notificationTestGroup: true },
  { id: "other", email: "other@example.com" },
  { id: "removed", email: "removed@example.com", notificationTestGroup: false, testGroup: true },
  { id: "cancelled", email: "cancelled@example.com", status: "active", membershipAccessStatus: "cancelled", notificationTestGroup: true }
];
const users = [
  { id: "linked", email: "linked@example.com", memberId: "other", role: "admin" },
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
console.log("Mailing recipient regression checks passed; no network calls or messages.");
