function createEventLiveMessages({ db, eventLiveUser, contactId, eventLiveContactRequestId, FieldValue, HttpsError, removeAttachment = async () => {} }) {
  async function groupAccess(request) {
    const eventId = String(request.data?.eventId || "").trim();
    if (!eventId || eventId.includes("/")) throw new HttpsError("invalid-argument", "Veranstaltung fehlt.");
    const viewer = await eventLiveUser(request, eventId);
    const registrations = await db.collection("registrations").where("eventId", "==", eventId).where("status", "==", "checked_in").limit(1000).get();
    const present = new Set(registrations.docs.filter((doc) => doc.data().checkedInEventId === eventId && doc.data().email).map((doc) => contactId(doc.data().email)));
    if (!present.has(viewer.contactId)) throw new HttpsError("permission-denied", "Der Gruppenchat ist nach Ihrem Check-in bei diesem Event verfÃƒÂ¼gbar.");
    const group = db.collection("eventLiveConversations").doc(eventId).collection("groups").doc("everyone");
    return { viewer, group };
  }

  async function getGroupMessages(request) {
    const { viewer, group } = await groupAccess(request);
    let query = group.collection("messages").orderBy("createdAt", "desc");
    const beforeId = String(request.data?.beforeId || "");
    if (beforeId) {
      if (!/^[a-zA-Z0-9-]{16,80}$/.test(beforeId)) throw new HttpsError("invalid-argument", "UngÃƒÂ¼ltiger Nachrichtenverweis.");
      const cursor = await group.collection("messages").doc(beforeId).get();
      if (!cursor.exists) throw new HttpsError("not-found", "Nachricht nicht gefunden.");
      query = query.startAfter(cursor);
    }
    const snapshot = await query.limit(41).get();
    const messages = snapshot.docs.slice(0, 40).map((doc) => ({
      id: doc.id,
      text: doc.data().text,
      attachment: doc.data().attachment || null,
      senderContactId: doc.data().senderContactId,
      self: doc.data().senderContactId === viewer.contactId,
      createdAt: doc.data().createdAt?.toDate().toISOString() || ""
    })).reverse();
    const moderation = await db.collection("eventLiveConversations").doc(String(request.data.eventId).trim()).get();
    return { messages, resetAt: moderation.data()?.moderationRevision || "", hasMore: snapshot.docs.length > 40, oldestId: messages[0]?.id || "" };
  }

  async function sendGroupMessage(request) {
    const { viewer, group } = await groupAccess(request);
    const text = String(request.data?.text || "").trim();
    const messageId = String(request.data?.messageId || "");
    if (!text || text.length > 2000 || !/^[a-zA-Z0-9-]{16,80}$/.test(messageId)) throw new HttpsError("invalid-argument", "Bitte eine Nachricht mit hÃƒÂ¶chstens 2000 Zeichen eingeben.");
    const message = group.collection("messages").doc(messageId);
    await db.runTransaction(async (tx) => {
      const existing = await tx.get(message);
      if (existing.exists) {
        if (existing.data().senderContactId !== viewer.contactId || existing.data().text !== text) throw new HttpsError("already-exists", "Nachrichtenkennung bereits verwendet.");
        return;
      }
      tx.set(message, { text, senderContactId: viewer.contactId, createdAt: FieldValue.serverTimestamp() });
    });
    return { id: messageId, status: "stored", channel: "event_live_group" };
  }

  async function getGroupStatus(request) {
    const { viewer, group } = await groupAccess(request);
    const reader = await group.collection("readers").doc(viewer.contactId).get();
    const lastReadAt = reader.data()?.lastReadAt;
    let query = group.collection("messages");
    if (lastReadAt) query = query.where("createdAt", ">", lastReadAt);
    const messages = await query.get();
    const unreadCount = messages.docs.filter(doc => doc.data().senderContactId !== viewer.contactId).length;
    return { unreadCount };
  }

  async function markGroupRead(request) {
    const { viewer, group } = await groupAccess(request);
    const messageId = String(request.data?.messageId || "");
    if (!/^[a-zA-Z0-9-]{16,80}$/.test(messageId)) throw new HttpsError("invalid-argument", "UngÃƒÂ¼ltiger Nachrichtenverweis.");
    const message = group.collection("messages").doc(messageId);
    const reader = group.collection("readers").doc(viewer.contactId);
    await db.runTransaction(async tx => {
      const [seen, current] = await Promise.all([tx.get(message), tx.get(reader)]);
      if (!seen.exists || !seen.data().createdAt) throw new HttpsError("not-found", "Nachricht nicht gefunden.");
      const timestamp = seen.data().createdAt;
      if (timestamp.toMillis() > (current.data()?.lastReadAt?.toMillis() || 0)) {
        tx.set(reader, { lastReadAt: timestamp }, { merge: true });
      }
    });
    return { read: true };
  }

  async function access(request) {
    const eventId = String(request.data?.eventId || "").trim();
    const peerId = String(request.data?.peerId || "").trim();
    if (!eventId || !peerId || eventId.includes("/") || peerId.includes("/")) throw new HttpsError("invalid-argument", "Veranstaltung oder Person fehlt.");
    const viewer = await eventLiveUser(request, eventId);
    if (peerId === viewer.contactId) throw new HttpsError("invalid-argument", "Bitte eine andere Person auswÃƒÂ¤hlen.");
    const registrations = await db.collection("registrations").where("eventId", "==", eventId).where("status", "==", "checked_in").limit(1000).get();
    const present = new Set(registrations.docs.filter((doc) => doc.data().checkedInEventId === eventId && doc.data().email).map((doc) => contactId(doc.data().email)));
    if (!present.has(viewer.contactId) || !present.has(peerId)) throw new HttpsError("permission-denied", "FÃƒÂ¼r Nachrichten mÃƒÂ¼ssen beide Personen bei diesem Event eingecheckt sein.");
    const participants = [viewer.contactId, peerId].sort();
    const thread = db.collection("eventLiveConversations").doc(eventId).collection("threads").doc(eventLiveContactRequestId(eventId, ...participants));
    return { viewer, peerId, participants, thread };
  }

  async function getMessages(request) {
    const { viewer, peerId, thread } = await access(request);
    let query = thread.collection("messages").orderBy("createdAt", "desc");
    const beforeId = String(request.data?.beforeId || "");
    if (beforeId) {
      if (!/^[a-zA-Z0-9-]{16,80}$/.test(beforeId)) throw new HttpsError("invalid-argument", "UngÃƒÂ¼ltiger Nachrichtenverweis.");
      const cursor = await thread.collection("messages").doc(beforeId).get();
      if (!cursor.exists) throw new HttpsError("not-found", "Nachricht nicht gefunden.");
      query = query.startAfter(cursor);
    }
    const snapshot = await query.limit(41).get();
    const rows = snapshot.docs.slice(0, 40);
    const current = await thread.get();
    const readAt = current.data()?.lastReadAt?.[peerId]?.toMillis?.() || 0;
    const messages = rows.map((doc) => ({ id: doc.id, text: doc.data().deleted ? "Nachricht gelÃƒÂ¶scht" : doc.data().text, deleted: doc.data().deleted === true, attachment: doc.data().deleted ? null : doc.data().attachment || null, self: doc.data().senderContactId === viewer.contactId, read: readAt >= (doc.data().createdAt?.toMillis() || Infinity), createdAt: doc.data().createdAt?.toDate().toISOString() || "" })).reverse();
    const moderation = await db.collection("eventLiveConversations").doc(String(request.data.eventId).trim()).get();
    return { messages, resetAt: moderation.data()?.moderationRevision || "", hasMore: snapshot.docs.length > 40, oldestId: messages[0]?.id || "" };
  }

  async function markRead(request) {
    const { viewer, peerId, thread } = await access(request);
    const messageId = String(request.data?.messageId || "");
    if (!/^[a-zA-Z0-9-]{16,80}$/.test(messageId)) throw new HttpsError("invalid-argument", "Nachrichtenverweis fehlt.");
    await db.runTransaction(async (tx) => {
      const message = await tx.get(thread.collection("messages").doc(messageId));
      const current = await tx.get(thread);
      const seen = message.data()?.createdAt;
      if (!message.exists || message.data().senderContactId !== peerId || !seen) throw new HttpsError("not-found", "Nachricht nicht gefunden.");
      if (seen.toMillis() > (current.data()?.lastReadAt?.[viewer.contactId]?.toMillis?.() || 0)) {
        tx.set(thread, { lastReadAt: { [viewer.contactId]: seen } }, { merge: true });
      }
    });
    return { read: true };
  }

  async function sendMessage(request) {
    const { viewer, peerId, participants, thread } = await access(request);
    const text = String(request.data?.text || "").trim();
    const messageId = String(request.data?.messageId || "");
    if (!text || text.length > 2000 || !/^[a-zA-Z0-9-]{16,80}$/.test(messageId)) throw new HttpsError("invalid-argument", "Bitte eine Nachricht mit hÃƒÂ¶chstens 2000 Zeichen eingeben.");
    const message = thread.collection("messages").doc(messageId);
    await db.runTransaction(async (tx) => {
      const existing = await tx.get(message);
      if (existing.exists) {
        if (existing.data().senderContactId !== viewer.contactId || existing.data().text !== text) throw new HttpsError("already-exists", "Nachrichtenkennung bereits verwendet.");
        return;
      }
      tx.set(message, { text, senderContactId: viewer.contactId, receiverContactId: peerId, createdAt: FieldValue.serverTimestamp() });
      tx.set(thread, { participantIds: participants, lastMessageId: messageId, lastText: text.slice(0, 160), lastSenderContactId: viewer.contactId, lastMessageAt: FieldValue.serverTimestamp() }, { merge: true });
    });
    return { id: messageId, status: "stored", channel: "event_live" };
  }
  async function deleteMessage(request) {
    const { viewer, peerId, thread } = await access(request);
    const messageId = String(request.data?.messageId || "");
    if (!/^[a-zA-Z0-9-]{16,80}$/.test(messageId)) throw new HttpsError("invalid-argument", "Nachrichtenverweis fehlt.");
    const message = thread.collection("messages").doc(messageId);
    await db.runTransaction(async (tx) => {
      const snapshot = await tx.get(message);
      const current = await tx.get(thread);
      const item = snapshot.data();
      if (!snapshot.exists || item.senderContactId !== viewer.contactId) throw new HttpsError("permission-denied", "Sie kÃƒÂ¶nnen nur eigene Nachrichten lÃƒÂ¶schen.");
      if (item.deleted) return;
      if (!item.createdAt || (current.data()?.lastReadAt?.[peerId]?.toMillis() || 0) >= item.createdAt.toMillis()) throw new HttpsError("failed-precondition", "Die Nachricht wurde bereits gelesen und kann nicht mehr gelÃƒÂ¶scht werden.");
      tx.set(message, { text: "", deleted: true, deletedAt: FieldValue.serverTimestamp() }, { merge: true });
      const latest = current.data() || {};
      if (latest.lastMessageId === messageId || (!latest.lastMessageId && latest.lastSenderContactId === viewer.contactId && latest.lastMessageAt?.toMillis() === item.createdAt.toMillis())) {
        tx.set(thread, { lastText: "Nachricht gelÃƒÂ¶scht" }, { merge: true });
      }
    });
    await removeAttachment((await message.get()).data());
    return { deleted: true };
  }
  return { access, groupAccess, getMessages, sendMessage, markRead, deleteMessage, getGroupMessages, sendGroupMessage, getGroupStatus, markGroupRead };
}
module.exports = { createEventLiveMessages };
