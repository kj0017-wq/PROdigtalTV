import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const worker = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
const display = await readFile(new URL("../public/assets/js/push-display.js", import.meta.url), "utf8");
for (const sdkAvailable of [true, false]) {
  const handlers = new Map();
  const shown = [];
  let firebasePushes = 0;
  const scope = {
    location: { origin: "https://prodigitaltv.de" },
    registration: { async showNotification(title, options) { shown.push({ title, options }); } },
    addEventListener(name, fn) { handlers.set(name, [...(handlers.get(name) || []), fn]); },
    skipWaiting() {}
  };
  const ctx = vm.createContext({ self: scope, URL, console: { warn() {} },
    firebase: { initializeApp() {}, messaging() {
      scope.addEventListener("push", () => { firebasePushes++; });
      return { onBackgroundMessage() {} };
    } },
    importScripts(url) {
      if (url.includes("push-display")) vm.runInContext(display, ctx);
      else if (!sdkAvailable) throw new Error("SDK unavailable");
    }
  });
  vm.runInContext(worker, ctx);
  async function push(payload, malformed = false) {
    const pending = [];
    let stopped = false;
    const event = { data: { json() { if (malformed) throw new Error("invalid JSON"); return payload; } },
      stopImmediatePropagation() { stopped = true; }, waitUntil(promise) { pending.push(promise); } };
    for (const fn of handlers.get("push")) { fn(event); if (stopped) break; }
    await Promise.all(pending);
  }
  await push({ data: { title: "Data", body: "Test", notificationId: "one", link: "/#/events" } });
  await push({ notification: { title: "Notification", body: "Test" }, data: { notificationId: "two" } });
  assert.equal(shown.length, 2, "Both payload formats display without Firebase dependency");
  assert.equal(shown[1].title, "Notification");
  assert.equal(firebasePushes, 0, "No duplicate SDK display or foreground forwarding");
  assert.equal(shown[0].options.data.link, "https://prodigitaltv.de/#/events");
  await push({}, true);
  await push({});
  assert.equal(shown.length, 2, "Unrecognized payloads are not displayed by own handler");
  scope.registration.showNotification = async () => { throw new Error("display failed"); };
  await assert.rejects(push({ data: { notificationId: "three" } }), /display failed/);
}
console.log("Native push tests passed with and without Firebase SDK. No messages sent.");
