const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { createHash } = require('node:crypto');
initializeApp({ credential: applicationDefault(), projectId: 'prodigitaltv-da47b' });
const db = getFirestore();
const eventId = 'event-archive-63';
const email = 'gpt-demo@example.invalid';
const contactId = (value) => 'contact-' + createHash('sha256').update(value.toLowerCase()).digest('hex').slice(0, 32);
const demoId = contactId(email);
const ownerId = contactId('kj_privat@yahoo.de');
async function main() {
  const event = await db.collection('events').doc(eventId).get();
  if (!event.exists) throw new Error('HEUKING event missing');
  const contact = db.collection('contacts').doc(demoId);
  const registration = db.collection('registrations').doc('event-live-gpt-demo-heuking');
  const participants = [demoId, ownerId].sort();
  const threadId = createHash('sha256').update([eventId, ...participants].join('|')).digest('hex');
  const thread = db.collection('eventLiveConversations').doc(eventId).collection('threads').doc(threadId);
  const message = thread.collection('messages').doc('gpt-demo-welcome-0001');
  const text = 'Hallo Klaus! Ich bin GPT Demo, dein Testpartner für Event Live. Was möchtest du ausprobieren oder mit mir durchdenken? Antworten werden hier vorerst gezielt über Codex eingestellt, nicht automatisch.';
  await db.runTransaction(async (tx) => {
    const existing = await Promise.all([tx.get(contact), tx.get(registration), tx.get(message)]);
    const now = FieldValue.serverTimestamp();
    const flags = { isDemo: true, source: 'event_live_demo', mailingDisabled: true, notificationOptOut: true, reminderConsent: false };
    if (!existing[0].exists) tx.create(contact, { id: demoId, email, name: 'GPT Demo', firstName: 'GPT', lastName: 'Demo', company: 'Event Live Demo', position: 'KI-Testpartner (Demo)', status: 'active', eventIds: [eventId], ...flags, createdAt: now, updatedAt: now });
    if (!existing[1].exists) tx.create(registration, { id: registration.id, eventId, eventTitle: event.data().title, email, firstName: 'GPT', lastName: 'Demo', company: 'Event Live Demo', position: 'KI-Testpartner (Demo)', status: 'checked_in', checkedInEventId: eventId, checkedInAt: now, participantCount: 1, mailStatus: 'not_required', registrationSource: 'event_live_demo', ...flags, createdAt: now, updatedAt: now });
    if (!existing[2].exists) {
      tx.create(message, { senderContactId: demoId, receiverContactId: ownerId, text, createdAt: now });
      tx.set(thread, { participantIds: participants, lastText: text.slice(0, 160), lastSenderContactId: demoId, lastMessageAt: now, isDemo: true }, { merge: true });
    }
  });
  console.log(JSON.stringify({ eventId, demoContactId: demoId, registrationId: registration.id, conversationId: threadId, welcomePresent: (await message.get()).exists }));
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
