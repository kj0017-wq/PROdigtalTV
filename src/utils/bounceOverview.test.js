import test from "node:test";
import assert from "node:assert/strict";
import { buildBounceOverview } from "./bounceOverview.js";

const at = (day) => new Date(`2026-09-${day}T12:00:00Z`);

test("only unmatched bounce reports remain in the review list", () => {
  const mails = [
    { id: "mail-1", to: "matched@example.com", eventId: "event-1", deliveryStatus: "bounced", bouncedAt: at("23") },
    { id: "mail-2", to: "legacy@example.com", eventId: "event-1", deliveryStatus: "bounced", bouncedAt: at("23") }
  ];
  const reports = [
    { id: "report-1", mailQueueId: "mail-1", recipient: "matched@example.com", result: "failed", receivedAt: at("23") },
    { id: "report-2", recipient: "unknown@example.com", result: "unmatched", receivedAt: at("24"), diagnostic: "550 5.1.1" },
    { id: "report-3", recipient: "reply@example.com", result: "ignored", receivedAt: at("24") }
  ];
  const overview = buildBounceOverview(reports, mails);
  assert.equal(overview.matchedCount, 2);
  assert.equal(overview.unmatchedCount, 1);
  assert.equal(overview.rows.length, 3);
  assert.equal(overview.matched[0].mailQueueId, "mail-1");
  assert.equal(overview.rows[0].recipient, "unknown@example.com");
  assert.equal(overview.unmatched[0].recipient, "unknown@example.com");
  assert.equal(buildBounceOverview(reports, mails, { end: at("23").getTime() }).unmatchedCount, 0);
  assert.equal(buildBounceOverview(reports, mails, { eventId: "event-1" }).unmatchedCount, 0);
});
