import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { webcrypto } from "node:crypto";

const source = (await readFile(new URL("../src/firebase/pushClient.js", import.meta.url), "utf8"))
  .replace(/^import .*;\r?\n/gm, "")
  .replace(/export /g, "")
  .replace('import("https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging.js")', "Promise.resolve(mockLib)")
  .replace('import("/assets/js/push-display.js?v=4")', "Promise.resolve()");
const events = [];
const storage = new Map();
let foreground;
let serverDown = false;
let registrationDown = false;
let displayed = 0;
let unsubscribed = 0;
const registration = { active: {}, showNotification: async () => {}, pushManager: { getSubscription: async () => null } };
const Notification = { permission: "default", requestPermission: async () => { events.push("permission"); Notification.permission = "granted"; return "granted"; } };
const firebase = {
  app: {}, db: {}, functions: {},
  auth: { currentUser: { uid: "owner", reload: async () => {}, getIdToken: async () => "auth" } },
  firestore: { doc: () => ({}), getDoc: async () => ({ data: () => ({}) }) },
  functionsLib: { httpsCallable: (_, name) => async () => {
    events.push(name);
    if (registrationDown && name === "registerNotificationToken") throw new Error("offline");
    if (serverDown && name === "disableBrowserPush") throw new Error("offline");
    return { data: { status: "active", email: "owner@example.test" } };
  } }
};
const context = vm.createContext({
  setTimeout, clearTimeout, Uint8Array, crypto: webcrypto, Date,
  Notification, location: { origin: "https://example.test" }, matchMedia: () => ({ matches: false }),
  window: { isSecureContext: true, Notification, serviceWorker: {}, PushManager: {}, addEventListener() {}, PROdigitalTVPush: { show: async () => { displayed++; } } },
  document: { querySelectorAll: () => [], addEventListener() {} },
  navigator: { userAgent: "Desktop", platform: "Windows", serviceWorker: { register: async () => registration, ready: Promise.resolve(registration), getRegistration: async () => registration } },
  localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
  getFirebaseServices: async () => { events.push("firebase"); return firebase; }, readStoredTicket: () => null,
  mockLib: { isSupported: async () => true, getMessaging: () => ({}),
    onMessage: (_, fn) => { events.push("listener"); foreground = fn; return () => {}; },
    getToken: async (_, options) => {
      assert.equal(options.serviceWorkerRegistration, registration);
      return "fake-device-token";
    }, deleteToken: async () => { throw new Error("Unexpected default Firebase worker registration"); } }
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
registration.pushManager.getSubscription = async () => ({ unsubscribe: async () => { unsubscribed++; return true; } });
await assert.rejects(context.disableBrowserNotifications(), /nachgeholt/);
assert.equal(JSON.parse(storage.get("pdtv-push-device-v1")).pendingDisable, true);
assert.equal(unsubscribed, 1);
serverDown = false;
await context.refreshBrowserPush();
assert.equal(JSON.parse(storage.get("pdtv-push-device-v1")).pendingDisable, false);
assert.equal(JSON.parse(storage.get("pdtv-push-device-v1")).status, "inactive");
await context.enableBrowserNotifications({ requestPermission: false });
assert.equal(JSON.parse(storage.get("pdtv-push-device-v1")).status, "active", "Reactivation uses the explicit app worker without default-worker deletion");
storage.set("pdtv-push-device-v1", JSON.stringify({ status: "inactive" }));
registration.pushManager.getSubscription = async () => null;
Notification.permission = "denied";
await assert.rejects(context.enableBrowserNotifications(), /blockiert/);
context.navigator.userAgent = "iPhone";
await assert.rejects(context.enableBrowserNotifications(), /Home-Bildschirm/);
context.navigator.userAgent = "Desktop";
Notification.permission = "granted";
const listeners = new Map();
const controls = new Map(["status", "enable", "disable", "test"].map(name => [`[data-push-${name}]`, { addEventListener: (event, fn) => listeners.set(`${name}:${event}`, fn) }]));
context.document.querySelectorAll = () => [{ dataset: {}, querySelector: selector => controls.get(selector) }];
context.location.href = "https://example.test/#/profile";
context.wirePushControls();
const networkCalls = events.length;
let localNotification;
registration.showNotification = async (title, options) => { localNotification = { title, options }; };
await listeners.get("test:click")();
assert.equal(localNotification.title, "PROdigitalTV Anzeigetest");
assert.equal(events.length, networkCalls, "Local display test must not depend on Firebase");
assert.match(controls.get("[data-push-status]").textContent, /noch nicht den Push-Empfang/);
registration.showNotification = async () => { throw new Error("display denied"); };
await listeners.get("test:click")();
assert.match(controls.get("[data-push-status]").textContent, /Lokale Anzeige fehlgeschlagen: display denied/);
assert.equal(controls.get("[data-push-test]").disabled, false);
const title = {};
const banner = { hidden: true, hasAttribute: name => name === "data-push-prominent", querySelector: selector => selector === "strong" ? title : controls.get(selector) };
context.document.querySelectorAll = () => [banner];
context.updateControls();
assert.equal(banner.hidden, false, "Inactive push must show a prominent warning");
storage.set("pdtv-push-device-v1", JSON.stringify({ status: "active", token: "test" }));
context.updateControls();
assert.equal(banner.hidden, true, "Active push must remove the warning");
Notification.permission = "denied";
context.updateControls();
assert.equal(banner.hidden, false);
assert.match(title.textContent, /blockiert/);
assert.equal(controls.get("[data-push-enable]").disabled, true);
context.navigator.standalone = false;
assert.equal(await context.requiredGuestChatPushState(), "install");
context.navigator.standalone = true;
assert.equal(await context.requiredGuestChatPushState(), "push");
Notification.permission = "granted";
assert.equal(await context.requiredGuestChatPushState(), "push", "A different user's device cannot unlock the chat");
storage.set("pdtv-push-device-v1", JSON.stringify({ status: "active", token: "test", uid: "owner" }));
assert.equal(await context.requiredGuestChatPushState(), "push", "A subscription is required");
registration.pushManager.getSubscription = async () => ({ endpoint: "test" });
assert.equal(await context.requiredGuestChatPushState(), "ready");
console.log("Push client, guest prerequisites and local display tests passed. No messages sent.");


// Refresh is allowed to repair an existing opt-in, but never to revoke it for a temporary context.
registration.pushManager.getSubscription = async () => ({ endpoint:"test",unsubscribe:async()=>{ unsubscribed++;return true; } });
const enabledDevice = { token:"fake-device-token",deviceSecret:"secret",status:"active",uid:"owner",eventId:"event" };
const refresh = async () => { vm.runInContext("lastRefresh = 0;",context); await context.refreshBrowserPush(); };
context.document.querySelectorAll = () => [];
context.navigator.standalone = true;
Notification.permission = "granted";
storage.set("pdtv-push-device-v1",JSON.stringify(enabledDevice));
firebase.auth.currentUser = null;
let beforeDisable = events.filter(name=>name==="disableBrowserPush").length;
await refresh();
assert.equal(JSON.parse(storage.get("pdtv-push-device-v1")).status,"active","A temporarily missing login must preserve activation");
assert.equal(events.filter(name=>name==="disableBrowserPush").length,beforeDisable);
firebase.auth.currentUser = {uid:"owner",reload:async()=>{},getIdToken:async()=>"auth"};
context.navigator.userAgent = "iPhone";
context.navigator.standalone = false;
await refresh();
assert.equal(JSON.parse(storage.get("pdtv-push-device-v1")).status,"active","Opening an iPhone browser instead of the installed app must not revoke the device");
assert.equal(events.filter(name=>name==="disableBrowserPush").length,beforeDisable);
context.navigator.userAgent = "Desktop";
context.navigator.standalone = true;
storage.set("pdtv-push-device-v1",JSON.stringify({...enabledDevice,status:"inactive"}));
let permissionRequests = events.filter(name=>name==="permission").length;
await refresh();
assert.equal(JSON.parse(storage.get("pdtv-push-device-v1")).status,"active","An existing browser permission repairs a legacy inactive link silently");
assert.equal(events.filter(name=>name==="permission").length,permissionRequests);
registrationDown = true;
await refresh();
assert.equal(JSON.parse(storage.get("pdtv-push-device-v1")).status,"active","A network failure must not mark an activated device inactive");
registrationDown = false;
await context.disableBrowserNotifications();
assert.equal(JSON.parse(storage.get("pdtv-push-device-v1")).disabledByUser,true);
const registerCount = events.filter(name=>name==="registerNotificationToken").length;
await refresh();
assert.equal(events.filter(name=>name==="registerNotificationToken").length,registerCount,"Explicit disable must never be silently reversed");
await context.enableBrowserNotifications({requestPermission:false});
assert.equal(JSON.parse(storage.get("pdtv-push-device-v1")).status,"active");
firebase.auth.currentUser = {uid:"different-user",reload:async()=>{},getIdToken:async()=>"auth"};
await refresh();
assert.equal(JSON.parse(storage.get("pdtv-push-device-v1")).status,"inactive","A confirmed account switch must detach the previous user's subscription");
assert.equal(JSON.parse(storage.get("pdtv-push-device-v1")).disabledByUser,false);
assert.equal(events.filter(name=>name==="permission").length,permissionRequests);
assert.equal(source.includes('insertAdjacentHTML("afterend", pushControls'),false,"No prominent repeated event banner");
console.log("Refresh regression checks passed: missing login, browser context, silent repair, offline, opt-out and account switch.");
