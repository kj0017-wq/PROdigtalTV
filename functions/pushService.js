const { createHash } = require("node:crypto");
const hash = (value) => createHash("sha256").update(String(value || "")).digest("hex");
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const invalidTokenCodes = new Set(["messaging/registration-token-not-registered", "messaging/invalid-registration-token"]);

function createPushService({ db, messaging, FieldValue, HttpsError }) {
  async function identity(request) {
    const data = request.data || {};
    if (request.auth?.token?.email_verified === true && request.auth.token.email) {
      return { email: normalizeEmail(request.auth.token.email), uid: request.auth.uid, registrationId: "" };
    }
    const proof = String(data.registrationProof || data.ticketToken || "");
    if (!/^[a-f0-9]{64}$/i.test(proof)) throw new HttpsError("unauthenticated", "Bitte mit bestaetigter E-Mail anmelden oder den Bestaetigungs-/Ticket-Link Ihrer Anmeldung oeffnen.");
    const field = data.registrationProof ? "pushEnrollmentTokenHash" : "ticketTokenHash";
    const result = await db.collection("registrations").where(field, "==", hash(proof)).limit(1).get();
    const doc = result.docs[0];
    const registration = doc?.data();
    if (!registration?.emailConfirmed || !["confirmed", "checked_in"].includes(registration.status)) throw new HttpsError("permission-denied", "Die Anmeldung ist nicht bestaetigt oder nicht mehr aktiv.");
    if (data.registrationProof && !(registration.pushEnrollmentExpiresAt?.toMillis?.() > Date.now())) throw new HttpsError("permission-denied", "Die Push-Freigabe ist abgelaufen. Bitte erneut anmelden.");
    if (data.eventId && registration.eventId !== data.eventId) throw new HttpsError("permission-denied", "Die Freigabe gehoert zu einer anderen Veranstaltung.");
    return { email: normalizeEmail(registration.email), uid: "", registrationId: doc.id };
  }

  function deviceRef(data) {
    if (typeof data.token !== "string" || !data.token.trim() || data.token.length > 4096) throw new HttpsError("invalid-argument", "Push-Token fehlt oder ist ungueltig.");
    if (!/^[a-f0-9]{64}$/i.test(data.deviceSecret || "")) throw new HttpsError("invalid-argument", "Geraeteschluessel fehlt.");
    return db.collection("notificationTokens").doc(`notification-token-${hash(data.token).slice(0, 40)}`);
  }

  async function register(request) {
    const data = request.data || {};
    const person = await identity(request);
    if (data.email && normalizeEmail(data.email) !== person.email) throw new HttpsError("permission-denied", "Die Push-Adresse stimmt nicht mit der bestaetigten Adresse ueberein.");
    if (data.permission !== "granted") throw new HttpsError("failed-precondition", "Push-Berechtigung wurde nicht erteilt.");
    const ref = deviceRef(data);
    await db.runTransaction(async (transaction) => {
      const old = await transaction.get(ref);
      const now = FieldValue.serverTimestamp();
      transaction.set(ref, {
        token: data.token, ...person, status: "active", verified: true,
        deviceSecretHash: hash(data.deviceSecret), permission: "granted",
        eventId: String(data.eventId || ""), source: "verified_browser",
        userAgent: String(data.userAgent || "").slice(0, 512), platform: String(data.platform || "").slice(0, 100),
        origin: String(data.origin || "").slice(0, 250),
        lastSeenAt: now, updatedAt: now, ...(!old.exists ? { createdAt: now } : {})
      }, { merge: true });
    });
    return { status: "active", id: ref.id, email: person.email };
  }

  async function deviceStatus(request, deactivate = false) {
    const data = request.data || {};
    const ref = deviceRef(data);
    return db.runTransaction(async (transaction) => {
      const doc = await transaction.get(ref);
      if (!doc.exists) return { status: "inactive" };
      const record = doc.data();
      if (record.deviceSecretHash !== hash(data.deviceSecret)) throw new HttpsError("permission-denied", "Dieses Geraet ist nicht verknuepft.");
      if (deactivate) transaction.set(ref, { status: "inactive", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return { status: !deactivate && record.verified === true && record.status === "active" ? "active" : "inactive" };
    });
  }

  async function deliver(email, notification = {}) {
    const summary = { attempted: 0, sent: 0, failed: 0, errors: [] };
    let docs;
    try {
      docs = (await db.collection("notificationTokens").where("email", "==", normalizeEmail(email)).get()).docs;
    } catch (error) {
      return { ...summary, failed: 1, errors: [{ code: String(error.code || "token-read-failed") }] };
    }
    for (const doc of docs) {
      const record = doc.data();
      if (!record.token || record.status !== "active" || record.verified !== true) continue;
      summary.attempted++;
      try {
        await messaging.send({
          token: record.token,
          data: { title: String(notification.title || "PROdigitalTV"), body: String(notification.body || "").slice(0, 500),
            eventId: String(notification.eventId || ""), notificationId: String(notification.id || ""), link: String(notification.link || "/") },
          webpush: { headers: { TTL: "86400", Urgency: "high" } }
        });
        summary.sent++;
        await doc.ref.set({ lastSuccessAt: FieldValue.serverTimestamp(), lastErrorCode: "", updatedAt: FieldValue.serverTimestamp() }, { merge: true })
          .catch(() => { summary.errors.push({ deviceId: doc.id, code: "success-log-failed" }); });
      } catch (error) {
        const code = String(error.code || "push-send-failed");
        summary.failed++;
        summary.errors.push({ deviceId: doc.id, code });
        await doc.ref.set({ lastErrorCode: code, lastErrorAt: FieldValue.serverTimestamp(),
          ...(invalidTokenCodes.has(code) ? { status: "invalid" } : {}) }, { merge: true }).catch(() => {});
      }
    }
    return summary;
  }
  return { register, deviceStatus, deliver };
}

module.exports = { createPushService };
