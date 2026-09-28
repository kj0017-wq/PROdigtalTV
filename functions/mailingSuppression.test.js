const test = require("node:test");
const assert = require("node:assert/strict");
const { parseBounce } = require("./bounceService");
const { mailingSuppressionDue, memberHasEmail, suppressMailingAddress } = require("./mailingSuppression");

test("temporary delivery warnings are recognized without a DSN attachment", async () => {
  const bounce = await parseBounce(Buffer.from([
    "From: Mail Delivery System <Mailer-Daemon@example.com>",
    "Content-Type: text/plain; charset=utf-8", "",
    "A message that you sent has not yet been delivered to one or more recipients after more than 48 hours.",
    "The address to which the message has not yet been delivered is:",
    " guest@example.com", "Delivery attempts will continue for some time."
  ].join("\r\n")));
  assert.equal(bounce.kind, "delayed");
  assert.equal(bounce.recipient, "guest@example.com");
});

test("a permanent DSN is a failed delivery", async () => {
  const bounce = await parseBounce(Buffer.from([
    "From: Mail Delivery System <Mailer-Daemon@example.com>",
    "Content-Type: text/plain; charset=utf-8", "",
    "Action: failed", "Final-Recipient: rfc822;guest@example.com",
    "Status: 5.1.1", "Diagnostic-Code: smtp; 550 no such recipient"
  ].join("\r\n")));
  assert.equal(bounce.kind, "failed");
  assert.equal(bounce.recipient, "guest@example.com");
});

test("only known delayed mail older than 24 hours is suppressed", () => {
  const now = Date.UTC(2026, 8, 27, 12);
  assert.equal(mailingSuppressionDue({ to: "guest@example.com", deliveryStatus: "accepted", sentAt: new Date(now - 2 * 86400000) }, now), false);
  assert.equal(mailingSuppressionDue({ to: "guest@example.com", deliveryStatus: "delayed", sentAt: new Date(now - 23 * 3600000) }, now), false);
  assert.equal(mailingSuppressionDue({ to: "guest@example.com", deliveryStatus: "delayed", sentAt: new Date(now - 24 * 3600000) }, now), true);
  assert.equal(mailingSuppressionDue({ to: "guest@example.com", deliveryStatus: "bounced" }, now), true);
  assert.equal(mailingSuppressionDue({ to: "guest@example.com", deliveryStatus: "bounced", mailingSuppressedAt: new Date() }, now), false);
});

test("member address matching includes event contacts without blocking other addresses", () => {
  const member = { email: "office@example.com", eventContacts: [{ email: "Guest@Example.com" }] };
  assert.equal(memberHasEmail(member, "guest@example.com"), true);
  assert.equal(memberHasEmail(member, "other@example.com"), false);
});

test("suppression targets only the affected mailing address", async () => {
  const updates = [];
  const doc = (id, data) => ({ id, data: () => data, ref: { id } });
  const collections = {
    contacts: [doc("contact-1", { email: "Guest@Example.com" }), doc("contact-2", { email: "other@example.com" })],
    users: [doc("user-1", { email: "guest@example.com" })],
    speakers: [],
    members: [doc("member-1", { eventContacts: [{ email: "guest@example.com" }] })],
    registrations: [doc("registration-1", { email: "guest@example.com" })]
  };
  const db = {
    collection: (name) => ({
      get: async () => ({ docs: collections[name] }),
      where: (_field, _operator, email) => ({ get: async () => ({ docs: collections[name].filter((item) => item.data().email === email) }) })
    }),
    batch: () => ({
      set: (ref, update) => updates.push({ id: ref.id, update }),
      commit: async () => {}
    })
  };
  const FieldValue = { serverTimestamp: () => "now", arrayUnion: (value) => ({ add: value }) };
  const mailRef = { id: "mail-1" };
  const result = await suppressMailingAddress({
    db, FieldValue, mailRef,
    mail: { to: "guest@example.com", deliveryStatus: "bounced" }
  });
  assert.equal(result, true);
  assert.deepEqual(updates.map((item) => item.id).sort(), ["contact-1", "mail-1", "member-1", "registration-1", "user-1"]);
  assert.equal(updates.find((item) => item.id === "contact-1").update.mailingDisabled, true);
  assert.deepEqual(updates.find((item) => item.id === "member-1").update.mailingExcludedEmails, { add: "guest@example.com" });
});
