import assert from "node:assert/strict";
import test from "node:test";
import { currentMailIssueEmails, peopleMailDeliveryByEmail } from "./cmsPages.js";

test("current mail errors count unique existing addresses, not failed queue attempts", () => {
  const people = [
    { email: "a@example.com" },
    { email: "A@example.com" },
    { email: "b@example.com" },
    { email: "c@example.com" },
    { email: "d@example.com" },
    { email: "e@example.com" }
  ];
  const mails = [
    { to: "a@example.com", status: "failed", failedAt: "2026-09-20T10:00:00Z" },
    { to: "a@example.com", status: "failed", failedAt: "2026-09-21T10:00:00Z" },
    { to: "b@example.com", status: "failed", failedAt: "2026-09-20T10:00:00Z" },
    { to: "", providerAccepted: ["b@example.com"], status: "sent", sentAt: "2026-09-22T10:00:00Z" },
    { to: "c@example.com", status: "sent", deliveryStatus: "bounced", sentAt: "2026-09-23T10:00:00Z" },
    { to: "sender@example.com", providerRejected: ["d@example.com"], status: "sent", sentAt: "2026-09-24T10:00:00Z" },
    { to: "e@example.com", status: "sent", deliveryStatus: "bounced", sentAt: "2026-09-20T10:00:00Z", bouncedAt: "2026-09-24T10:00:00Z" },
    { to: "e@example.com", status: "sent", sentAt: "2026-09-22T10:00:00Z" },
    { to: "deleted@example.com", status: "failed", failedAt: "2026-09-24T10:00:00Z" }
  ];

  const delivery = peopleMailDeliveryByEmail(mails);
  assert.deepEqual([...currentMailIssueEmails(people, delivery)].sort(), ["a@example.com", "c@example.com", "d@example.com", "e@example.com"]);
  assert.equal(mails.filter((mail) => mail.status === "failed").length, 4);
});
