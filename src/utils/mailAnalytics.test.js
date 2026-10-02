import test from "node:test";
import assert from "node:assert/strict";
import { eventMailFunnel, mailPeriod, mailPersonMatches, mailQueueRecipient } from "./mailAnalytics.js";

const at = (day) => new Date(`2026-09-${day}T12:00:00Z`);
const message = (email, fields = {}) => ({ eventId: "event-a", type: "event_notification", status: "sent", to: email, sentAt: at("20"), ...fields });

test("event funnel counts unique invited recipients and bookings after the first click", () => {
  const mails = [
    message("A@example.com", { opened: true, eventLinkClicked: true, firstEventLinkClickedAt: at("21") }),
    message("a@example.com", { openCount: 2, eventLinkClickCount: 2 }),
    message("b@example.com", { eventLinkClicked: true, firstEventLinkClickedAt: at("22") }),
    message("member@example.com", { audienceType: "registered" }),
    message("survey@example.com", { surveyId: "survey-1" }),
    message("test@example.com", { notificationId: "test-1" }),
    message("already@example.com"),
    message("pending@example.com")
  ];
  const registrations = [
    { eventId: "event-a", email: "a@example.com", createdAt: at("23"), status: "confirmed" },
    { eventId: "event-a", email: "b@example.com", createdAt: at("21"), status: "confirmed" },
    { eventId: "event-a", email: "already@example.com", createdAt: at("19"), status: "confirmed" },
    { eventId: "event-a", email: "pending@example.com", createdAt: at("21"), status: "pending_email_confirmation" }
  ];
  assert.deepEqual(eventMailFunnel(mails, registrations, [{ id: "test-1", testOnly: true }], "event-a", at("24").getTime()), {
    sent: 3, opened: 1, clicked: 2, booked: 2, bookedAfterClick: 1
  });
  assert.equal(eventMailFunnel(mails, registrations, [{ id: "test-1", testOnly: true }], "event-a", at("22").getTime()).booked, 1);
});

test("mail period uses inclusive local calendar days", () => {
  const period = mailPeriod(new URLSearchParams("from=2026-09-20&to=2026-09-24"));
  assert.equal(period.valid, true);
  assert.equal(new Date(period.start).getDate(), 20);
  assert.equal(new Date(period.end).getDate(), 24);
  assert.equal(mailPeriod(new URLSearchParams("from=2026-09-24&to=2026-09-20")).valid, false);
});

test("person search matches email, split names, and directory names case-insensitively", () => {
  const mail = { to: "beate@example.com", firstName: "Beate", lastName: "Busch" };
  assert.equal(mailPersonMatches(mail, "Beate Busch"), true);
  assert.equal(mailPersonMatches(mail, "BEATE@EXAMPLE.COM"), true);
  assert.equal(mailPersonMatches(mail, "anderer name"), false);
  assert.equal(mailPersonMatches({ to: "julia@example.com" }, "Julia Gloning", ["Julia Gloning"]), true);
  assert.equal(mailPersonMatches({ providerAccepted: ["admin@example.com"] }, "admin@example.com"), true);
});

test("mail queue shows the SMTP recipient when an admin mail has no stored to address", () => {
  assert.equal(mailQueueRecipient({ to: "", replyTo: "guest@example.com", providerAccepted: ["admin@example.com"] }), "admin@example.com");
  assert.equal(mailQueueRecipient({ providerRejected: ["invalid@example.com"] }), "invalid@example.com");
  assert.equal(mailQueueRecipient({ to: "member@example.com", providerAccepted: ["admin@example.com"] }), "member@example.com");
});
