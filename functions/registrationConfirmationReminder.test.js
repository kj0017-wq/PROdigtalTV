const test = require("node:test");
const assert = require("node:assert/strict");
const { confirmationReminderIsDue, confirmationReminderCanSend } = require("./registrationConfirmationReminder");

const now = Date.parse("2026-09-25T12:00:00Z");
const pending = { status: "pending_email_confirmation", email: "gast@example.com", confirmationTokenHash: "hash", createdAt: new Date(now - 24 * 60 * 60 * 1000) };

test("reminder is due after 24 hours for an unconfirmed registration", () => {
  assert.equal(confirmationReminderIsDue(pending, now), true);
  assert.equal(confirmationReminderIsDue({ ...pending, createdAt: { toMillis: () => now - 24 * 60 * 60 * 1000 } }, now), true);
  assert.equal(confirmationReminderIsDue({ ...pending, createdAt: new Date(now - 24 * 60 * 60 * 1000 + 1) }, now), false);
});

test("confirmed, already reminded, and incomplete registrations are skipped", () => {
  assert.equal(confirmationReminderIsDue({ ...pending, emailConfirmed: true }, now), false);
  assert.equal(confirmationReminderIsDue({ ...pending, status: "confirmed" }, now), false);
  assert.equal(confirmationReminderIsDue({ ...pending, status: "expired" }, now), false);
  assert.equal(confirmationReminderIsDue({ ...pending, confirmationReminderQueuedAt: new Date() }, now), false);
  assert.equal(confirmationReminderIsDue({ ...pending, confirmationTokenHash: "" }, now), false);
});

test("queued reminder is sent only while the new token is current and registration is open", () => {
  const queued = { ...pending, confirmationReminderQueuedAt: new Date(now) };
  assert.equal(confirmationReminderCanSend(queued, "hash"), true);
  assert.equal(confirmationReminderCanSend(queued, "old-hash"), false);
  assert.equal(confirmationReminderCanSend({ ...queued, emailConfirmed: true }, "hash"), false);
});
