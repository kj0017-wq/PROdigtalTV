const assert = require("node:assert/strict");
const { createEventLiveMessages } = require("../functions/eventLiveMessages.js");
const docs = new Map();
let tick = 0;
let open = true;
let pushEnabled = true;
const present = new Set(["alice", "bob", "carol"]);
const stamp = () => { const n = ++tick; return { toMillis: () => n, toDate: () => new Date(n) }; };
const snapshot = (path) => ({ id: path.split("/").pop(), exists: docs.has(path), data: () => docs.get(path) });
function ref(path) {
  return {
    path,
    id: path.split("/").pop(),
    doc: (id) => ref(`${path}/${id}`),
    collection: (name) => ref(`${path}/${name}`),
    get: async () => snapshot(path),
    set: async (value) => docs.set(path, { ...docs.get(path), ...value, lastReadAt: { ...docs.get(path)?.lastReadAt, ...value.lastReadAt } }),
    where() { return this; },
    limit() { return { get: async () => ({ docs: [...present].map((name) => ({ data: () => ({ checkedInEventId: "event", email: `${name}@test.invalid` }) })) }) }; },
    orderBy() {
      const query = { startAfter() { return query; }, limit(count) { return { get: async () => ({ docs: [...docs.keys()].filter((key) => key.startsWith(`${path}/`)).map(snapshot).sort((a, b) => b.data().createdAt.toMillis() - a.data().createdAt.toMillis()).slice(0, count) }) }; } };
      return query;
    }
  };
}
const db = {
  collection: ref,
  async runTransaction(fn) { return fn({ get: (r) => r.get(), set: (r, value) => r.set(value), create: (r, value) => { assert.equal(docs.has(r.path), false); return r.set(value); } }); }
};
class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
const service = createEventLiveMessages({ db,
  eventLiveUser: async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "login");
    if (!open) throw new HttpsError("permission-denied", "closed");
    if (request.auth.uid === "admin") return { contactId: "alice", adminTest: true, adminActorUid: "admin" };
    return { contactId: request.auth.uid };
  },
  contactId: (email) => email.split("@")[0],
  eventLiveContactRequestId: (...parts) => parts.join("-"),
  FieldValue: { serverTimestamp: stamp }, HttpsError,
  Timestamp: { fromMillis: value => ({ toMillis: () => value }) },
  requirePush: async () => { if (!pushEnabled) throw new HttpsError("failed-precondition", "push"); }
});
const request = (uid, peerId, extra = {}) => ({ auth: { uid }, data: { eventId: "event", peerId, ...extra } });
(async () => {
  await assert.rejects(() => service.getMessages({ data: { eventId: "event", peerId: "bob" } }), { code: "unauthenticated" });
  await assert.rejects(() => service.getMessages(request("alice", "alice")), { code: "invalid-argument" });
  await assert.rejects(() => service.getMessages(request("alice", "absent")), { code: "permission-denied" });
  await assert.rejects(() => service.sendMessage(request("absent", "bob", { text: "hello", messageId: "00000000-00000001" })), { code: "permission-denied" });
  const first = request("alice", "bob", { text: "Hello Bob", messageId: "00000000-00000001", senderContactId: "carol" });
  pushEnabled = false;
  await assert.rejects(() => service.sendMessage(first), { code: "failed-precondition" });
  pushEnabled = true;
  await service.sendMessage(first);
  await service.sendMessage(first);
  assert.equal([...docs.keys()].filter((path) => path.includes("/messages/")).length, 1);
  assert.equal([...docs.keys()].filter((path) => path.startsWith("eventChatNotifications/")).length, 1);
  assert.equal((await service.getMessages(request("alice", "bob"))).messages[0].read, false);
  await service.getMessages(request("bob", "alice"));
  assert.equal((await service.getMessages(request("alice", "bob"))).messages[0].read, false);
  await assert.rejects(() => service.markRead(request("alice", "bob", { messageId: first.data.messageId })), { code: "not-found" });
  await service.markRead(request("bob", "alice", { messageId: first.data.messageId }));
  assert.equal((await service.getMessages(request("alice", "bob"))).messages[0].read, true);
  await service.sendMessage(request("bob", "alice", { text: "Hello Alice", messageId: "00000000-00000002" }));
  const alice = await service.getMessages(request("alice", "bob"));
  const bob = await service.getMessages(request("bob", "alice"));
  assert.deepEqual(alice.messages.map((m) => m.self), [true, false]);
  assert.deepEqual(bob.messages.map((m) => m.self), [false, true]);
  assert.equal((await service.getMessages(request("carol", "bob"))).messages.length, 0);
  await assert.rejects(() => service.sendMessage(request("alice", "bob", { text: "x".repeat(2001), messageId: "00000000-00000003" })), { code: "invalid-argument" });
  const removable = request("alice", "bob", { text: "Remove me", messageId: "00000000-delete01" });
  await service.sendMessage(removable);
  await assert.rejects(() => service.deleteMessage(request("bob", "alice", { messageId: removable.data.messageId })), { code: "permission-denied" });
  await service.deleteMessage(removable);
  await service.deleteMessage(removable);
  assert.equal((await service.getMessages(request("alice", "bob"))).messages.find(m => m.id === removable.data.messageId).deleted, true);
  await assert.rejects(() => service.deleteMessage(first), { code: "failed-precondition" });
  const adminTest = request("admin", "bob", { text: "Test message", messageId: "00000000-admintest" });
  await service.sendMessage(adminTest);
  await service.sendMessage(adminTest);
  const storedTest = [...docs.values()].find(item => item.text === "[Admin-Test] Test message");
  assert.equal(storedTest.adminActorUid, "admin");
  assert.equal(storedTest.senderContactId, "alice");
  await assert.rejects(service.deleteMessage(request("admin", "bob", { messageId: first.data.messageId })), { code: "permission-denied" });
  await service.deleteMessage(adminTest);
  await service.markRead(request("admin", "bob", { messageId: "00000000-00000002" }));
  assert.equal([...docs.values()].find(item => item.lastReadAdminActor)?.lastReadAdminActor.alice, "admin");
  open = false;
  await assert.rejects(() => service.getMessages(request("alice", "bob")), { code: "permission-denied" });
  console.log("Event Live chat: bidirectional history, attendance, sender identity, retry deduplication, access window and isolation passed.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
