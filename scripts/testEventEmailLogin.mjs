import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const source = (await readFile("src/utils/eventEmailLogin.js", "utf8")).replace(/^import .*;\r?\n/gm, "").replaceAll("export function", "function").replaceAll("export async function", "async function");
const location = { href: "https://prodigitaltv.de/?mode=signIn&oobCode=test#/event-live/event?peer=person&email=test%40example.invalid", pathname: "/", hash: "#/event-live/event?peer=person&email=test%40example.invalid" };
const stored = new Map();
let nextUrl, signedIn = false, refreshed = false;
const service = { auth: {}, authLib: {
  isSignInWithEmailLink: () => true, browserLocalPersistence: "local",
  setPersistence: async (auth, persistence) => assert.equal(persistence, "local"),
  signInWithEmailLink: async (auth, email, link) => { assert.equal(email, "test@example.invalid"); assert.ok(link.includes("oobCode=test")); signedIn = true; }
} };
const api = new Function("getFirebaseServices", "refreshAuthToken", "location", "localStorage", "history", source + ";return {eventLoginEmail,completeEventEmailLogin};")(async () => service, async () => { refreshed = true; }, location, { getItem: key => stored.get(key), setItem: (key, value) => stored.set(key, value) }, { replaceState: (a, b, url) => { nextUrl = url; } });
assert.equal(api.eventLoginEmail(), "test@example.invalid");
assert.equal(await api.completeEventEmailLogin(api.eventLoginEmail()), true);
assert.equal(signedIn && refreshed, true);
assert.equal(nextUrl, "/#/event-live/event?peer=person");
service.authLib.isSignInWithEmailLink = () => false;
assert.equal(await api.completeEventEmailLogin("test@example.invalid"), false);
service.authLib.isSignInWithEmailLink = () => true;
service.authLib.signInWithEmailLink = async () => { throw new Error("expired"); };
await assert.rejects(api.completeEventEmailLogin("test@example.invalid"), /expired/);
console.log("Email login: prefill, persistence, peer retained, token removed and failure handling passed.");
