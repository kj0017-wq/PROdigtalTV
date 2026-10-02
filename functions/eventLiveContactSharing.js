const QRCode = require('qrcode');
const { createHash } = require('node:crypto');
const clean = (value) => String(value || '').trim().slice(0, 300);
const escapeVCard = (value) => clean(value).replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
function contactVCard(card) {
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${escapeVCard(card.name)}`, `N:${escapeVCard(card.lastName)};${escapeVCard(card.firstName)};;;`];
  for (const [key, value] of [['ORG', card.company], ['TITLE', card.position], ['EMAIL;TYPE=INTERNET', card.email], ['TEL;TYPE=CELL', card.phone], ['URL', card.linkedIn]]) {
    if (value) lines.push(`${key}:${escapeVCard(value)}`);
  }
  lines.push('END:VCARD');
  // Fold by UTF-8 byte length without splitting a character.
  return lines.map((line) => {
    let result = '', length = 0;
    for (const char of line) {
      const bytes = Buffer.byteLength(char);
      if (length + bytes > 75) { result += '\r\n '; length = 1; }
      result += char; length += bytes;
    }
    return result;
  }).join('\r\n') + '\r\n';
}
async function contactCardForMessage(message) {
  if (message.deleted || !message.contactCard) return null;
  const vcard = contactVCard(message.contactCard);
  return { ...message.contactCard, vcard, qrCode: await QRCode.toDataURL(vcard, { width: 360, margin: 4, errorCorrectionLevel: 'M' }) };
}
function createContactResponder({ db, eventLiveUser, eventLiveContactRequestId, FieldValue, HttpsError, automatic = false }) {
  return async (request) => {
    const eventId = clean(request.data?.eventId);
    const requestId = clean(request.data?.requestId);
    const decision = clean(request.data?.decision);
    if (!requestId || requestId.includes('/') || !['accepted', 'rejected'].includes(decision)) throw new HttpsError('invalid-argument', 'Antwort fehlt.');
    const viewer = await eventLiveUser(request, eventId);
    const ref = db.collection('eventLiveContactRequests').doc(requestId);
    let status;
    await db.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      const item = snapshot.data() || {};
      status = item.status;
      if (!snapshot.exists || item.eventId !== eventId || item.receiverContactId !== viewer.contactId) throw new HttpsError('permission-denied', 'Diese Kontaktanfrage kann nicht beantwortet werden.');
      if (item.status === decision) return;
      if (item.status !== 'pending') throw new HttpsError('failed-precondition', 'Die Kontaktanfrage wurde bereits beantwortet.');
      let card;
      const contact = (await tx.get(db.collection('contacts').doc(viewer.contactId))).data() || {};
      const answerName = clean(contact.name || [contact.firstName, contact.lastName].filter(Boolean).join(' ') || item.receiverName || 'Teilnehmende Person');
      if (decision === 'accepted') {
        if (automatic && contact.autoShareContactDetails !== true) return;
        const registrations = await tx.get(db.collection('registrations').where('eventId', '==', eventId).where('email', '==', viewer.email).limit(1));
        const registration = registrations.docs[0]?.data() || {};
        card = { firstName: clean(contact.firstName || registration.firstName), lastName: clean(contact.lastName || registration.lastName), name: clean(contact.name || [contact.firstName || registration.firstName, contact.lastName || registration.lastName].filter(Boolean).join(' ') || item.receiverName), company: clean(contact.company || registration.company), position: clean(contact.position || registration.position), email: viewer.email, phone: clean(contact.phone || contact.mobile || registration.phone || registration.mobile), linkedIn: clean(contact.linkedIn || contact.linkedin) };
      }
      const participants = [item.senderContactId, viewer.contactId].sort();
      const thread = db.collection('eventLiveConversations').doc(eventId).collection('threads').doc(eventLiveContactRequestId(eventId, ...participants));
      const shareId = createHash('sha256').update(`${requestId}|${item.requestedAt?.toMillis?.() || item.requestedAt || 0}`).digest('hex');
      const message = thread.collection('messages').doc(`contact-${shareId}`);
      const now = FieldValue.serverTimestamp();
      const answer = { decision, answeredByContactId: viewer.contactId, answeredByName: answerName,
        answeredByUid: viewer.uid || request.auth?.uid || null, answerMode: automatic ? 'automatic' : 'manual', answeredAt: now };
      tx.update(ref, { status: decision, ...answer, updatedAt: now });
      status = decision;
      const summary = `${card?.name || answerName} hat die Kontaktanfrage mit ${decision === 'accepted' ? 'Ja' : 'Nein'} beantwortet.${automatic ? ' Automatische Freigabe.' : ''}`;
      tx.set(message, { senderContactId: viewer.contactId, receiverContactId: item.senderContactId,
        text: summary + (card ? `\n${[card.email, card.phone, card.linkedIn].filter(Boolean).join('\n')}` : ''),
        ...(card ? { contactCard: card } : {}), type: card ? 'contact_share' : 'contact_response',
        contactRequestId: requestId, ...answer, createdAt: now });
      tx.set(thread, { participantIds: participants, lastMessageId: message.id, lastText: summary.slice(0, 160), lastSenderContactId: viewer.contactId, lastMessageAt: now }, { merge: true });
    });
    return { status };
  };
}
async function autoShareRequest(dependencies, requestId) {
  const { db } = dependencies;
  const snapshot = await db.collection('eventLiveContactRequests').doc(requestId).get();
  const item = snapshot.data();
  if (!item || item.status !== 'pending') return { status: item?.status || 'pending' };
  const contact = (await db.collection('contacts').doc(item.receiverContactId).get()).data();
  if (!contact?.autoShareContactDetails || !contact.email) return { status: 'pending' };
  const respond = createContactResponder({ ...dependencies, automatic: true, eventLiveUser: async () => ({ contactId: item.receiverContactId, email: contact.email }) });
  return respond({ data: { eventId: item.eventId, requestId, decision: 'accepted' } });
}
module.exports = { createContactResponder, autoShareRequest, contactVCard, contactCardForMessage };
