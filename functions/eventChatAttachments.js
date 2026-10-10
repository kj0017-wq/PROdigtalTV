function createEventChatAttachments({ db, bucket, messages, eventLiveUser, FieldValue, HttpsError }) {
  const validId = value => typeof value === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
  const supported = new Set(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm", "video/quicktime"]);
  async function channel(request) {
    if (!request.auth?.uid || request.data?.adminTestContactId) throw new HttpsError("permission-denied", "Bitte mit dem eigenen Account anmelden.");
    const group = request.data?.channel === "group";
    const access = await (group ? messages.groupAccess(request) : messages.access(request));
    return { ...access, ref: group ? access.group : access.thread, group };
  }
  async function begin(request) {
    const scope = await channel(request);
    const fileType = String(request.data.fileType || "");
    const fileSize = Number(request.data.fileSize);
    const maxSize = fileType.startsWith("image/") ? 15 * 1024 * 1024 : 50 * 1024 * 1024;
    if (!supported.has(fileType) || !Number.isFinite(fileSize) || fileSize <= 0 || fileSize > maxSize) {
      throw new HttpsError("invalid-argument", "Fotos: JPG, PNG oder WebP bis 15 MB. Videos: MP4, WebM oder MOV bis 50 MB.");
    }
    const ref = db.collection("eventChatAttachments").doc();
    const fileName = String(request.data.fileName || "Anhang").replace(/[^\w.-]/g, "-").slice(0, 120) || "Anhang";
    const storagePath = `event-chat-attachments/${request.auth.uid}/${ref.id}/${fileName}`;
    await ref.set({ eventId: request.data.eventId, channel: scope.group ? "group" : "private",
      channelPath: scope.ref.path, participantIds: scope.participants || [],
      senderContactId: scope.viewer.contactId, uploadedBy: request.auth.uid, fileType, fileSize,
      fileName, storagePath, status: "uploading", createdAt: FieldValue.serverTimestamp() });
    return { attachmentId: ref.id, storagePath };
  }
  async function finish(request) {
    const scope = await channel(request);
    if (!validId(request.data.attachmentId)) throw new HttpsError("invalid-argument", "Anhang fehlt.");
    const ref = db.collection("eventChatAttachments").doc(request.data.attachmentId);
    const snapshot = await ref.get();
    const item = snapshot.data();
    if (!snapshot.exists || item.uploadedBy !== request.auth.uid || item.channelPath !== scope.ref.path) throw new HttpsError("permission-denied", "Anhang gehört nicht zu diesem Chat.");
    const messageId = `attachment-${ref.id}`;
    if (item.status === "sent") {
      const currentMessage = await scope.ref.collection("messages").doc(messageId).get();
      if (!currentMessage.exists || currentMessage.data().deleted) throw new HttpsError("not-found", "Anhang wurde gelöscht.");
      return { id: messageId };
    }
    const [metadata] = await bucket.file(item.storagePath).getMetadata();
    if (metadata.contentType !== item.fileType || Number(metadata.size) !== item.fileSize) throw new HttpsError("failed-precondition", "Der Anhang wurde nicht vollständig hochgeladen.");
    const text = String(request.data.text || "").trim();
    if (text.length > 2000) throw new HttpsError("invalid-argument", "Bildbeschreibung ist zu lang.");
    await bucket.file(item.storagePath).setMetadata({ metadata: { firebaseStorageDownloadTokens: null } });
    await db.runTransaction(async tx => {
      const current = await tx.get(ref);
      if (current.data()?.status === "sent") return;
      if (!current.exists || current.data().status !== "uploading") throw new HttpsError("failed-precondition", "Upload nicht verfügbar.");
      const attachment = { id: ref.id, fileName: item.fileName, fileType: item.fileType };
      tx.set(scope.ref.collection("messages").doc(messageId), {
        text, attachment, senderContactId: scope.viewer.contactId,
        ...(scope.peerId ? { receiverContactId: scope.peerId } : {}), createdAt: FieldValue.serverTimestamp()
      });
      if (!scope.group) tx.set(scope.ref, {
        participantIds: scope.participants, lastMessageId: messageId, lastText: text || (item.fileType.startsWith("video/") ? "Video" : "Foto"),
        lastSenderContactId: scope.viewer.contactId, lastMessageAt: FieldValue.serverTimestamp()
      }, { merge: true });
      tx.set(ref, { status: "sent", messageId, sentAt: FieldValue.serverTimestamp() }, { merge: true });
    });
    return { id: messageId };
  }
  async function read(auth, attachmentId) {
    if (!validId(attachmentId)) throw new HttpsError("invalid-argument", "Anhang fehlt.");
    const snapshot = await db.collection("eventChatAttachments").doc(attachmentId).get();
    const item = snapshot.data();
    if (!snapshot.exists || item.status !== "sent") throw new HttpsError("not-found", "Anhang nicht gefunden.");
    const viewer = await eventLiveUser({ auth, data: {} }, item.eventId);
    const peerId = item.participantIds.find(id => id !== viewer.contactId);
    const scope = await channel({ auth, data: { eventId: item.eventId, channel: item.channel, peerId } });
    if (scope.ref.path !== item.channelPath) throw new HttpsError("permission-denied", "Kein Zugang zu diesem Chat.");
    const message = await scope.ref.collection("messages").doc(item.messageId).get();
    if (!message.exists || message.data().deleted || message.data().attachment?.id !== attachmentId) throw new HttpsError("not-found", "Anhang wurde gelöscht.");
    return { file: bucket.file(item.storagePath), fileType: item.fileType };
  }
  return { begin, finish, read };
}
async function removeChatAttachment({ db, bucket }, message) {
  const id = message?.attachment?.id;
  if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(id)) return;
  const ref = db.collection("eventChatAttachments").doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) return;
  const item = snapshot.data();
  if (!item.storagePath?.startsWith(`event-chat-attachments/${item.uploadedBy}/${id}/`)) throw new Error("Ungültiger Anhang-Speicherort.");
  await bucket.file(item.storagePath).delete({ ignoreNotFound: true });
  await ref.delete();
}
module.exports = { createEventChatAttachments, removeChatAttachment };
