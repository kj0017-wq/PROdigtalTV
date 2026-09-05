import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { webcrypto } from "node:crypto";

const source = (await readFile(new URL("../src/firebase/pushClient.js", import.meta.url), "utf8"))
  .replace(/^import .*;\r?\n/gm, "")
  .replace(/export /g, "")
  .replace('import("https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging.js")', "Promise.resolve(mockLib)")
  .replace('import("/assets/js/push-display.js?v=1")', "Promise.resolve()");
const events = [];
const storage = new Map();
let foreground;
let serverDown = false;
let displayed = 0;
const registration = { active: {}, showNotification: async () => {}, pushManager: { getSubscription: async () => null } };
const Notification = { permission: "default", requestPermission: async () => { events.push("permission"); Notification.permission = "granted"; return "granted"; } };
const firebase = {
  app: {}, db: {}, functions: {},
  auth: { currentUser: { uid: "owner", reload: async () => {}, getIdToken: async () => "auth" } },
  firestore: { doc: () => ({}), getDoc: async () => ({ data: () => ({}) }) },
  functionsLib: { httpsCallable: (_, name) => async () => {
    events.push(name);
    if (serverDown && name === "disableBrowserPush") throw new Error("offline");
    return { data: { status: "active", email: "owner@example.test" } };
  } }
};
const context = vm.createContext({
  setTimeout, clearTimeout, Uint8Array, crypto: webcrypto, Date,
  Notification, location: { origin: "https://example.test" }, matchMedia: () => ({ matches: false }),
  window: { isSecureContext: true, Notification, PushManager: {}, addEventListener() {}, PROdigitalTVPush: { show: async () => { displayed++; } } },
  document: { querySelectorAll: () => [], addEventListener() {} },
  navigator: { userAgent: "Desktop", platform: "Windows", serviceWorker: { register: async () => registration, ready: Promise.resolve(registration), getRegistration: async () => registration } },
  localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
  getFirebaseServices: async () => { events.push("firebase"); return firebase; }, readStoredTicket: () => null,
  mockLib: { isSupported: async () => true, getMessaging: () => ({}),
    onMessage: (_, fn) => { events.push("listener"); foreground = fn; return () => {}; },
    getToken: async () => "fake-device-token", deleteToken: async () => { events.push("deleteToken"); return true; } }
});
vm.runInContext(source, context);
await context.enableBrowserNotifications();
assert.equal(events[0], "permission", "Permission must precede Firebase/network work");
assert.equal(JSON.parse(storage.get("pdtv-push-device-v1")).status, "active");
await foreground({ data: { title: "Test" } });
assert.equal(displayed, 1);
await context.enableBrowserNotifications({ requestPermission: false });
assert.equal(events.filter(x => x === "permission").length, 1);
assert.equal(events.filter(x => x === "listener").length, 1);
serverDown = true;
await assert.rejects(context.disableBrowserNotifications(), /nachgeholt/);
assert.equal(JSON.parse(storage.get("pdtv-push-device-v1")).pendingDisable, true);
assert.ok(events.includes("deleteToken"));
serverDown = false;
await context.refreshBrowserPush();
assert.equal(JSON.parse(storage.get("pdtv-push-device-v1")).pendingDisable, false);
assert.equal(JSON.parse(storage.get("pdtv-push-device-v1")).status, "inactive");
Notification.permission = "denied";
await assert.rejects(context.enableBrowserNotifications(), /blockiert/);
context.navigator.userAgent = "iPhone";
await assert.rejects(context.enableBrowserNotifications(), /Home-Bildschirm/);
console.log("Push client gesture, foreground, refresh, disable and support tests passed. No messages sent.");
