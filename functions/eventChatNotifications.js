const { createHash } = require("node:crypto");
const millis = value => value?.toMillis?.() || 0;
const online = (sessions, now = Date.now()) => sessions.some(session =>
  session.visible === true && millis(session.seenAt) > now - 90000);

function notificationDecision(message, thread, receiver, sessions, now = Date.now()) {
  if (!message || message.deleted) return "skip";
  const readAt = millis(thread.lastReadAt?.[receiver]);
  if (readAt >= millis(message.createdAt)) return "skip";
  if (online(sessions, now)) return "wait";
  const notifiedAt = millis(thread.notificationThrough?.[receiver]);
  if (notifiedAt && readAt < notifiedAt) return "skip";
  return "send";
}

function createEventChatNotifications({ db, pushService, FieldValue, Timestamp, contactId, HttpsError }) {
  async function presence(request) {
    if (!request.auth?.token?.email_verified || !request.auth.token.email) {
      throw new HttpsError("unauthenticated", "Bitte zuerst mit bestaetigter E-Mail anmelden.");
    }
    const sessionId = String(request.data?.sessionId || "");
    if (!/^[a-zA-Z0-9-]{16,80}$/.test(sessionId)) throw new HttpsError("invalid-argument", "Sitzung fehlt.");
    await db.collection("eventChatPresence").doc(contactId(request.auth.token.email))
      .collection("sessions").doc(sessionId).set({
        visible: request.data.visible === true,
        seenAt: FieldValue.serverTimestamp(),
        uid: request.auth.uid
      });
    return { saved: true };
  }

  async function sessionsFor(id) {
    const snapshot = await db.collection("eventChatPresence").doc(id).collection("sessions")
      .where("seenAt", ">", Timestamp.fromMillis(Date.now() - 90000)).get();
    return snapshot.docs.map(doc => doc.data());
  }

  async function processJob(jobRef) {
    const claimed = await db.runTransaction(async tx => {
      const snapshot = await tx.get(jobRef);
      const job = snapshot.data();
      if (!job || !["pending", "processing"].includes(job.status) || millis(job.dueAt) > Date.now()) return null;
      tx.update(jobRef, { status: "processing", dueAt: Timestamp.fromMillis(Date.now() + 180000) });
      return job;
    });
    if (!claimed) return;
    const job = claimed;
    const threadRef = db.collection("eventLiveConversations").doc(job.eventId).collection("threads").doc(job.threadId);
    const messageRef = threadRef.collection("messages").doc(job.messageId);
    const finish = async (status, extra = {}) => jobRef.update({
      status, ...extra, updatedAt: FieldValue.serverTimestamp(), dueAt: FieldValue.delete()
    });
    try {
      const [messageSnapshot, threadSnapshot, sessions, eventSnapshot, accessSnapshot] = await Promise.all([
        messageRef.get(), threadRef.get(), sessionsFor(job.receiverContactId),
        db.collection("events").doc(job.eventId).get(),
        db.collection("eventLiveAccess").doc(job.eventId).get()
      ]);
      if (!eventSnapshot.data()?.eventLiveEnabled || !accessSnapshot.data()?.enabled) return finish("skipped", { reason: "event_disabled" });
      const message = messageSnapshot.data();
      const thread = threadSnapshot.data() || {};
      const decision = notificationDecision(message, thread, job.receiverContactId, sessions);
      if (decision === "skip") return finish("skipped", { reason: "read_deleted_or_already_notified" });
      if (decision === "wait") {
        return jobRef.update({ status: "pending", dueAt: Timestamp.fromMillis(Date.now() + 60000) });
      }
      // Resolve recipients from attendance, never from client-supplied addresses.
      const registrations = await db.collection("registrations").where("eventId", "==", job.eventId)
        .where("status", "==", "checked_in").get();
      const receiver = registrations.docs.map(doc => doc.data()).find(record =>
        record.checkedInEventId === job.eventId && record.email && contactId(record.email) === job.receiverContactId);
      if (!receiver) return finish("skipped", { reason: "recipient_not_attending" });
      const contact = (await db.collection("contacts").doc(job.receiverContactId).get()).data() || {};
      const sender = (await db.collection("contacts").doc(message.senderContactId).get()).data() || {};
      const senderName = [sender.firstName, sender.lastName].filter(Boolean).join(" ") || sender.displayName || "Eine teilnehmende Person";
      const link = "https://prodigitaltv.de/#/event-live/" + encodeURIComponent(job.eventId)
        + "?peer=" + encodeURIComponent(message.senderContactId) + "&email=" + encodeURIComponent(receiver.email);
      const result = await pushService.deliver(receiver.email, {
        id: jobRef.id, eventId: job.eventId, title: "Event Chat: " + senderName,
        body: "Eine neue Nachricht wartet auf Sie.", link
      });
      let channel = "push_accepted";
      if (!result.sent) {
        // Retry transient failures before falling back to email.
        const transient = result.failed && result.errors.some(error =>
          !["messaging/registration-token-not-registered", "messaging/invalid-registration-token"].includes(error.code));
        if (transient && (job.attempts || 0) < 2) throw new Error("push_retry");
        if (contact.mailingDisabled || contact.notificationOptOut || receiver.mailingDisabled || receiver.notificationOptOut) {
          return finish("skipped", { reason: "mail_disabled", pushResult: result });
        }
        const key = createHash("sha256").update(job.threadId + ":" + job.receiverContactId + ":" + millis(message.createdAt)).digest("hex");
        const mailRef = db.collection("mailQueue").doc("chat-" + key);
        await db.runTransaction(async tx => {
          const [existing, latestMessage, latestThread] = await Promise.all([tx.get(mailRef), tx.get(messageRef), tx.get(threadRef)]);
          if (existing.exists || notificationDecision(latestMessage.data(), latestThread.data() || {}, job.receiverContactId, []) !== "send") return;
          tx.create(mailRef, {
            type: "event_chat_unread", template: "event_chat_unread", to: receiver.email,
            subject: "Eine Nachricht wartet im PROdigitalTV Event Chat",
            eventId: job.eventId, chatThreadId: job.threadId, chatMessageId: job.messageId,
            receiverContactId: job.receiverContactId, link,
            status: "queued", createdAt: FieldValue.serverTimestamp(), queuedAt: FieldValue.serverTimestamp()
          });
        });
        channel = "mail_queued";
      }
      await db.runTransaction(async tx => {
        const current = await tx.get(threadRef);
        // Do not recreate a conversation removed by Chat Reset.
        if (current.exists) tx.set(threadRef, { notificationThrough: { [job.receiverContactId]: message.createdAt } }, { merge: true });
        tx.update(jobRef, { status: channel, pushResult: result, updatedAt: FieldValue.serverTimestamp(), dueAt: FieldValue.delete() });
      });
    } catch (error) {
      const attempts = (job.attempts || 0) + 1;
      await jobRef.update({
        status: attempts >= 5 ? "failed" : "pending", attempts,
        errorCode: String(error.code || error.message || "delivery_failed").slice(0, 100),
        dueAt: attempts >= 5 ? FieldValue.delete() : Timestamp.fromMillis(Date.now() + 60000 * Math.min(attempts, 5)),
        updatedAt: FieldValue.serverTimestamp()
      });
    }
  }

  async function processPending() {
    const jobs = await db.collection("eventChatNotifications").where("dueAt", "<=", Timestamp.now()).limit(100).get();
    for (const job of jobs.docs) await processJob(job.ref);
  }
  return { presence, sessionsFor, processPending };
}
module.exports = { createEventChatNotifications, online, notificationDecision };
