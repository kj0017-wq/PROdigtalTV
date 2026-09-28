const { ImapFlow } = require("imapflow");
const { simpleParser } = require("mailparser");

const MAILBOX = { host: "wp12573293.mail.server-he.de", port: 993, user: "wp12573293-bounceprodigital" };
const normalizeEmail = (value = "") => String(value || "").trim().toLowerCase().replace(/^.*<([^>]+)>$/, "$1");

async function parseBounce(source) {
  const parsed = await simpleParser(source, { keepDeliveryStatus: false, skipHtmlToText: true });
  const parts = [parsed.text || "", ...(parsed.attachments || [])
    .filter((part) => ["message/delivery-status", "message/rfc822", "text/plain"].includes(part.contentType))
    .map((part) => part.content.toString("utf8"))];
  const details = parts.join("\n");
  const raw = Buffer.isBuffer(source) ? source.toString("utf8") : String(source || "");
  const action = details.match(/^Action:\s*(failed|delayed|delivered)\s*$/im)?.[1]?.toLowerCase() || "";
  const eximFailure = details.match(/The following address\(es\) failed:\s*\n\s*([^\s<>]+@[^\s<>]+)[\s\S]*?\bSMTP error from remote mail server[\s\S]*?\b(5\.\d+\.\d+)\s+([^\r\n]+)/i);
  const statusCode = details.match(/^Status:\s*([245]\.\d+\.\d+)/im)?.[1] || eximFailure?.[2] || "";
  const contentType = parsed.headers.get("content-type");
  const senders = (parsed.from?.value || []).map((entry) => entry.address || "").join(" ");
  const isDeliveryReport = (contentType?.value === "multipart/report" && contentType.params?.["report-type"] === "delivery-status")
    || /(?:mailer-daemon|postmaster)@/i.test(senders);
  const kind = !isDeliveryReport ? "ignored" : action === "failed" || statusCode.startsWith("5.") ? "failed"
    : action === "delivered" ? "delivered"
      : action === "delayed" || statusCode.startsWith("4.")
        || /has not yet been delivered|delivery attempts will continue/i.test(details) ? "delayed" : "ignored";
  const queueId = raw.match(/^X-PDTV-Mail-ID:\s*([\w-]+)/im)?.[1]
    || raw.match(/<pdtv-mail-([\w-]+)@prodigitaltv\.de>/i)?.[1] || "";
  const recipient = normalizeEmail(details.match(/^(?:Final|Original)-Recipient:\s*(?:rfc822\s*;\s*)?([^\s;]+)/im)?.[1]
    || details.match(/The address to which the message has not yet been delivered is:\s*\n\s*([^\s<>]+@[^\s<>]+)/i)?.[1]
    || eximFailure?.[1] || "");
  const diagnostic = (details.match(/^Diagnostic-Code:\s*(.+)$/im)?.[1] || (eximFailure ? `${eximFailure[2]} ${eximFailure[3]}` : "")).trim().slice(0, 400);
  const messageIds = [...raw.matchAll(/^(?:Original-Message-ID|Message-ID):\s*(<[^>]+>)/gim)]
    .map((match) => match[1]).filter((id) => id !== parsed.messageId);
  return { kind, queueId, recipient, statusCode, action, diagnostic, messageIds };
}

async function pollBounceMailbox({ db, FieldValue, password, limit = 100 }) {
  if (!password) throw new Error("Bounce-IMAP-Passwort fehlt.");
  const client = new ImapFlow({
    host: MAILBOX.host, port: MAILBOX.port, secure: true,
    auth: { user: MAILBOX.user, pass: password },
    logger: false, connectionTimeout: 15000, socketTimeout: 30000
  });
  const counts = { inspected: 0, failed: 0, delayed: 0, delivered: 0, unmatched: 0, ignored: 0, errors: 0 };
  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const uidValidity = String(client.mailbox.uidValidity || "unknown");
      const unseen = await client.search({ seen: false }, { uid: true });
      for (const uid of (unseen || []).slice(0, limit)) {
        try {
        const reportRef = db.collection("bounceReports").doc(uidValidity + "-" + uid);
        if ((await reportRef.get()).exists) {
          await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
          continue;
        }
        const message = await client.fetchOne(uid, { source: true, envelope: true }, { uid: true });
        if (!message?.source) continue;
        const bounce = await parseBounce(message.source);
        let mailRef = null;
        if (bounce.queueId) {
          const candidate = db.collection("mailQueue").doc(bounce.queueId);
          if ((await candidate.get()).exists) mailRef = candidate;
        }
        if (!mailRef) {
          for (const id of bounce.messageIds) {
            const matches = await db.collection("mailQueue").where("providerMessageId", "==", id).limit(1).get();
            if (!matches.empty) { mailRef = matches.docs[0].ref; break; }
          }
        }
        const record = mailRef ? (await mailRef.get()).data() : null;
        if (record && bounce.recipient && normalizeEmail(record.to) !== bounce.recipient) mailRef = null;
        const result = bounce.kind === "ignored" ? "ignored" : mailRef ? bounce.kind : "unmatched";
        await db.runTransaction(async (transaction) => {
          if ((await transaction.get(reportRef)).exists) return;
          transaction.create(reportRef, {
            mailbox: "bounce@prodigitaltv.de", uid, uidValidity, result,
            mailQueueId: mailRef?.id || "",
            recipient: bounce.recipient || normalizeEmail(record?.to),
            action: bounce.action, statusCode: bounce.statusCode,
            diagnostic: bounce.diagnostic, receivedAt: message.envelope?.date || null,
            processedAt: FieldValue.serverTimestamp()
          });
          if (result === "failed" && record?.status === "sent") {
            transaction.update(mailRef, {
              deliveryStatus: "bounced", bounceStatusCode: bounce.statusCode,
              bounceReason: bounce.diagnostic || "Mail wurde als unzustellbar zurueckgemeldet.",
              bouncedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
            });
          } else if (result === "delayed" && record?.status === "sent" && record.deliveryStatus !== "bounced") {
            transaction.update(mailRef, {
              deliveryStatus: "delayed", delayStatusCode: bounce.statusCode,
              delayReason: bounce.diagnostic || "Zustellung beim Empfaenger verzoegert.",
              delayedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
            });
          } else if (result === "delivered" && record?.status === "sent" && record.deliveryStatus !== "bounced") {
            transaction.update(mailRef, {
              deliveryStatus: "delivered", deliveredAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp()
            });
          }
        });
        await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
        counts.inspected += 1;
        counts[result] += 1;
        } catch (error) {
          counts.errors += 1;
          console.error("Bounce-Verarbeitung fehlgeschlagen", { uid, error: error.message || String(error) });
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }
  return counts;
}

module.exports = { parseBounce, pollBounceMailbox };
