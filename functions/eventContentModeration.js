const { removeChatAttachment } = require("./eventChatAttachments");
const { randomUUID } = require("node:crypto");

function createEventContentModeration({ db, requireAdmin, bucket, HttpsError, FieldValue }) {
  const id = (value) => {
    if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,160}$/.test(value)) throw new HttpsError("invalid-argument", "Ungültiger Verweis.");
    return value;
  };
  async function access(request) {
    await requireAdmin(request);
    const eventId = id(request.data?.eventId);
    const event = await db.collection("events").doc(eventId).get();
    if (!event.exists) throw new HttpsError("not-found", "Veranstaltung nicht gefunden.");
    return { eventId, event, root: db.collection("eventLiveConversations").doc(eventId) };
  }
  async function channels(root) {
    // listDocuments also finds channels whose parent document was never written.
    return [...await root.collection("groups").listDocuments(), ...await root.collection("threads").listDocuments()];
  }
  function participantPhoto(doc, eventId) {
    const photo = doc.data();
    return photo.eventId === eventId && photo.mediaType === "image"
      && ["portal-gallery-upload", "member-material-upload"].includes(photo.source);
  }
  async function list(request) {
    const { eventId, event, root } = await access(request);
    const messages = [];
    for (const channel of await channels(root)) {
      const snapshot = await channel.collection("messages").get();
      for (const doc of snapshot.docs) {
        const item = doc.data();
        if (item.deleted) continue;
        messages.push({ id: doc.id, channelId: channel.id,
          channelType: channel.parent.id, text: item.text || (item.attachment ? (item.attachment.fileType?.startsWith("video/") ? "Video: " : "Foto: ") + item.attachment.fileName : ""),
          senderContactId: item.senderContactId || "",
          createdAt: item.createdAt?.toDate?.().toISOString() || "" });
      }
    }
    messages.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const snapshot = await db.collection("eventMedia").where("eventId", "==", eventId).get();
    const photos = snapshot.docs.filter(doc => participantPhoto(doc, eventId)).map(doc => {
      const photo = doc.data();
      return { id: doc.id, fileName: photo.fileName || "", caption: photo.caption || photo.note || "",
        uploadedByName: photo.uploadedByName || "", status: photo.status || "" };
    });
    const offset = (value, length) => Math.min(Math.max(0, Math.floor((Number(value) || 0) / 500) * 500), Math.max(0, Math.floor((length - 1) / 500) * 500));
    const messageOffset = offset(request.data?.messageOffset, messages.length);
    const photoOffset = offset(request.data?.photoOffset, photos.length);
    return { eventTitle: event.data().title || "Veranstaltung", messages: messages.slice(messageOffset, messageOffset + 500),
      messageCount: messages.length, photos: photos.slice(photoOffset, photoOffset + 500), photoCount: photos.length,
      messageOffset, photoOffset };
  }
  async function remove(request) {
    const { eventId, root } = await access(request);
    if (request.data?.confirmed !== true) throw new HttpsError("failed-precondition", "Löschen bitte bestätigen.");
    const kind = request.data?.kind;
    const all = request.data?.all === true;
    if (!["messages", "photos", "all"].includes(kind) || (kind === "all" && !all)) throw new HttpsError("invalid-argument", "Löschumfang fehlt.");
    let deletedMessages = 0;
    let deletedPhotos = 0;
    if (kind === "messages" || kind === "all") {
      const selected = all ? await channels(root) : [
        root.collection(["groups", "threads"].includes(request.data?.channelType)
          ? request.data.channelType : (() => { throw new HttpsError("invalid-argument", "Chat fehlt."); })())
          .doc(id(request.data?.channelId))
      ];
      for (const channel of selected) {
        const docs = all ? (await channel.collection("messages").get()).docs
          : [await channel.collection("messages").doc(id(request.data?.messageId)).get()].filter(doc => doc.exists);
        for (let offset = 0; offset < docs.length; offset += 400) {
          const chunk = docs.slice(offset, offset + 400);
          for (const doc of chunk) await removeChatAttachment({ db, bucket }, doc.data());
          const batch = db.batch();
          chunk.forEach(doc => batch.delete(doc.ref));
          batch.set(root, { moderationRevision: randomUUID() }, { merge: true });
          await batch.commit();
          deletedMessages += chunk.length;
        }
        const deletedIds = new Set(docs.map(doc => doc.id));
        await db.runTransaction(async tx => {
          const current = await tx.get(channel);
          if (deletedIds.has(current.data()?.lastMessageId)) {
            tx.set(channel, { lastText: "", lastMessageId: "", lastSenderContactId: "",
              lastMessageAt: FieldValue.delete() }, { merge: true });
          }
        });
      }
    }
    if (kind === "photos" || kind === "all") {
      const docs = all ? (await db.collection("eventMedia").where("eventId", "==", eventId).get()).docs
        : [await db.collection("eventMedia").doc(id(request.data?.photoId)).get()].filter(doc => doc.exists);
      for (const doc of docs) {
        if (!participantPhoto(doc, eventId)) {
          if (!all) throw new HttpsError("permission-denied", "Dieses Foto gehört nicht zu den Teilnehmerfotos dieses Events.");
          continue;
        }
        const path = doc.data().storagePath;
        if (path) {
          if (!/^(portal-gallery-photos|images\/events|images\/galleries)\//.test(path) || path.includes("..")) {
            throw new HttpsError("failed-precondition", "Foto-Speicherort konnte nicht sicher zugeordnet werden.");
          }
          // Keep the record on failure so deleting the file can be retried.
          await bucket.file(path).delete({ ignoreNotFound: true });
        }
        await doc.ref.delete();
        deletedPhotos++;
      }
    }
    return { deletedMessages, deletedPhotos };
  }
  return { list, remove };
}
module.exports = { createEventContentModeration };
