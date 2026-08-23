import { randomBytes, createHash } from "node:crypto";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const value = process.argv[index];
  if (!value.startsWith("--")) continue;
  const key = value.slice(2);
  const next = process.argv[index + 1];
  if (!next || next.startsWith("--")) args.set(key, true);
  else {
    args.set(key, next);
    index += 1;
  }
}

const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT || "prodigitaltv-da47b";
const publicBaseUrl = "https://prodigitaltv-da47b.web.app";
const email = String(args.get("to") || "kj_privat@yahoo.de").trim().toLowerCase();

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function clean(value = "") {
  return String(value || "").trim();
}

function defaultMemberLoginInvitationText() {
  return [
    "Guten Tag {{displayName}},",
    "",
    "fuer Sie wurde ein Zugang zum PROdigitalTV-System vorbereitet.",
    "",
    "Rolle: {{role}}",
    "Memberprofil: {{memberName}}",
    "",
    "Bitte legitimieren Sie sich ueber den folgenden Link und vergeben Sie Ihr persoenliches Passwort:",
    "{{invitationLink}}",
    "",
    "Der Link ist 12 Stunden gueltig. Falls er abgelaufen ist, kann jederzeit ein neuer Link angefordert werden.",
    "",
    "Viele Gruesse",
    "PROdigitalTV"
  ].join("\n");
}

function renderTemplate(template = "", variables = {}) {
  return String(template || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => clean(variables[key] || ""));
}

if (!email || !email.includes("@")) throw new Error("Bitte --to mit gueltiger Mailadresse angeben.");

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const users = await db.collection("users").where("email", "==", email).limit(1).get();
if (users.empty) throw new Error(`Kein User mit ${email} gefunden.`);

const userDoc = users.docs[0];
const user = { id: userDoc.id, ...userDoc.data() };
const memberId = clean(user.memberId);
const memberSnap = memberId ? await db.collection("members").doc(memberId).get() : null;
const member = memberSnap?.exists ? { id: memberSnap.id, ...memberSnap.data() } : {};

const token = randomBytes(32).toString("hex");
const invitationId = `user-invite-${Date.now()}-${randomBytes(5).toString("hex")}`;
const invitationLink = `${publicBaseUrl}/user-invite/${encodeURIComponent(invitationId)}/${encodeURIComponent(token)}`;
const expiresAtDate = new Date(Date.now() + 12 * 60 * 60 * 1000);
const displayName = clean(user.displayName || member.profileContactName || member.contactName || email);
const role = clean(user.role || "member");
const memberName = clean(member.name || member.company || member.title || member.id || memberId || "");

const templatesSnap = await db.collection("settings").doc("mailTemplates").get().catch(() => null);
const templateText = clean(templatesSnap?.data()?.value?.memberLoginInvitation || templatesSnap?.data()?.memberLoginInvitation) || defaultMemberLoginInvitationText();

await db.collection("userInvitations").doc(invitationId).set({
  id: invitationId,
  uid: user.id,
  email,
  displayName,
  role,
  memberId,
  memberName,
  invitationLink,
  tokenHash: hashToken(token),
  status: "pending",
  deliveryMode: "manual",
  mailStatus: "queued",
  createdAt: FieldValue.serverTimestamp(),
  updatedAt: FieldValue.serverTimestamp(),
  expiresAt: Timestamp.fromDate(expiresAtDate),
  createdBy: "codex-test-login-mail"
});

await db.collection("users").doc(user.id).set({
  invitationId,
  invitationStatus: "pending",
  invitationDelivery: "manual",
  invitationMailStatus: "queued",
  invitationExpiresAt: Timestamp.fromDate(expiresAtDate),
  updatedAt: FieldValue.serverTimestamp()
}, { merge: true });

const renderedText = renderTemplate(templateText, {
  displayName,
  role,
  memberName,
  invitationLink,
  link: invitationLink
});

const mailRef = await db.collection("mailQueue").add({
  type: "member_login_invitation",
  template: "member_login_invitation",
  userInvitationId: invitationId,
  userId: user.id,
  memberId,
  to: email,
  subject: "Ihr PROdigitalTV-Zugang",
  displayName,
  role,
  memberName,
  invitationLink,
  link: invitationLink,
  mailText: templateText,
  text: renderedText,
  status: "queued",
  queuedAt: FieldValue.serverTimestamp(),
  createdAt: FieldValue.serverTimestamp(),
  updatedAt: FieldValue.serverTimestamp(),
  source: "codex-login-mail-preview"
});

await db.collection("userInvitations").doc(invitationId).set({
  mailQueueId: mailRef.id,
  mailQueuedAt: FieldValue.serverTimestamp()
}, { merge: true });

console.log(JSON.stringify({
  ok: true,
  projectId,
  to: email,
  mailQueueId: mailRef.id,
  invitationId,
  invitationLink,
  expiresAt: expiresAtDate.toISOString()
}, null, 2));
