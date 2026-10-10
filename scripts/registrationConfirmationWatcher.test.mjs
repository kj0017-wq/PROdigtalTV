import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
test("desktop notices confirmation on another device and stops watching", async () => {
  const timers = [];
  const listeners = new Map();
  let confirmed = false;
  let calls = 0;
  let updates = 0;
  const context = {
    getRegistrationConfirmationStatus: async () => { calls++; return { confirmed, status: confirmed ? "confirmed" : "pending_email_confirmation" }; },
    form: { isConnected: true },
    registration: { id: "r", statusToken: "secret" },
    onConfirmed: () => updates++,
    document: { visibilityState: "visible", body: {}, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener() {} },
    window: { setTimeout: (fn) => { timers.push(fn); return timers.length; }, clearTimeout() {}, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener() {} },
    MutationObserver: class { observe() {} disconnect() {} }
  };
  const source = readFileSync(new URL("../src/utils/registrationConfirmationWatcher.js", import.meta.url), "utf8")
    .replace(/^import .*;\r?\n/, "").replace("export function", "function");
  vm.runInNewContext(source + ";watchRegistrationConfirmation(form, registration, onConfirmed);", context);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 1);
  assert.equal(updates, 0);
  context.document.visibilityState = "hidden";
  await timers.pop()();
  assert.equal(calls, 1);
  confirmed = true;
  context.document.visibilityState = "visible";
  listeners.get("focus")();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 2);
  assert.equal(updates, 1);
  listeners.get("focus")();
  assert.equal(calls, 2);
});
