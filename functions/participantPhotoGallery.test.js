const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const source = readFileSync(require("node:path").join(__dirname, "index.js"), "utf8");
const helpers = source.slice(source.indexOf("async function requireParticipantPhotoAccess"), source.indexOf("exports.listPortalParticipantPhotos"));
class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
function api(profile, registrations = [], eventState = {}) {
  const db = { collection(name) {
    if (name === "users") return { doc: () => ({ get: async () => ({ exists: !!profile, data: () => profile }) }) };
    if (name === "events" || name === "eventLiveAccess") return {
      doc: () => ({ get: async () => ({ exists: true, data: () =>
        name === "events" ? { eventLiveEnabled: true, ...eventState } : { enabled: eventState.accessEnabled !== false } }) })
    };
    const query = { where: () => query, get: async () => ({ docs: registrations.map((data) => ({ data: () => data })) }) };
    return query;
  } };
  return new Function("db", "clean", "HttpsError", "guestEventLiveIsOpen", helpers + ";return {requireParticipantPhotoAccess,participantPhotoRecord,participantPhotoUnread};")(db, (value) => String(value || "").trim(), HttpsError, (event) => event.guestOpen !== false);
}
const auth = { uid: "person", token: { email_verified: true, email: "guest@example.com" } };
test("photos require a verified login and active completed account", async () => {
  await assert.rejects(api({ role: "member" }).requireParticipantPhotoAccess(null), { code: "unauthenticated" });
  await assert.rejects(api({ role: "member" }).requireParticipantPhotoAccess({ ...auth, token: { email_verified: false } }), { code: "unauthenticated" });
  await assert.rejects(api({ role: "member", status: "inactive" }).requireParticipantPhotoAccess(auth), { code: "permission-denied" });
  await assert.rejects(api({ role: "guest", guestPasswordTemporary: true }, [{ status: "confirmed" }]).requireParticipantPhotoAccess(auth), { code: "permission-denied" });
});
test("access is scoped to confirmed events for guests, members and companions", async () => {
  for (const role of ["guest", "member", "admin"]) {
    const service = api({ role }, [
      { eventId: "heuking", status: "checked_in" },
      { eventId: "pending", status: "pending_email_confirmation" },
      { eventId: "cancelled", status: "cancelled" }
    ]);
    const access = await service.requireParticipantPhotoAccess(auth);
    assert.deepEqual([...access.keys()], ["heuking"]);
    await service.requireParticipantPhotoAccess(auth, "heuking", true);
    for (const eventId of ["other", "pending", "cancelled", ""]) {
      await assert.rejects(service.requireParticipantPhotoAccess(auth, eventId, true), { code: "permission-denied" });
    }
  }
});
test("unread counts are per person and exclude their own uploads", () => {
  const service = api({});
  assert.equal(service.participantPhotoUnread({ uploadedBy: "other" }, "new", "person", new Set(["seen"])), true);
  assert.equal(service.participantPhotoUnread({ uploadedBy: "other" }, "seen", "person", new Set(["seen"])), false);
  assert.equal(service.participantPhotoUnread({ uploadedBy: "person" }, "own", "person", new Set()), false);
});
test("completed photos appear independently of editorial approval", () => {
  const record = { source: "portal-gallery-upload", storagePath: "photo.jpg", mediaType: "image", eventId: "heuking" };
  for (const status of ["uploaded", "new", "approved", "rejected"]) assert.equal(api({}).participantPhotoRecord({ ...record, status }), true);
  assert.equal(api({}).participantPhotoRecord({ ...record, status: "uploading" }), false);
  assert.equal(api({}).participantPhotoRecord({ ...record, eventId: "" }), false);
  assert.equal(api({}).participantPhotoRecord({ ...record, source: "cms-event-upload" }), false);
});

function endpoints() {
  const tables = {
    users: { person: { role: "guest", status: "active" }, second: { role: "member" } },
    registrations: {
      primary: { email: "guest@example.com", eventId: "heuking", status: "confirmed" },
      companion: { email: "host@example.com", companion: { email: "guest@example.com" }, eventId: "other", status: "checked_in" },
      inactive: { email: "guest@example.com", eventId: "inactive", status: "confirmed" },
      pending: { email: "guest@example.com", eventId: "blocked", status: "pending_email_confirmation" }
    },
    events: { heuking: { title: "Heuking", eventLiveEnabled: true }, other: { title: "Other", eventLiveEnabled: true }, inactive: { title: "Inactive", eventLiveEnabled: false } },
    eventLiveAccess: { heuking: { enabled: true }, other: { enabled: true }, inactive: { enabled: false } },
    eventMedia: {
      new: { eventId: "heuking", source: "portal-gallery-upload", storagePath: "new.jpg", mediaType: "image", status: "uploaded", uploadedBy: "someone", uploadedAt: "2026-10-01" },
      own: { eventId: "heuking", source: "portal-gallery-upload", storagePath: "own.jpg", mediaType: "image", status: "uploaded", uploadedBy: "person" },
      other: { eventId: "other", source: "portal-gallery-upload", storagePath: "other.jpg", mediaType: "image", status: "uploaded", uploadedBy: "someone" },
      inactive: { eventId: "inactive", source: "portal-gallery-upload", storagePath: "inactive.jpg", mediaType: "image", status: "uploaded" },
      blocked: { eventId: "blocked", source: "portal-gallery-upload", storagePath: "blocked.jpg", mediaType: "image", status: "uploaded" },
      unassigned: { eventId: "", source: "portal-gallery-upload", storagePath: "unassigned.jpg", mediaType: "image", status: "uploaded" }
    }
  };
  const valueAt = (data, key) => key.split(".").reduce((value, part) => value?.[part], data);
  const collection = (name, filters = []) => ({
    doc(id = "intent") {
      const ref = {
        id,
        async get() { return { id, exists: !!tables[name]?.[id], data: () => tables[name]?.[id] }; },
        async set(data) { (tables[name] ||= {})[id] = data; },
        async create(data) { (tables[name] ||= {})[id] = data; },
        collection(child) { return collection(name + "/" + id + "/" + child); }
      };
      return ref;
    },
    where(key, op, value) { return collection(name, [...filters, [key, value]]); },
    async get() {
      return { docs: Object.entries(tables[name] || {}).filter(([, data]) =>
        filters.every(([key, value]) => valueAt(data, key) === value))
        .map(([id, data]) => ({ id, data: () => data })) };
    }
  });
  const db = {
    collection,
    batch() {
      const writes = [];
      return { set: (ref, data) => writes.push(() => ref.set(data)), commit: async () => Promise.all(writes.map((write) => write())) };
    }
  };
  const output = {};
  const block = source.slice(source.indexOf("exports.beginPortalGalleryPhotoUpload"), source.indexOf("exports.getMyEventRegistrations"));
  new Function("exports", "db", "clean", "HttpsError", "onCall", "onRequest", "region", "FieldValue", "getAuth", "getStorage", "storageBucket", "guestEventLiveIsOpen", "requireAdmin", block)(
    output, db, (value) => String(value || "").trim(), HttpsError, (_, handler) => handler, (_, handler) => handler, "test",
    { serverTimestamp: () => "now" },
    () => ({ verifyIdToken: async () => ({ uid: "person", ...auth.token }) }),
    () => { throw new Error("Storage must not be touched for a denied photo."); }, "test", (event) => event.guestOpen !== false,
    async request => { if (tables.users[request.auth.uid]?.role !== "admin") throw new HttpsError("permission-denied", "Admin erforderlich"); }
  );
  return output;
}
test("list returns only confirmed primary and companion events, counts decrease after viewing", async () => {
  const service = endpoints();
  const before = await service.listPortalParticipantPhotos({ auth, data: {} });
  assert.deepEqual(new Set(before.photos.map((photo) => photo.id)), new Set(["new", "own", "other"]));
  assert.equal(before.unreadCount, 2);
  assert.equal(before.events.find((event) => event.eventId === "heuking").unreadCount, 1);
  const mark = await service.markPortalParticipantPhotosSeen({ auth, data: { eventId: "heuking", photoIds: ["new", "other", "blocked"] } });
  assert.deepEqual(mark.marked, ["new"]);
  const after = await service.listPortalParticipantPhotos({ auth, data: {} });
  assert.equal(after.unreadCount, 1);
  assert.equal(after.events.find((event) => event.eventId === "heuking").unreadCount, 0);
  await assert.rejects(service.listPortalParticipantPhotos({ auth, data: { eventId: "blocked" } }), { code: "permission-denied" });
});
test("upload intents require event permission and keep the event ID", async () => {
  const service = endpoints();
  const data = { fileName: "photo.jpg", fileType: "image/jpeg", fileSize: 100 };
  await assert.rejects(service.beginPortalGalleryPhotoUpload({ auth, data }), { code: "permission-denied" });
  await assert.rejects(service.beginPortalGalleryPhotoUpload({ auth, data: { ...data, eventId: "blocked" } }), { code: "permission-denied" });
  const intent = await service.beginPortalGalleryPhotoUpload({ auth, data: { ...data, eventId: "heuking" } });
  assert.equal(intent.mediaId, "intent");
});
test("direct photo retrieval denies another event before touching storage", async () => {
  const service = endpoints();
  const res = { code: 0, status(code) { this.code = code; return this; }, send(message) { this.message = message; } };
  await service.getPortalParticipantPhoto({ method: "GET", headers: { authorization: "Bearer test" }, query: { mediaId: "blocked" } }, res);
  assert.equal(res.code, 403);
  await service.getPortalParticipantPhoto({ method: "GET", headers: { authorization: "Bearer test" }, query: { mediaId: "unassigned" } }, res);
  assert.equal(res.code, 404);
});

test("inactive events stay hidden until both activation switches are enabled", async () => {
  for (const state of [
    { eventLiveEnabled: false }, { accessEnabled: false },
    { status: "inactive" }, { status: "inaktiv" }, { status: "draft" },
    { visible: false }, { isLive: false }
  ]) {
    const service = api({ role: "member" }, [{ eventId: "salzburg", status: "confirmed" }], state);
    assert.equal((await service.requireParticipantPhotoAccess(auth)).size, 0);
    await assert.rejects(service.requireParticipantPhotoAccess(auth, "salzburg", true), { code: "permission-denied" });
  }
  const active = api({ role: "member" }, [{ eventId: "salzburg", status: "confirmed" }], { status: "published" });
  assert.equal((await active.requireParticipantPhotoAccess(auth)).has("salzburg"), true);
});
test("disabled events cannot be opened, uploaded to or marked seen", async () => {
  const service = endpoints();
  await assert.rejects(service.listPortalParticipantPhotos({ auth, data: { eventId: "inactive" } }), { code: "permission-denied" });
  await assert.rejects(service.beginPortalGalleryPhotoUpload({ auth, data: { eventId: "inactive", fileName: "photo.jpg", fileType: "image/jpeg", fileSize: 100 } }), { code: "permission-denied" });
  await assert.rejects(service.markPortalParticipantPhotosSeen({ auth, data: { eventId: "inactive", photoIds: ["inactive"] } }), { code: "permission-denied" });
  const res = { status(code) { this.code = code; return this; }, send() {} };
  await service.getPortalParticipantPhoto({ method: "GET", headers: { authorization: "Bearer test" }, query: { mediaId: "inactive" } }, res);
  assert.equal(res.code, 403);
});

test("guests lose photo access outside the current event window; members retain event access", async () => {
  const registrations = [{ eventId: "heuking", status: "confirmed" }];
  const guest = api({ role: "guest" }, registrations, { guestOpen: false });
  assert.equal((await guest.requireParticipantPhotoAccess(auth)).size, 0);
  await assert.rejects(guest.requireParticipantPhotoAccess(auth, "heuking", true), { code: "permission-denied" });
  const member = api({ role: "member" }, registrations, { guestOpen: false });
  assert.equal((await member.requireParticipantPhotoAccess(auth)).has("heuking"), true);
});
