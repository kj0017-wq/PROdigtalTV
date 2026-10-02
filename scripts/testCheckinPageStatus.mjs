import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../src/pages/publicPages.js", import.meta.url), "utf8");
const page = source.slice(source.indexOf("export async function eventCheckinPage("), source.indexOf("export async function eventCheckinScreenPage(")).replace("export ", "");
let ticket = null;
let user = null;
let registrations = [];
const context = vm.createContext({ URLSearchParams, encodeURIComponent,
  getPublicRouteEvent: async () => ({ id: "heuking", title: "HEUKING" }),
  validateStoredTicket: async () => ticket,
  currentUser: () => user,
  listMyEventRegistrations: async () => registrations,
  publicShell: (_, html) => html, subhero: (...text) => text.join(" "),
  escapeHtml: value => String(value || "").replaceAll("<", "&lt;"),
  registrationPartyLabel: item => item.firstName || "Gast", eventRegistrationIsOpen: () => true
});
vm.runInContext(page, context);
const render = query => context.eventCheckinPage("heuking", new URLSearchParams(query));
ticket = { eventId: "heuking", ticketToken: "test", valid: true, status: "checked_in" };
assert.match(await render(), /Sie sind bereits eingecheckt/);
assert.doesNotMatch(await render(), /data-confirm-ticket-checkin/);
ticket = null;
user = { uid: "user" };
registrations = [{ eventId: "heuking", status: "checked_in" }];
assert.match(await render("access=test"), /Sie sind bereits eingecheckt/);
registrations = [{ eventId: "other", status: "checked_in" }];
assert.doesNotMatch(await render(), /Sie sind bereits eingecheckt/);
registrations = [{ eventId: "heuking", status: "confirmed" }];
assert.match(await render(), /Ihre Anmeldung ist vorhanden/);
assert.doesNotMatch(await render(), /Sie sind bereits eingecheckt|Jetzt zur Anmeldung/);
assert.match(await render("access=test"), /data-entrance-link/);
user = null;
assert.match(await render(), /Handy-Ticket verknüpfen/);
assert.doesNotMatch(await render(), /noch keine Anmeldung|Sie sind bereits eingecheckt/);
ticket = { eventId: "heuking", ticketToken: "test", valid: true, status: "confirmed" };
assert.match(await render("registered=1"), /Noch nicht eingecheckt/);
assert.doesNotMatch(await render("registered=1"), /erfolgreich eingecheckt/);
ticket = { eventId: "heuking", ticketToken: "test", status: "checked_in" };
assert.doesNotMatch(await render(), /Sie sind bereits eingecheckt/);
assert.match(await render(), /konnte nicht bestätigt werden/);
console.log("Check-in status tests passed: ticket, account, missing token, other event, unverified status, forged query.");
