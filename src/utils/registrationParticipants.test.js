import test from "node:test";
import assert from "node:assert/strict";
import { registrationParticipants } from "./registrationParticipants.js";
import { registrationsCsv } from "./csv.js";

test("companion is listed separately without inheriting the booker's consent", () => {
  const rows = registrationParticipants([{
    id: "booking-1", eventId: "event-1", firstName: "Beate", email: "beate@example.com",
    privacyAccepted: true, newsletterConsent: true, status: "confirmed",
    companion: { firstName: "Alex", lastName: "Busch", email: "alex@example.com", phone: "+491701234567" }
  }]);
  assert.equal(rows.length, 2);
  assert.equal(rows[1].participantRole, "Begleitperson");
  assert.equal(rows[1].bookingId, "booking-1");
  assert.equal(rows[1].email, "alex@example.com");
  assert.equal(rows[1].newsletterConsent, undefined);
  assert.equal(rows[1].privacyAccepted, undefined);
  assert.equal(rows[1].status, "confirmed");
});

test("a booking without companion stays a single participant", () => {
  assert.equal(registrationParticipants([{ id: "booking-2", email: "solo@example.com" }]).length, 1);
});

test("registration export contains a separate companion row", () => {
  const csv = registrationsCsv({}, [{
    id: "booking-1", firstName: "Beate", email: "beate@example.com", newsletterConsent: true,
    companion: { firstName: "Alex", email: "alex@example.com" }
  }]);
  const rows = csv.trim().split("\r\n");
  assert.equal(rows.length, 3);
  assert.match(rows[2], /"Begleitperson"/);
  assert.match(rows[2], /"alex@example.com"/);
  assert.doesNotMatch(rows[2], /"ja"/);
});
