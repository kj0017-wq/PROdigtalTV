import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { cockpitCheckinRows } from "../src/utils/cockpitCheckin.js";

const source = await readFile(new URL("../src/utils/cockpitCheckin.js", import.meta.url), "utf8");
const mainSource = await readFile(new URL("../src/main.js", import.meta.url), "utf8");

test("Gästeliste bietet Einchecken und Löschen je Anmeldung", () => {
  const html = cockpitCheckinRows([
    { id: "open", eventId: "event", firstName: "Anna", status: "confirmed" },
    { id: "done", eventId: "event", firstName: "Ben", status: "checked_in" }
  ], "event");
  assert.match(html, /data-cockpit-checkin-id="open"/);
  assert.match(html, /data-cockpit-delete-id="open"/);
  assert.match(html, /data-cockpit-delete-id="done"/);
  assert.match(html, /→ Check-in · ← Löschen/);
  assert.match(html, /cockpit-checkin-swipe-action--check/);
  assert.match(html, /cockpit-checkin-swipe-action--delete/);
  assert.match(html, /<span>Check-in<\/span>/);
  assert.match(html, /<span>Löschen<\/span>/);
  assert.doesNotMatch(html, /class="button button--secondary" data-cockpit-checkin-id/);
  assert.doesNotMatch(html, /class="button button--danger" data-cockpit-delete-id/);
  assert.match(html, /cockpit-checkin-swipe is-alt/);
});

test("Wischgesten und sichere Löschbestätigung sind verdrahtet", () => {
  assert.match(source, /list\.addEventListener\("pointerdown"/);
  assert.match(source, /list\.addEventListener\("pointerup", finishSwipe\)/);
  assert.match(source, /Math\.abs\(dx\) < 36/);
  assert.match(source, /classList\.toggle\("is-checking"/);
  assert.match(source, /classList\.toggle\("is-deleting"/);
  assert.match(source, /row\.style\.transform = `translateX\(\$\{checking \? 72 : -72\}px\)`/);
  assert.match(source, /Die Anmeldung wird dauerhaft gelöscht/);
  assert.match(source, /await remove\(record\.id\)/);
  assert.match(mainSource, /remove: async \(registrationId\) => \(await registrationService\(\)\)\.deleteAdminRegistration\(registrationId\)/);
});
