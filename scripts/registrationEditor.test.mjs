import assert from "node:assert/strict";
import test from "node:test";
import { registrationEditorPatch, registrationEditorValues } from "../src/utils/registrationEditor.js";

test("bearbeitet die Hauptperson ohne andere Buchungsdaten zu überschreiben", () => {
  const registration = { id: "r1", firstName: "Max", lastName: "Alt", eventId: "e1", status: "confirmed" };
  assert.deepEqual(registrationEditorValues(registration), {
    firstName: "Max", lastName: "Alt", company: "", position: "", email: "", phone: "", linkedIn: ""
  });
  const patch = registrationEditorPatch(registration, "Hauptperson", { firstName: "Max", lastName: "Neu", phone: " +49 170 123 " });
  assert.equal(patch.id, "r1");
  assert.equal(patch.lastName, "Neu");
  assert.equal(patch.phone, "+49 170 123");
  assert.equal("eventId" in patch, false);
});

test("bearbeitet eine Begleitperson innerhalb der bestehenden Buchung", () => {
  const registration = { id: "r2", companion: { firstName: "Eva", lastName: "Alt", dietaryNotes: "vegan" } };
  const patch = registrationEditorPatch(registration, "Begleitperson", { firstName: "Eva", lastName: "Neu", phone: "+49151" });
  assert.equal(patch.id, "r2");
  assert.equal(patch.companion.lastName, "Neu");
  assert.equal(patch.companion.phone, "+49151");
  assert.equal(patch.companion.dietaryNotes, "vegan");
});
