const { createHash, randomBytes } = require("node:crypto");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");

initializeApp();
const db = getFirestore();
const region = "europe-west3";

const openaiFunctions = require("./openaiFunctions");
Object.assign(exports, openaiFunctions);

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

async function queueMail(payload) {
  return db.collection("mailQueue").add({
    ...payload,
    status: "queued",
    queuedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
}

async function requireEditor(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login erforderlich.");
  const profile = (await db.collection("users").doc(request.auth.uid).get()).data();
  if (!["admin", "editor"].includes(profile?.role)) throw new HttpsError("permission-denied", "Keine CMS-Berechtigung.");
  return profile;
}

exports.bootstrapFirstAdmin = onCall({ region }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login erforderlich.");
  const existingAdmin = await db.collection("users")
    .where("role", "==", "admin")
    .where("status", "==", "active")
    .limit(1)
    .get();
  if (!existingAdmin.empty) {
    throw new HttpsError("permission-denied", "Ein aktiver Admin existiert bereits. Rollen koennen nur im CMS oder direkt in Firestore geaendert werden.");
  }
  const user = {
    email: request.auth.token.email || "",
    displayName: request.auth.token.name || request.auth.token.email || "Administrator",
    firstName: "",
    lastName: "",
    role: "admin",
    status: "active",
    emailVerified: Boolean(request.auth.token.email_verified),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: "bootstrapFirstAdmin",
    internalNote: "Erster Admin wurde ueber die Setup-Bootstrap-Funktion angelegt."
  };
  await db.collection("users").doc(request.auth.uid).set(user, { merge: true });
  await db.collection("auditLog").add({
    action: "bootstrap_first_admin",
    module: "system",
    entityType: "user",
    entityId: request.auth.uid,
    userId: request.auth.uid,
    userEmail: user.email,
    timestamp: FieldValue.serverTimestamp(),
    details: { role: "admin" }
  });
  return { ok: true, role: "admin", message: "Erster Admin wurde freigeschaltet." };
});

exports.onRegistrationCreated = onDocumentCreated({ document: "registrations/{registrationId}", region }, async (event) => {
  const registration = event.data.data();
  if (registration.status !== "pending_email_confirmation") return;
  const eventRecord = (await db.collection("events").doc(registration.eventId).get()).data();
  if (!eventRecord) {
    await event.data.ref.update({ status: "cancelled", internalNote: "Referenziertes Event nicht gefunden.", updatedAt: FieldValue.serverTimestamp() });
    return;
  }
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = Timestamp.fromMillis(Date.now() + 48 * 60 * 60 * 1000);
  await event.data.ref.update({ eventTitle: eventRecord.title, eventDate: eventRecord.date, eventAccessType: eventRecord.accessType, confirmationTokenHash: tokenHash, confirmationExpiresAt: expiresAt, updatedAt: FieldValue.serverTimestamp() });
  await queueMail({
    type: "registration_confirmation",
    to: registration.email,
    subject: `Bitte bestaetigen Sie Ihre Anmeldung: ${eventRecord.title}`,
    template: "registration_confirmation",
    eventId: registration.eventId,
    registrationId: event.params.registrationId,
    confirmationUrl: `https://www.prodigitaltv.de/confirm.html?token=${token}`,
    tokenExpiresAt: expiresAt
  });
  await queueMail({
    type: "admin_notification",
    to: "events@prodigitaltv.de",
    subject: `Neue Anmeldung: ${eventRecord.title}`,
    template: "admin_notification",
    eventId: registration.eventId,
    registrationId: event.params.registrationId
  });
});

exports.sendRegistrationConfirmationMail = onCall({ region }, async (request) => {
  const { registrationId } = request.data || {};
  if (!registrationId) throw new HttpsError("invalid-argument", "registrationId fehlt.");
  const snapshot = await db.collection("registrations").doc(registrationId).get();
  if (!snapshot.exists) throw new HttpsError("not-found", "Anmeldung nicht gefunden.");
  // The creation trigger queues the initial email; this endpoint is reserved for explicit app workflows.
  return { queued: true, registrationId };
});

exports.confirmRegistrationByToken = onCall({ region }, async (request) => {
  const token = request.data?.token;
  if (!token) throw new HttpsError("invalid-argument", "Token fehlt.");
  const result = await db.collection("registrations").where("confirmationTokenHash", "==", hashToken(token)).limit(1).get();
  if (result.empty) throw new HttpsError("not-found", "Bestaetigungslink ist ungueltig.");
  const document = result.docs[0];
  const registration = document.data();
  if (registration.confirmationExpiresAt.toMillis() < Date.now()) {
    await document.ref.update({ status: "expired", updatedAt: FieldValue.serverTimestamp() });
    throw new HttpsError("deadline-exceeded", "Bestaetigungslink ist abgelaufen.");
  }
  await document.ref.update({
    status: "confirmed", emailConfirmed: true, confirmedAt: FieldValue.serverTimestamp(),
    confirmationTokenHash: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp()
  });
  await queueMail({
    type: "registration_confirmed", to: registration.email,
    subject: `Anmeldung bestaetigt: ${registration.eventTitle}`, template: "registration_confirmed",
    eventId: registration.eventId, registrationId: document.id
  });
  return { confirmed: true, message: "Ihre Anmeldung wurde erfolgreich bestaetigt." };
});

exports.resendConfirmationMail = onCall({ region }, async (request) => {
  await requireEditor(request);
  const ref = db.collection("registrations").doc(request.data.registrationId);
  const snapshot = await ref.get();
  if (!snapshot.exists || snapshot.data().emailConfirmed) throw new HttpsError("failed-precondition", "Keine offene Bestaetigung.");
  const token = randomBytes(32).toString("hex");
  const expiresAt = Timestamp.fromMillis(Date.now() + 48 * 60 * 60 * 1000);
  await ref.update({ confirmationTokenHash: hashToken(token), confirmationExpiresAt: expiresAt, updatedAt: FieldValue.serverTimestamp() });
  await queueMail({
    type: "registration_confirmation", to: snapshot.data().email,
    subject: `Bitte bestaetigen Sie Ihre Anmeldung: ${snapshot.data().eventTitle}`,
    template: "registration_confirmation", registrationId: snapshot.id, eventId: snapshot.data().eventId,
    confirmationUrl: `https://www.prodigitaltv.de/confirm.html?token=${token}`, tokenExpiresAt: expiresAt
  });
  return { queued: true };
});

exports.notifyAdminAboutRegistration = onCall({ region }, async (request) => {
  await requireEditor(request);
  const registration = (await db.collection("registrations").doc(request.data.registrationId).get()).data();
  await queueMail({ type: "admin_notification", to: "events@prodigitaltv.de", subject: `Anmeldung: ${registration.eventTitle}`, template: "admin_notification", registrationId: request.data.registrationId, eventId: registration.eventId });
  return { queued: true };
});

exports.cleanupExpiredConfirmations = onSchedule({ schedule: "every day 03:00", region, timeZone: "Europe/Berlin" }, async () => {
  const expired = await db.collection("registrations")
    .where("status", "==", "pending_email_confirmation")
    .where("confirmationExpiresAt", "<", Timestamp.now()).get();
  const batch = db.batch();
  expired.forEach((document) => batch.update(document.ref, { status: "expired", updatedAt: FieldValue.serverTimestamp() }));
  await batch.commit();
});

/*
 * Mail delivery adapter:
 * A production installation should trigger on mailQueue documents with status
 * "queued", deliver through Postmark/Brevo/SendGrid and then write "sent" or
 * "failed". Credentials belong in Firebase Secret Manager, never in source.
 */
