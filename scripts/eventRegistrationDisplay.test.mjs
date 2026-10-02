import assert from "node:assert/strict";
import { eventRegistrationCtaState } from "../src/utils/eventRegistrationDisplay.js";

assert.equal(eventRegistrationCtaState({ registrationAllowed: true }), "open");
assert.equal(eventRegistrationCtaState({ registrationAllowed: false }), "closed");
assert.equal(eventRegistrationCtaState({ registrationAllowed: true, storedTicket: { status: "confirmed" } }), "confirmed");
assert.equal(eventRegistrationCtaState({ registrationAllowed: true, storedTicket: { status: "checked_in" } }), "checked_in");

console.log("Confirmed and checked-in guests never receive another registration CTA.");
