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
  assert.match(html, /→ Einchecken · ← Löschen/);
});

test("Wischgesten und sichere Löschbestätigung sind verdrahtet", () => {
  assert.match(source, /list\.addEventListener\("pointerdown"/);
  assert.match(source, /list\.addEventListener\("pointerup", finishSwipe\)/);
  assert.match(source, /Math\.abs\(dx\) < 64/);
  assert.match(source, /Die Anmeldung wird dauerhaft gelöscht/);
  assert.match(source, /await remove\(record\.id\)/);
  assert.match(mainSource, /remove: async \(registrationId\) => \(await registrationService\(\)\)\.deleteAdminRegistration\(registrationId\)/);
});
