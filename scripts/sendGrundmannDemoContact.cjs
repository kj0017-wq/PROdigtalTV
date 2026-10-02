const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { createHash } = require("node:crypto");
const { contactCardForMessage } = require("../functions/eventLiveContactSharing");
initializeApp({ credential: applicationDefault(), projectId: "prodigitaltv-da47b" });
const db = getFirestore();
const eventId = "event-archive-63";
const hash = value => createHash("sha256").update(value).digest("hex");
const contactId = email => "contact-" + hash(email.trim().toLowerCase()).slice(0, 32);
const receiverContactId = contactId("kj_privat@yahoo.de");
async function main() {
  const registrations = await db.collection("registrations").where("eventId", "==", eventId).get();
  const present = registrations.docs.map(doc => doc.data()).filter(item =>
    item.status === "checked_in" && item.checkedInEventId === eventId && item.email);
  const targets = [...new Map(present.filter(item =>
    /melanie/i.test([item.firstName, item.displayName].join(" "))
    && /grundmann/i.test([item.lastName, item.displayName].join(" ")))
    .map(item => [contactId(item.email), item])).keys()];
  if (targets.length !== 1 || !present.some(item => contactId(item.email) === receiverContactId)) {
    throw new Error("Eingecheckte Testpartner sind nicht eindeutig vorhanden.");
  }
  const senderContactId = targets[0];
  const participants = [senderContactId, receiverContactId].sort();
  const thread = db.collection("eventLiveConversations").doc(eventId).collection("threads").doc(hash([eventId, ...participants].join("|")));
  const message = thread.collection("messages").doc("demo-grundmann-contact-20260929-01");
  const contactCard = {
    name: "DEMO - Melanie Grundmann", firstName: "DEMO Melanie", lastName: "Grundmann",
    company: "Demo-Unternehmen (fiktiv)", position: "Testprofil - keine echten Kontaktdaten",
    email: "melanie.grundmann@example.invalid", phone: "", linkedIn: ""
  };
  const text = "[DEMO / von Codex auf Wunsch von Klaus erstellt] Dies ist keine Nachricht oder Freigabe von Frau Grundmann. Die folgende Kontaktkarte enthaelt ausschliesslich erfundene Testdaten. QR-Code und Kontaktimport koennen damit getestet werden.";
  const rendered = await contactCardForMessage({ contactCard });
  if (!rendered.qrCode.startsWith("data:image/png;base64,") || !rendered.vcard.includes("example.invalid")) throw new Error("Demo-Kontaktkarte ungueltig.");
  let created = false;
  await db.runTransaction(async tx => {
    if ((await tx.get(message)).exists) return;
    const now = FieldValue.serverTimestamp();
    tx.create(message, { senderContactId, receiverContactId, text, contactCard, type: "contact_share",
      isDemo: true, source: "codex_user_requested_demo", requestedByContactId: receiverContactId, createdAt: now });
    tx.set(thread, { participantIds: participants, lastMessageId: message.id,
      lastText: "DEMO-Kontaktkarte mit erfundenen Daten", lastSenderContactId: senderContactId, lastMessageAt: now }, { merge: true });
    tx.create(db.collection("eventChatNotifications").doc(hash([eventId, thread.id, message.id].join("|"))), {
      eventId, threadId: thread.id, messageId: message.id, receiverContactId,
      status: "pending", attempts: 0, dueAt: Timestamp.fromMillis(Date.now() + 90000), createdAt: now
    });
    created = true;
  });
  console.log(JSON.stringify({ created, stored: (await message.get()).exists, demoOnly: true, qrValidated: true }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
