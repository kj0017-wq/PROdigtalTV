import { mailTime } from "./mailAnalytics.js";

export function buildBounceOverview(reports = [], mails = [], { eventId = "", start = 0, end = Infinity } = {}) {
  const mailById = new Map(mails.map((mail) => [mail.id, mail]));
  const reportedMailIds = new Set(reports.map((report) => report.mailQueueId).filter(Boolean));
  const rows = reports.filter((report) => report.result !== "ignored").map((report) => {
    const mail = mailById.get(report.mailQueueId) || null;
    return {
      id: report.id, result: report.result || "unmatched", recipient: report.recipient || mail?.to || "",
      eventId: mail?.eventId || "", subject: mail?.subject || "", diagnostic: report.diagnostic || "",
      statusCode: report.statusCode || "", mailQueueId: report.mailQueueId || "",
      time: mailTime(report.receivedAt || report.processedAt)
    };
  });
  for (const mail of mails) {
    if (mail.deliveryStatus !== "bounced" || reportedMailIds.has(mail.id)) continue;
    rows.push({ id: mail.id, result: "failed", recipient: mail.to || "", eventId: mail.eventId || "",
      subject: mail.subject || "", diagnostic: mail.bounceReason || "", statusCode: mail.bounceStatusCode || "",
      mailQueueId: mail.id, time: mailTime(mail.bouncedAt || mail.updatedAt || mail.sentAt) });
  }
  const inPeriod = rows.filter((row) => row.time >= start && row.time <= end);
  const matched = inPeriod.filter((row) => row.result !== "unmatched" && (!eventId || row.eventId === eventId))
    .sort((a, b) => b.time - a.time);
  const unmatched = inPeriod.filter((row) => row.result === "unmatched" && (!eventId || row.eventId === eventId))
    .sort((a, b) => b.time - a.time);
  return { matchedCount: matched.length, unmatchedCount: unmatched.length, matched, unmatched,
    rows: [...matched, ...unmatched].sort((a, b) => b.time - a.time) };
}
