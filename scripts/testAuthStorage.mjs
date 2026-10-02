import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const source = await readFile("src/firebase/authService.js", "utf8");
const storageFunctions = source.slice(source.indexOf("function writeUserStorage"), source.indexOf("function isLocalHost"));
const currentUser = source.slice(source.indexOf("export function currentUser"), source.indexOf("export function authDebugState")).replace("export function", "function");
function storage(full = false, blocked = false) {
  const entries = new Map([["pdtv-page-content-old", "cache"], ["ticket", "keep"]]);
  return {
    entries, get length() { return entries.size; }, key: (index) => [...entries.keys()][index],
    getItem: (key) => entries.get(key) || null, removeItem: (key) => entries.delete(key),
    setItem(key, value) { if (blocked || (full && entries.has("pdtv-page-content-old"))) throw new Error("quota"); entries.set(key, value); }
  };
}
for (const blocked of [false, true]) {
  const sessionStorage = storage(true, blocked), localStorage = storage(true, blocked);
  const global = { sessionStorage, localStorage };
  const api = new Function("sessionStorage", "localStorage", "globalThis",
    'const USER_KEY="prodigitaltv-user";' + storageFunctions + currentUser + ";return {storeUser,currentUser,clearStoredUser};")(sessionStorage, localStorage, global);
  const user = { uid: "guest", email: "guest@example.com" };
  assert.doesNotThrow(() => api.storeUser(user));
  assert.deepEqual(api.currentUser(), user);
  assert.equal(localStorage.entries.get("ticket"), "keep");
  assert.equal(localStorage.entries.has("pdtv-page-content-old"), false);
  api.clearStoredUser();
  assert.equal(api.currentUser(), null);
}
console.log("Login storage: quota cleanup, preserved tickets, memory fallback and logout passed.");
