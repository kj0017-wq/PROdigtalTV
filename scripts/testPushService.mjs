import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
const require = createRequire(import.meta.url);
const { createPushService } = require("../functions/pushService.js");
const { validateMessage } = require("../node_modules/firebase-admin/lib/messaging/messaging-internal.js");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const records = new Map();
function reference(path) {
  return { id: path.split("/").at(-1),
    async get() { return { exists: records.has(path), id: this.id, data: () => records.get(path), ref: this }; },
    async set(value) { records.set(path, { ...(records.get(path) || {}), ...value }); }
  };
}
const db = {
  collection(name) {
    return { doc(id) { return reference(`${name}/${id}`); }, where(field, op, value) {
      return { limit() { return this; }, async get() {
        const paths = [...records.keys()].filter((key) => key.startsWith(`${name}/`) && records.get(key)[field] === value);
        return { docs: await Promise.all(paths.map((key) => reference(key).get())) };
      } };
    } };
  },
  async runTransaction(fn) { return fn({ get: (ref) => ref.get(), set: (ref, value) => ref.set(value) }); }
};
let timestamp = 1;
const sent = [];
const service = createPushService({ db,
  HttpsError: class extends Error { constructor(code, message) { super(message); this.code = code; } },
  FieldValue: { serverTimestamp: () => timestamp++ },
  messaging: { async send(message) {
    validateMessage(message);
    if (message.token === "invalid") throw Object.assign(new Error("invalid"), { code: "messaging/registration-token-not-registered" });
    sent.push(message);
  } }
});
const secret = "a".repeat(64);
const request = { auth: { uid: "u1", token: { email: "Owner@example.com", email_verified: true } },
  data: { token: "device-one", deviceSecret: secret, permission: "granted" } };
await assert.rejects(() => service.register({ data: { ...request.data, email: "victim@example.com" } }), { code: "unauthenticated" });
await assert.rejects(() => service.register({ ...request, auth: { uid: "u1", token: { email: "victim@example.com", email_verified: false } } }), { code: "unauthenticated" });
await assert.rejects(() => service.register({ ...request, data: { ...request.data, email: "victim@example.com" } }), { code: "permission-denied" });
const registered = await service.register(request);
const key = `notificationTokens/${registered.id}`;
const createdAt = records.get(key).createdAt;
assert.equal(records.get(key).email, "owner@example.com");
assert.equal(records.get(key).verified, true);
await service.register(request);
assert.equal(records.get(key).createdAt, createdAt, "Refreshing must preserve creation history");
assert.equal((await service.deviceStatus({ data: request.data })).status, "active");
await assert.rejects(() => service.deviceStatus({ data: { ...request.data, deviceSecret: "b".repeat(64) } }, true), { code: "permission-denied" });
await service.deviceStatus({ data: request.data }, true);
assert.equal(records.get(key).status, "inactive");
const proof = "c".repeat(64);
records.set("registrations/r1", { pushEnrollmentTokenHash: hash(proof), emailConfirmed: true, status: "confirmed", email: "guest@example.com", eventId: "event1", pushEnrollmentExpiresAt: { toMillis: () => Date.now() + 60000 } });
const guest = { data: { ...request.data, token: "guest-device", eventId: "event1", registrationProof: proof } };
await service.register(guest);
await assert.rejects(() => service.register({ data: { ...guest.data, eventId: "wrong" } }), { code: "permission-denied" });
records.get("registrations/r1").status = "cancelled";
await assert.rejects(() => service.register(guest), { code: "permission-denied" });
records.get("registrations/r1").status = "confirmed";
records.get("registrations/r1").pushEnrollmentExpiresAt = { toMillis: () => 0 };
await assert.rejects(() => service.register(guest), { code: "permission-denied" });
records.set("notificationTokens/bad", { token: "invalid", email: "delivery@example.com", verified: true, status: "active" });
records.set("notificationTokens/good", { token: "valid", email: "delivery@example.com", verified: true, status: "active" });
records.set("notificationTokens/legacy", { token: "legacy", email: "delivery@example.com", status: "active" });
const result = await service.deliver("delivery@example.com", { title: "Members", id: "n1", eventId: undefined });
assert.equal(result.attempted, 2);
assert.equal(result.sent, 1);
assert.equal(result.failed, 1);
assert.equal(records.get("notificationTokens/bad").status, "invalid");
assert.equal(records.get("notificationTokens/bad").lastErrorCode, "messaging/registration-token-not-registered");
assert.equal(sent[0].data.eventId, "");
assert.equal(sent[0].notification, undefined, "Only data payloads: no duplicate auto-notifications");

const worker = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
const display = await readFile(new URL("../public/assets/js/push-display.js", import.meta.url), "utf8");
const handlers = new Map();
const displayed = [];
let background;
let focused = 0;
let navigated = "";
const scope = { location: { origin: "https://prodigitaltv.web.app" },
  registration: { async showNotification(title, options) { displayed.push({ title, options }); } },
  addEventListener(name, fn) { handlers.set(name, fn); }, skipWaiting() {},
  clients: { async matchAll() { return [{ url: "https://prodigitaltv.web.app/#/home", async navigate(url) { navigated = url; return this; }, focus() { focused++; } }]; }, openWindow() { throw new Error("Must reuse existing tab"); } }
};
const ctx = vm.createContext({ self: scope, URL, console, firebase: { initializeApp() {}, messaging() { assert.ok(handlers.has("notificationclick")); return { onBackgroundMessage(fn) { background = fn; } }; } },
  importScripts(url) { if (url.includes("push-display")) vm.runInContext(display, ctx); }
});
vm.runInContext(worker, ctx);
await background({ notification: { title: "Legacy" } });
assert.equal(displayed.length, 0, "Firebase already displays legacy notification payloads");
await background({ data: { title: "Title", body: "Body", link: "/#/events", notificationId: "n1" } });
assert.equal(displayed.length, 1);
assert.equal(displayed[0].options.tag, "pdtv-n1");
assert.equal(scope.PROdigitalTVPush.safeLink("javascript:alert(1)"), "https://prodigitaltv.web.app/");
let clickPromise;
handlers.get("notificationclick")({ notification: { data: displayed[0].options.data, close() {} }, stopImmediatePropagation() {}, waitUntil(promise) { clickPromise = promise; } });
await clickPromise;
assert.equal(navigated, "https://prodigitaltv.web.app/#/events");
assert.equal(focused, 1);
console.log("Push security, delivery, background display and click tests passed. No messages sent.");
