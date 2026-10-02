const test = require("node:test");
const assert = require("node:assert/strict");
const { createEventChatNotifications, online, notificationDecision } = require("./eventChatNotifications");
const ts = value => ({ toMillis: () => value });
const now = Date.now();
test("presence expires, respects hidden state, and combines devices", () => {
  assert.equal(online([{ visible: true, seenAt: ts(now - 90001) }], now), false);
  assert.equal(online([{ visible: false, seenAt: ts(now) }], now), false);
  assert.equal(online([{ visible: false, seenAt: ts(now) }, { visible: true, seenAt: ts(now - 100) }], now), true);
});
test("read and deleted messages are skipped; unread batches notify once", () => {
  const message = { createdAt: ts(now), senderContactId: "alice" };
  assert.equal(notificationDecision(message, {}, "bob", []), "send");
  assert.equal(notificationDecision(message, {}, "bob", [{ visible: true, seenAt: ts(now) }]), "wait");
  assert.equal(notificationDecision({ ...message, deleted: true }, {}, "bob", []), "skip");
  assert.equal(notificationDecision(message, { lastReadAt: { bob: ts(now) } }, "bob", []), "skip");
  assert.equal(notificationDecision(message, { notificationThrough: { bob: ts(now - 5) } }, "bob", []), "skip");
  assert.equal(notificationDecision(message, { notificationThrough: { bob: ts(now - 5) }, lastReadAt: { bob: ts(now - 5) } }, "bob", []), "send");
});

function fixture(pushResult = { attempted: 1, sent: 1, failed: 0, errors: [] }) {
  const data = new Map();
  const deleted = Symbol("delete");
  const path = "eventLiveConversations/event/threads/thread";
  data.set("events/event", { eventLiveEnabled: true });
  data.set("eventLiveAccess/event", { enabled: true });
  data.set(path, { participantIds: ["alice", "bob"] });
  data.set(path + "/messages/message", { senderContactId: "alice", receiverContactId: "bob", text: "PRIVATE", createdAt: ts(now - 1000) });
  data.set("registrations/bob", { eventId: "event", status: "checked_in", checkedInEventId: "event", email: "bob@example.test" });
  data.set("contacts/alice", { firstName: "Alice" });
  data.set("eventChatNotifications/job", { eventId: "event", threadId: "thread", messageId: "message", receiverContactId: "bob", status: "pending", dueAt: ts(now - 100) });
  function ref(path, filters = [], limit = Infinity) {
    const result = {
      path, id: path.split("/").pop(),
      collection: name => ref(path + "/" + name),
      doc: id => ref(path + "/" + id),
      where: (field, op, value) => ref(path, [...filters, [field, op, value]], limit),
      limit: n => ref(path, filters, n),
      async get() {
        if (path.split("/").length % 2 === 0) return { exists: data.has(path), data: () => data.get(path), ref: result };
        const rows = [...data].filter(([key, value]) => key.startsWith(path + "/") && key.split("/").length === path.split("/").length + 1
          && filters.every(([field, op, wanted]) => {
            const actual = value[field]?.toMillis?.() ?? value[field];
            const expected = wanted?.toMillis?.() ?? wanted;
            return op === "==" ? actual === expected : op === ">" ? actual > expected : actual <= expected;
          })).slice(0, limit);
        return { docs: rows.map(([key, value]) => ({ ref: ref(key), data: () => value })) };
      },
      async set(value, options) {
        const record = options?.merge ? { ...data.get(path), ...value } : { ...value };
        Object.keys(record).forEach(key => { if (record[key] === deleted) delete record[key]; });
        data.set(path, record);
      },
      async update(value) { return result.set(value, { merge: true }); }
    };
    return result;
  }
  const db = { collection: ref, runTransaction: async fn => fn({
    get: r => r.get(), set: (r, v, o) => r.set(v, o), update: (r, v) => r.update(v),
    create: async (r, v) => { assert.equal(data.has(r.path), false); return r.set(v); }
  }) };
  const pushes = [];
  const service = createEventChatNotifications({ db,
    pushService: { deliver: async (email, payload) => { pushes.push({ email, payload }); return pushResult; } },
    FieldValue: { serverTimestamp: () => ts(Date.now()), delete: () => deleted },
    Timestamp: { now: () => ts(Date.now()), fromMillis: ts },
    contactId: email => email.split("@")[0], HttpsError: Error
  });
  return { service, data, path, pushes };
}
test("push accepted: persists result, no mail, repeat processing is harmless", async () => {
  const f = fixture();
  await f.service.processPending();
  await f.service.processPending();
  assert.equal(f.pushes.length, 1);
  assert.equal(f.data.get("eventChatNotifications/job").status, "push_accepted");
  assert.equal([...f.data.keys()].some(key => key.startsWith("mailQueue/")), false);
  assert.match(f.pushes[0].payload.link, /event-live\/event\?peer=alice/);
});
test("no push: one mail with login route, no message content", async () => {
  const f = fixture({ attempted: 0, sent: 0, failed: 0, errors: [] });
  await f.service.processPending();
  await f.service.processPending();
  const mails = [...f.data].filter(([key]) => key.startsWith("mailQueue/"));
  assert.equal(mails.length, 1);
  assert.equal(mails[0][1].to, "bob@example.test");
  assert.equal(mails[0][1].template, "event_chat_unread");
  assert.equal(JSON.stringify(mails[0][1]).includes("PRIVATE"), false);
});
test("online defers; read or reset skips; no wrong recipient", async () => {
  const f = fixture();
  f.data.set("eventChatPresence/bob/sessions/device", { visible: true, seenAt: ts(Date.now()) });
  await f.service.processPending();
  assert.equal(f.pushes.length, 0);
  assert.equal(f.data.get("eventChatNotifications/job").status, "pending");
  f.data.delete(f.path + "/messages/message");
  f.data.get("eventChatNotifications/job").dueAt = ts(0);
  await f.service.processPending();
  assert.equal(f.data.get("eventChatNotifications/job").status, "skipped");
});
test("temporary push errors retry instead of immediately mailing", async () => {
  const f = fixture({ attempted: 1, sent: 0, failed: 1, errors: [{ code: "messaging/server-unavailable" }] });
  await f.service.processPending();
  assert.equal(f.data.get("eventChatNotifications/job").status, "pending");
  assert.equal([...f.data.keys()].some(key => key.startsWith("mailQueue/")), false);
});
test("presence requires verified identity and never accepts another contact id", async () => {
  const f = fixture();
  await assert.rejects(f.service.presence({ data: {} }));
  await f.service.presence({ auth: { uid: "bob", token: { email: "bob@example.test", email_verified: true } },
    data: { sessionId: "00000000-00000001", visible: true, contactId: "alice" } });
  assert.ok(f.data.has("eventChatPresence/bob/sessions/00000000-00000001"));
  assert.equal(f.data.has("eventChatPresence/alice/sessions/00000000-00000001"), false);
});
