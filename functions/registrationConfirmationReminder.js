const REMINDER_DELAY_MS = 24 * 60 * 60 * 1000;

function timestampMillis(value) {
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value === "string" || value instanceof Date) return new Date(value).getTime();
  return 0;
}

function confirmationReminderIsDue(registration = {}, now = Date.now()) {
  if (registration.status !== "pending_email_confirmation" || registration.emailConfirmed === true) return false;
  if (!registration.email || !registration.confirmationTokenHash || registration.confirmationReminderQueuedAt) return false;
  const createdAt = timestampMillis(registration.createdAt);
  return createdAt > 0 && createdAt + REMINDER_DELAY_MS <= now;
}

function confirmationReminderCanSend(registration = {}, tokenHash = "") {
  return registration.status === "pending_email_confirmation"
    && registration.emailConfirmed !== true
    && Boolean(tokenHash)
    && tokenHash === registration.confirmationTokenHash;
}

module.exports = { confirmationReminderIsDue, confirmationReminderCanSend };
