const assert = require("node:assert/strict");
const { createEventLiveTestUser } = require("../functions/eventLiveTestUser");
class HttpsError extends Error { constructor(code) { super(code); this.code = code; } }
const query = { where() { return this; }, async get() { return { docs: [{ data: () => ({ email: "person@example.test", checkedInEventId: "event" }) }] }; } };
const user = createEventLiveTestUser({
  eventLiveUser: async request => {
    if (!request.auth) throw new HttpsError("unauthenticated");
    return { contactId: "original", email: "admin@example.test", member: { id: "original-company" } };
  },
  requireAdmin: async request => { if (request.auth.uid !== "admin") throw new HttpsError("permission-denied"); },
  db: { collection: () => query }, contactId: email => email.split("@")[0], HttpsError
});
(async () => {
  assert.equal((await user({ auth: { uid: "member" }, data: {} }, "event")).contactId, "original");
  await assert.rejects(user({ auth: { uid: "member" }, data: { adminTestContactId: "person" } }, "event"), { code: "permission-denied" });
  await assert.rejects(user({ auth: { uid: "admin" }, data: { adminTestContactId: "absent" } }, "event"), { code: "permission-denied" });
  await assert.rejects(user({ auth: { uid: "admin" }, data: { adminTestContactId: "person" } }, "other-event"), { code: "permission-denied" });
  const target = await user({ auth: { uid: "admin" }, data: { adminTestContactId: "person" } }, "event");
  assert.equal(target.contactId, "person");
  assert.equal(target.email, "person@example.test");
  assert.equal(target.adminActorUid, "admin");
  assert.equal(target.adminTest, true);
  assert.equal(target.member, null);
  console.log("Admin test identity: admin-only, event isolation, target identity and actor audit passed.");
})().catch(error => { console.error(error); process.exitCode = 1; });
