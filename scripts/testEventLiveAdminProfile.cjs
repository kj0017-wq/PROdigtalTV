const assert = require("node:assert/strict");
const { createAdminProfileUpdater } = require("../functions/eventLiveAdminProfile");
async function run() {
  let record = { firstName: "Original", lastName: "Person", email: "person@example.test", autoShareContactDetails: false };
  let writes = 0;
  let attending = true;
  class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
  const db = {
    collection: name => ({
      doc: id => ({ name, id }),
      where: () => ({ get: async () => ({ docs: attending ? [{ data: () => ({ status: "checked_in", checkedInEventId: "event", email: "person@example.test" }) }] : [] }) })
    }),
    runTransaction: async fn => fn({
      get: async () => ({ exists: true, data: () => record }),
      set: (_ref, value) => { writes++; record = { ...record, ...value }; }
    })
  };
  const update = createAdminProfileUpdater({
    db, requireAdmin: async request => { if (request.auth?.role !== "admin") throw new HttpsError("permission-denied", "Admin required"); },
    contactId: email => email === "person@example.test" ? "person" : "other",
    FieldValue: { serverTimestamp: () => "now" }, HttpsError
  });
  const request = profile => ({ auth: { uid: "admin", role: "admin" }, data: { eventId: "event", targetContactId: "person", profile } });
  await assert.rejects(update({ ...request({ firstName: "Changed" }), auth: { role: "member" } }), { code: "permission-denied" });
  for (const profile of [{ email: "other@example.test" }, { autoShareContactDetails: true }, { role: "admin" }, { website: "javascript:alert(1)" }, { photoStoragePath: "event-live-profiles/other/profile-123.jpg" }]) {
    await assert.rejects(update(request(profile)), { code: "invalid-argument" });
  }
  assert.equal(writes, 0);
  assert.deepEqual(await update(request({ firstName: "Updated", biography: "New vita", photoStoragePath: "event-live-profiles/admin/profile-123.jpg" })), { saved: true });
  assert.equal(record.name, "Updated Person");
  assert.equal(record.email, "person@example.test");
  assert.equal(record.autoShareContactDetails, false);
  assert.equal(record.eventLiveProfileUpdatedBy, "admin");
  attending = false;
  await assert.rejects(update(request({ company: "Other" })), { code: "not-found" });
  assert.equal(writes, 1);
  console.log("Admin profile: authorization, event membership, allowed fields, photo ownership and preservation passed.");
}
run().catch(error => { console.error(error); process.exitCode = 1; });
