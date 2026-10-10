const test = require("node:test");
const assert = require("node:assert/strict");
const { eligibleGuestCandidates, guestPasswordNeedsSetup, guestIdentityConflict } = require("./eventGuestLoginDomain");

test("only confirmed event people can request a start password", () => {
  const bookings = [
    { id: "a", status: "pending_email_confirmation", email: "pending@example.com" },
    { id: "b", status: "confirmed", email: "guest@example.com", firstName: "Max", companion: { email: "friend@example.com", firstName: "Eva" } },
    { id: "c", status: "checked_in", email: "arrived@example.com" }
  ];
  assert.equal(eligibleGuestCandidates(bookings, "pending@example.com").length, 0);
  assert.equal(eligibleGuestCandidates(bookings, " GUEST@EXAMPLE.COM ")[0].registrationId, "b");
  assert.equal(eligibleGuestCandidates(bookings, "friend@example.com")[0].person.firstName, "Eva");
  assert.equal(eligibleGuestCandidates(bookings, "arrived@example.com").length, 1);
});

test("a known password is not replaced and prepared accounts receive setup", () => {
  assert.equal(guestPasswordNeedsSetup(null), true);
  assert.equal(guestPasswordNeedsSetup({ uid: "existing" }, { role: "guest" }), false);
  assert.equal(guestPasswordNeedsSetup({ uid: "existing" }, { createdVia: "event_guest_preparation", guestPasswordTemporary: false }), false);
  assert.equal(guestPasswordNeedsSetup({ uid: "prepared" }, { createdVia: "event_guest_preparation", guestPasswordTemporary: true }), true);
  assert.equal(guestPasswordNeedsSetup({ uid: "prepared" }, { createdVia: "event_guest_preparation", guestPasswordSetAt: "today" }), false);
  assert.equal(guestPasswordNeedsSetup({ uid: "temporary" }, { guestPasswordTemporary: true }), true);
});

test("another person sharing an email is blocked without rejecting a spelling variant", () => {
  assert.equal(guestIdentityConflict({ firstName: "Max" }, { firstName: "Klaus" }), true);
  assert.equal(guestIdentityConflict({ firstName: "Margot", lastName: "Schohmann" }, { firstName: "Margot", lastName: "Schomann" }), false);
});
