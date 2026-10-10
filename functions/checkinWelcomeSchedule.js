const { createHash } = require("node:crypto");
const { eventLiveBounds } = require("./eventLiveDomain");

function welcomeDueAt(event, source = "") {
  const { start } = eventLiveBounds(event);
  const minutes = ["board_group_checkin", "speakers_group_checkin"].includes(source) ? 15 : 30;
  return start ? start - minutes * 60 * 1000 : 0;
}

function createWelcomeSchedule({ db, FieldValue, Timestamp, now = Date.now }) {
  async function schedule(payload) {
    const id = "welcome-" + createHash("sha256").update(`${payload.eventId}:${payload.registrationId}`).digest("hex");
    const ref = db.collection("checkinWelcomeJobs").doc(id);
    const event = await db.collection("events").doc(payload.eventId).get();
    const dueAt = welcomeDueAt(event.data() || {}, payload.source);
    await db.runTransaction(async (tx) => {
      const existing = await tx.get(ref);
      const mail = await tx.get(db.collection("mailQueue").doc(id));
      if (existing.exists || mail.exists) return;
      tx.set(ref, {
        ...payload, status: "pending",
        scheduledAt: dueAt ? Timestamp.fromMillis(dueAt) : null,
        createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
      });
    });
    return ref;
  }

  async function process() {
    // Re-read event times, including jobs moved earlier after the initial check-in.
    const jobs = await db.collection("checkinWelcomeJobs").where("status", "==", "pending").get();
    for (const job of jobs.docs) {
      await db.runTransaction(async (tx) => {
        const snapshot = await tx.get(job.ref);
        if (!snapshot.exists || snapshot.data().status !== "pending") return;
        const payload = snapshot.data();
        const event = await tx.get(db.collection("events").doc(payload.eventId));
        const registration = await tx.get(db.collection("registrations").doc(payload.registrationId));
        const mailRef = db.collection("mailQueue").doc(job.id);
        const mail = await tx.get(mailRef);
        const person = registration.data() || {};
        const eventRecord = event.data() || {};
        const inactive = ["cancelled", "canceled", "deleted", "archived", "inactive", "hidden", "draft"];
        if (mail.exists || !event.exists || !registration.exists || person.eventId !== payload.eventId || person.status !== "checked_in" || !person.email || inactive.includes(String(eventRecord.status || "").toLowerCase())) {
          tx.update(job.ref, { status: mail.exists ? "released" : "skipped", updatedAt: FieldValue.serverTimestamp() });
          return;
        }
        const dueAt = welcomeDueAt(eventRecord, payload.source);
        if (!dueAt || dueAt > now()) {
          if ((payload.scheduledAt?.toMillis?.() || 0) !== dueAt) {
            tx.update(job.ref, { scheduledAt: dueAt ? Timestamp.fromMillis(dueAt) : null, updatedAt: FieldValue.serverTimestamp() });
          }
          return;
        }
        tx.set(mailRef, {
          type: "checkin_agenda", template: "checkin_agenda", to: person.email,
          subject: `Willkommen: ${eventRecord.title || "PROdigitalTV Event"}`,
          registrationId: payload.registrationId, eventId: payload.eventId,
          dedupeKey: payload.dedupeKey, source: payload.source || "checkin",
          status: "queued", queuedAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
        });
        tx.update(job.ref, { status: "released", releasedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      });
    }
  }
  return { schedule, process };
}

module.exports = { welcomeDueAt, createWelcomeSchedule };
