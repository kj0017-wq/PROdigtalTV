const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { canModerate, cardsPatch, moderatorCardOwner } = require("./eventModerator");
const source = fs.readFileSync(require("node:path").join(__dirname, "index.js"), "utf8");
class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
function setup() {
  const event = { moderatorUserIds: ["a", "b"], moderators: [{ uid: "a", name: "A" }, { uid: "b", name: "B" }], moderationCards: [{ id: "shared" }] };
  const sets = { a: { moderationCards: [{ id: "private-a" }] }, b: { moderationCards: [{ id: "private-b" }] } };
  const writes = [];
  const snapshot = (data, id) => ({ exists: !!data, id, data: () => data });
  const profileRef = uid => ({ get: async () => snapshot({ role: uid === "admin" ? "admin" : "guest", status: "active" }) });
  const ref = { get: async () => snapshot(event, "event"), collection: () => ({ doc: uid => ({ uid, get: async () => snapshot(sets[uid], uid) }), get: async () => ({ docs: Object.entries(sets).map(([uid, data]) => snapshot(data, uid)) }) }) };
  const context = vm.createContext({ exports: {}, region: "test", onCall: (_, fn) => fn, HttpsError, canModerate, cardsPatch, moderatorCardOwner, clean: value => String(value || "").trim(), FieldValue: { serverTimestamp: () => "now" },
    db: { collection: name => name === "users" ? { doc: profileRef } : name === "events" ? { doc: () => ref } : { get: async () => ({ docs: [] }) }, runTransaction: async fn => fn({ get: r => r.get(), set: (r, data) => writes.push({ uid: r.uid, data }), update: () => { throw Error("Shared event must not be overwritten"); } }) }
  });
  vm.runInContext(source.slice(source.indexOf("async function moderatorProfile(request)")), context);
  return { api: context.exports, writes };
}
test("moderator response contains only their own saved cards", async () => {
  const { api } = setup();
  const result = await api.getModeratorCards({ auth: { uid: "a" }, data: { eventId: "event" } });
  assert.equal(result.event.moderationCards[0].id, "private-a");
  assert.equal(result.cardOwners, undefined);
  await assert.rejects(api.getModeratorCards({ auth: { uid: "a" }, data: { eventId: "event", ownerId: "b" } }));
  const admin = await api.getModeratorCards({ auth: { uid: "admin" }, data: { eventId: "event", ownerId: "b" } });
  assert.equal(admin.event.moderationCards[0].id, "private-b");
  assert.equal(admin.cardOwners.length, 2);
});
test("each moderator saves separately and cannot overwrite another moderator", async () => {
  const { api, writes } = setup();
  for (const uid of ["a", "b"]) await api.saveModeratorCards({ auth: { uid }, data: { eventId: "event", cards: [], removedIds: [] } });
  assert.deepEqual(writes.map(write => write.uid), ["a", "b"]);
  await assert.rejects(api.saveModeratorCards({ auth: { uid: "a" }, data: { eventId: "event", ownerId: "b", cards: [] } }));
  assert.equal(writes.length, 2);
});
