const test = require("node:test");
const assert = require("node:assert/strict");
const { createEventLiveMessages } = require("./eventLiveMessages");

function fixture() {
  const documents = new Map();
  const registrations = [
    { eventId: "event-a", checkedInEventId: "event-a", status: "checked_in", email: "anna@example.test" },
    { eventId: "event-a", checkedInEventId: "event-a", status: "checked_in", email: "bert@example.test" },
    { eventId: "event-b", checkedInEventId: "event-b", status: "checked_in", email: "cara@example.test" }
  ];
  const rows = path => [...documents.entries()]
    .filter(([key]) => key.startsWith(`${path}/`) && !key.slice(path.length + 1).includes("/"))
    .map(([key, value]) => ({ id: key.split("/").at(-1), data: () => value }));
  const snapshot = (path) => ({ exists: documents.has(path), data: () => documents.get(path), docs: rows(path) });
  const ref = (path) => ({
    path,
    collection: (name) => ref(`${path}/${name}`),
    doc: (id) => ref(`${path}/${id}`),
    get: async () => snapshot(path),
    where: (field, operator, value) => ({ get: async () => ({ docs: rows(path).filter(doc => doc.data()[field].toMillis() > value.toMillis()) }) }),
    orderBy: () => ({
      limit: (count) => ({ get: async () => ({ docs: [...documents.entries()]
        .filter(([key]) => key.startsWith(`${path}/`))
        .slice(0, count)
        .map(([key, value]) => ({ id: key.split("/").at(-1), data: () => value })) }) })
    })
  });
  const db = {
    collection: (name) => name === "registrations" ? {
      where: (field, op, eventId) => ({
        where: () => ({ limit: () => ({ get: async () => ({ docs: registrations.filter((item) => item.eventId === eventId).map((item) => ({ data: () => item })) }) }) })
      })
    } : ref(name),
    runTransaction: async (callback) => callback({
      get: async (reference) => snapshot(reference.path),
      set: (reference, value) => documents.set(reference.path, value)
    })
  };
  class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
  let clock = Date.parse("2026-10-23T10:00:00Z");
  const service = createEventLiveMessages({
    db,
    eventLiveUser: async (request) => ({ contactId: request.auth }),
    contactId: (email) => email.toLowerCase(),
    eventLiveContactRequestId: () => "unused",
    FieldValue: { serverTimestamp: () => { const value = ++clock; return { toDate: () => new Date(value), toMillis: () => value }; } },
    HttpsError
  });
  return { service, documents };
}

test("event group posts are shared with checked-in people only within their event", async () => {
  const { service } = fixture();
  const post = { data: { eventId: "event-a", text: "Hallo an alle", messageId: "12345678-1234-1234" }, auth: "anna@example.test" };
  await service.sendGroupMessage(post);
  const forBert = await service.getGroupMessages({ data: { eventId: "event-a" }, auth: "bert@example.test" });
  assert.equal(forBert.messages.length, 1);
  assert.equal(forBert.messages[0].text, "Hallo an alle");
  assert.equal(forBert.messages[0].senderContactId, "anna@example.test");
  const forCara = await service.getGroupMessages({ data: { eventId: "event-b" }, auth: "cara@example.test" });
  assert.equal(forCara.messages.length, 0);
  await assert.rejects(service.getGroupMessages({ data: { eventId: "event-a" }, auth: "cara@example.test" }), { code: "permission-denied" });
});

test("retrying the same group post does not create another message", async () => {
  const { service, documents } = fixture();
  const request = { data: { eventId: "event-a", text: "Einmal", messageId: "12345678-1234-1234" }, auth: "anna@example.test" };
  await service.sendGroupMessage(request);
  await service.sendGroupMessage(request);
  assert.equal([...documents.keys()].length, 1);
  await assert.rejects(service.sendGroupMessage({ ...request, data: { ...request.data, text: "Anderer Text" } }), { code: "already-exists" });
});

test("group unread count excludes own messages and includes more than one message page", async () => {
  const { service } = fixture();
  for (let index = 0; index < 45; index++) {
    await service.sendGroupMessage({ auth: "anna@example.test", data: { eventId: "event-a", text: `Nachricht ${index}`, messageId: `message-000000000-${index}` } });
  }
  const request = auth => ({ auth, data: { eventId: "event-a" } });
  assert.equal((await service.getGroupStatus(request("anna@example.test"))).unreadCount, 0);
  assert.equal((await service.getGroupStatus(request("bert@example.test"))).unreadCount, 45);
  await assert.rejects(service.getGroupStatus(request("cara@example.test")), { code: "permission-denied" });
});

test("read receipts are per viewer, survive another request, and never mark later posts read", async () => {
  const { service } = fixture();
  const post = (auth, id) => service.sendGroupMessage({ auth, data: { eventId: "event-a", text: id, messageId: id } });
  const status = auth => service.getGroupStatus({ auth, data: { eventId: "event-a" } });
  const read = id => service.markGroupRead({ auth: "bert@example.test", data: { eventId: "event-a", messageId: id } });
  await post("anna@example.test", "message-000000000-1");
  await post("anna@example.test", "message-000000000-2");
  await read("message-000000000-1");
  assert.equal((await status("bert@example.test")).unreadCount, 1);
  await read("message-000000000-2");
  assert.equal((await status("bert@example.test")).unreadCount, 0);
  await read("message-000000000-1");
  assert.equal((await status("bert@example.test")).unreadCount, 0);
  await post("anna@example.test", "message-000000000-3");
  await post("bert@example.test", "message-000000000-4");
  assert.equal((await status("bert@example.test")).unreadCount, 1);
  assert.equal((await status("anna@example.test")).unreadCount, 1);
  await assert.rejects(read("message-000000000-missing"), { code: "not-found" });
  await assert.rejects(service.markGroupRead({ auth: "cara@example.test", data: { eventId: "event-a", messageId: "message-000000000-3" } }), { code: "permission-denied" });
});
