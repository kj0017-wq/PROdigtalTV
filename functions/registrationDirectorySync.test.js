const test = require("node:test");
const assert = require("node:assert/strict");
const { personPatch, memberPatch, directorySyncPlan } = require("./registrationDirectorySync");
test("phone corrections update both phone and mobile; empty creation fields preserve data", () => {
  assert.deepEqual(personPatch({ phone: "+491701234567" }), { phone: "+491701234567", mobile: "+491701234567" });
  assert.equal(personPatch({}).phone, undefined);
  assert.equal(personPatch({}, true).phone, "");
});
test("only the member contact with the matching email is updated", () => {
  const member = { name: "Company", email: "office@example.com", eventContacts: [{ email: "a@example.com", mobile: "old" }, { email: "b@example.com", mobile: "other" }] };
  const patch = memberPatch(member, "a@example.com", { firstName: "A", lastName: "Person", phone: "new" });
  assert.equal(patch.eventContacts[0].mobile, "new");
  assert.equal(patch.eventContacts[1].mobile, "other");
  assert.equal(patch.phone, undefined);
  assert.equal(patch.name, undefined);
});
test("primary member contact receives phone correction without replacing company name", () => {
  const patch = memberPatch({ email: "a@example.com", name: "Company" }, "a@example.com", { firstName: "A", lastName: "Person", phone: "new" });
  assert.equal(patch.contactPhone, "new");
  assert.equal(patch.contactName, "A Person");
  assert.equal(patch.name, undefined);
});
test("existing contact IDs are retained and linked member aliases get their own contact", async () => {
  const docs = { contacts: [{ id: "legacy", ref: "legacy", data: () => ({ email: "a@example.com" }) }], users: [{ ref: "user", data: () => ({ memberId: "member" }) }], members: [{ id: "member", ref: "member", data: () => ({ email: "office@example.com" }) }] };
  const db = { collection: name => ({ get: async () => ({ docs: docs[name] }), where: () => ({ get: async () => ({ docs: docs[name] }) }), doc: id => id }) };
  const plans = await directorySyncPlan(db, { phone: "new" }, "a@example.com", () => "hash", "now");
  assert.deepEqual(plans.map(plan => plan.ref), ["legacy", "user", "member"]);
  assert.equal(plans[2].patch({ email: "office@example.com" }).eventContacts[0].phone, "new");
});
