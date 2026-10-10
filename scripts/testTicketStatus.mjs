import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { eventCard } from "../src/components/cards.js";
const event = { id: "test", date: "2026-10-01", title: "Event", accessType: "public" };
for (const [status, label] of [["confirmed", "Angemeldet"], ["checked_in", "Eingecheckt"], ["", "Angemeldet"]]) {
  const html = eventCard({ ...event, storedTicket: { ticketToken: "test", status } });
  assert.ok(html.includes(`<strong>${label}</strong>`));
  assert.ok(!html.includes("Handy-Ticket aktiv"));
}
assert.ok(eventCard({ ...event, myRegistration: { status: "checked_in", emailConfirmed: false } }).includes("Eingecheckt"));
assert.ok(eventCard({ ...event, storedTicket: { status: "confirmed" }, myRegistration: { status: "checked_in" } }).includes("Eingecheckt"));
assert.ok(eventCard({ ...event, myRegistration: { status: "waitlist", emailConfirmed: true } }).includes("Warteliste"));
const source = (await readFile(new URL("../src/firebase/registrationService.js", import.meta.url), "utf8")).replace(/^import .*;\r?\n/gm, "").replaceAll("export ", "");
const storage = new Map();
let fail = false;
const ctx = vm.createContext({ Date, location: { protocol: "https:" }, document: { cookie: "" },
  localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
  getFirebaseServices: async () => ({ functions: {}, functionsLib: { httpsCallable: (_, name) => async () => {
    if (fail) throw new Error("offline");
    return { data: name === "validateRegistrationTicket" ? { valid: true, status: "checked_in", eventId: "test" } : { checkedIn: true, eventId: "test" } };
  } } })
});
vm.runInContext(source, ctx);
ctx.storeTicket({ eventId: "test", ticketToken: "secret", status: "confirmed" });
fail = true;
await assert.rejects(ctx.checkInWithStoredTicket("test"), /offline/);
assert.equal(ctx.readStoredTicket("test").status, "confirmed");
fail = false;
await ctx.checkInWithStoredTicket("test");
assert.equal(ctx.readStoredTicket("test").status, "checked_in");
assert.equal(ctx.readStoredTicket("test").ticketToken, "secret");
ctx.storeTicket({ eventId: "test", ticketToken: "secret" });
await ctx.validateStoredTicket("test");
assert.equal(ctx.readStoredTicket("test").status, "checked_in");
assert.equal(ctx.readStoredTicket("test").valid, undefined, "Local state must not masquerade as fresh server validation");
ctx.storeTicket({ eventId: "test", registrationId: "klaus", ticketToken: "klaus-secret", firstName: "Klaus", status: "checked_in" });
ctx.storeTicket({ eventId: "test", registrationId: "max", ticketToken: "max-secret", firstName: "Max", status: "confirmed" });
assert.equal(ctx.listStoredTickets("test").length, 3);
assert.equal(ctx.readStoredTicket("test").firstName, "Max");
ctx.selectStoredTicket("test", "klaus");
assert.equal(ctx.readStoredTicket("test").firstName, "Klaus");
ctx.clearStoredTicket("test");
assert.equal(ctx.listStoredTickets("test").length, 2);
assert.equal(ctx.listStoredTickets("test").some((ticket) => ticket.firstName === "Max"), true);
console.log("Ticket status, multiple people, persistence and failed-check-in tests passed.");
