const test = require("node:test");
const assert = require("node:assert/strict");
const { createEventContentModeration } = require("./eventContentModeration");

function fixture() {
  const store = new Map([
    ["events/a", { title: "Event A" }], ["events/b", { title: "Event B" }],
    ["eventLiveConversations/a/groups/everyone/messages/group-one", { text: "Gruppennachricht" }],
    ["eventLiveConversations/a/threads/direct/messages/private-one", { text: "Direktnachricht" }],
    ["eventLiveConversations/a/threads/direct", { lastMessageId: "private-one", lastText: "Direktnachricht" }],
    ["eventLiveConversations/b/groups/everyone/messages/other", { text: "Anderes Event" }],
    ["eventMedia/photo-a", { eventId: "a", source: "portal-gallery-upload", mediaType: "image", storagePath: "portal-gallery-photos/u/photo-a/a.jpg" }],
    ["eventMedia/photo-b", { eventId: "b", source: "portal-gallery-upload", mediaType: "image", storagePath: "portal-gallery-photos/u/photo-b/b.jpg" }],
    ["eventMedia/editorial", { eventId: "a", source: "editorial", mediaType: "image" }],
    ["registrations/ticket", { eventId: "a" }]
  ]);
  const removedFiles = [];
  let failStorage = false;
  const ref = path => ({
    path, id: path.split("/").at(-1),
    get parent() { return ref(path.split("/").slice(0, -1).join("/")); },
    doc: name => ref(path + "/" + name), collection: name => ref(path + "/" + name),
    get: async () => path.split("/").length % 2 === 0 ? snapshot(path) : query(path),
    delete: async () => store.delete(path),
    where: (field, op, value) => ({ get: async () => ({ docs: query(path).docs.filter(doc => doc.data()[field] === value) }) }),
    listDocuments: async () => [...new Set([...store.keys()].filter(key => key.startsWith(path + "/")).map(key => key.slice(path.length + 1).split("/")[0]))].map(name => ref(path + "/" + name))
  });
  const snapshot = path => ({ id: path.split("/").at(-1), ref: ref(path), exists: store.has(path), data: () => store.get(path) });
  const query = path => ({ docs: [...store.keys()].filter(key => key.startsWith(path + "/") && !key.slice(path.length + 1).includes("/")).map(snapshot) });
  const set = (reference, value, options) => store.set(reference.path, options?.merge ? { ...store.get(reference.path), ...value } : value);
  const db = { collection: ref, batch: () => {
    const operations = [];
    return { delete: reference => operations.push(() => store.delete(reference.path)),
      set: (...args) => operations.push(() => set(...args)), commit: async () => operations.forEach(run => run()) };
  }, runTransaction: async action => action({ get: reference => reference.get(), set }) };
  class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
  const service = createEventContentModeration({
    db, HttpsError, FieldValue: { delete: () => null },
    requireAdmin: async request => { if (request.auth !== "admin") throw new HttpsError("permission-denied", "Admin erforderlich"); },
    bucket: { file: path => ({ delete: async options => { assert.equal(options.ignoreNotFound, true); if (failStorage) throw new Error("Storage unavailable"); removedFiles.push(path); } }) }
  });
  const request = data => ({ auth: "admin", data: { eventId: "a", confirmed: true, ...data } });
  return { store, service, request, removedFiles, failStorage: () => { failStorage = true; } };
}
test("non-admin cannot list or delete event content; confirmation and valid scope are required", async () => {
  const { service, request, store } = fixture();
  await assert.rejects(service.list({ ...request({}), auth: "member" }), { code: "permission-denied" });
  await assert.rejects(service.remove({ ...request({kind:"all",all:true}), auth: "guest" }), { code: "permission-denied" });
  await assert.rejects(service.remove(request({kind:"all",all:true,confirmed:false})), { code: "failed-precondition" });
  await assert.rejects(service.remove(request({kind:"messages",channelType:"groups",channelId:"../b",messageId:"other"})), { code: "invalid-argument" });
  assert.equal(store.has("eventMedia/photo-a"), true);
});
test("listing includes group messages below missing parent docs, private chats, and only this event's participant photos", async () => {
  const { service, request } = fixture();
  const result = await service.list(request({}));
  assert.equal(result.messageCount, 2);
  assert.equal(result.photoCount, 1);
  assert.deepEqual(result.messages.map(item => item.channelType).sort(), ["groups", "threads"]);
});
test("individual message deletion removes text and preview, publishes a cache revision, and preserves other chats", async () => {
  const { service, request, store } = fixture();
  const result = await service.remove(request({kind:"messages",channelType:"threads",channelId:"direct",messageId:"private-one"}));
  assert.equal(result.deletedMessages, 1);
  assert.equal(store.has("eventLiveConversations/a/threads/direct/messages/private-one"), false);
  assert.equal(store.get("eventLiveConversations/a/threads/direct").lastText, "");
  assert.ok(store.get("eventLiveConversations/a").moderationRevision);
  assert.equal(store.has("eventLiveConversations/a/groups/everyone/messages/group-one"), true);
});
test("individual photo deletes its file; foreign event photo cannot be deleted", async () => {
  const { service, request, store, removedFiles } = fixture();
  await assert.rejects(service.remove(request({kind:"photos",photoId:"photo-b"})), { code:"permission-denied" });
  await service.remove(request({kind:"photos",photoId:"photo-a"}));
  assert.equal(store.has("eventMedia/photo-a"), false);
  assert.deepEqual(removedFiles, ["portal-gallery-photos/u/photo-a/a.jpg"]);
  assert.equal(store.has("eventMedia/photo-b"), true);
});
test("complete deletion handles batches above 400 and preserves other events, editorial media and registrations", async () => {
  const { service, request, store } = fixture();
  for (let i=0;i<405;i++) store.set("eventLiveConversations/a/groups/everyone/messages/extra-"+i, {text:"test"});
  const result = await service.remove(request({kind:"all",all:true}));
  assert.deepEqual(result, {deletedMessages:407,deletedPhotos:1});
  assert.equal((await service.list(request({}))).messageCount, 0);
  assert.equal(store.has("eventMedia/photo-b"), true);
  assert.equal(store.has("eventMedia/editorial"), true);
  assert.equal(store.has("registrations/ticket"), true);
  assert.equal(store.has("eventLiveConversations/b/groups/everyone/messages/other"), true);
});
test("failed storage deletion leaves the photo record for retry", async () => {
  const { service, request, store, failStorage } = fixture();
  failStorage();
  await assert.rejects(service.remove(request({kind:"photos",photoId:"photo-a"})), /Storage unavailable/);
  assert.equal(store.has("eventMedia/photo-a"), true);
});
