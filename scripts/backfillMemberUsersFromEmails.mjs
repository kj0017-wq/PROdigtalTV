import { randomBytes, createHash } from "node:crypto";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT || "prodigitaltv-da47b";
const apply = process.argv.includes("--apply");

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();
const auth = getAuth();

function clean(value = "") {
  return String(value || "").trim();
}

function normalizeEmail(value = "") {
  return clean(value).toLowerCase();
}

function displayNameFromEmail(email = "") {
  const local = normalizeEmail(email).split("@")[0] || "";
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function collectMemberEmails(member = {}) {
  const values = [
    member.contactEmail,
    member.email,
    member.profileEmail,
    member.primaryEmail
  ];
  if (Array.isArray(member.eventContacts)) {
    member.eventContacts.forEach((contact) => values.push(contact?.email, contact?.contactEmail));
  }
  if (Array.isArray(member.contacts)) {
    member.contacts.forEach((contact) => values.push(contact?.email, contact?.contactEmail));
  }
  return [...new Set(values.map(normalizeEmail).filter((email) => email.includes("@")))];
}

function memberIsActive(member = {}) {
  const status = normalizeEmail(member.status || "active");
  const access = normalizeEmail(member.membershipAccessStatus || "active");
  return !["archived", "deleted", "inactive", "cancelled"].includes(status)
    && !["inactive", "cancelled"].includes(access);
}

function contactLooksMember(contact = {}) {
  return Boolean(contact.memberId || contact.isMember || contact.source === "member" || contact.type === "member");
}

function contactIdFallback(email = "") {
  return `contact-${createHash("sha256").update(normalizeEmail(email)).digest("hex").slice(0, 32)}`;
}

async function getOrCreateAuthUser(candidate) {
  try {
    return await auth.getUserByEmail(candidate.email);
  } catch (error) {
    if (error?.code !== "auth/user-not-found") throw error;
    return auth.createUser({
      email: candidate.email,
      password: randomBytes(24).toString("hex"),
      displayName: candidate.displayName,
      emailVerified: false,
      disabled: false
    });
  }
}

const [membersSnapshot, contactsSnapshot, usersSnapshot] = await Promise.all([
  db.collection("members").get(),
  db.collection("contacts").get().catch(() => ({ docs: [] })),
  db.collection("users").get().catch(() => ({ docs: [] }))
]);

const membersById = new Map(membersSnapshot.docs.map((document) => [document.id, { id: document.id, ...document.data() }]));
const candidatesByEmail = new Map();

for (const member of membersById.values()) {
  if (!memberIsActive(member)) continue;
  const memberName = clean(member.name || member.company || member.title || member.id);
  for (const email of collectMemberEmails(member)) {
    const contact = Array.isArray(member.eventContacts)
      ? member.eventContacts.find((item) => normalizeEmail(item?.email || item?.contactEmail) === email)
      : null;
    const displayName = clean(contact?.name || [contact?.firstName, contact?.lastName].filter(Boolean).join(" ") || member.profileContactName || member.contactName || memberName || displayNameFromEmail(email));
    candidatesByEmail.set(email, {
      email,
      displayName,
      role: "member",
      status: "active",
      memberId: member.id,
      memberName,
      source: "member"
    });
  }
}

for (const document of contactsSnapshot.docs) {
  const contact = { id: document.id, ...document.data() };
  if (!contactLooksMember(contact)) continue;
  const email = normalizeEmail(contact.email || contact.contactEmail || contact.primaryEmail);
  if (!email || candidatesByEmail.has(email)) continue;
  const member = membersById.get(clean(contact.memberId));
  candidatesByEmail.set(email, {
    email,
    displayName: clean([contact.firstName, contact.lastName].filter(Boolean).join(" ") || contact.name || contact.displayName || displayNameFromEmail(email)),
    role: "member",
    status: contact.mailingDisabled || contact.disabled || contact.inactive ? "inactive" : "active",
    memberId: member?.id || clean(contact.memberId),
    memberName: member?.name || contact.company || "",
    source: "contact-member"
  });
}

const existingUsersByEmail = new Map(usersSnapshot.docs
  .map((document) => ({ id: document.id, ...document.data() }))
  .map((user) => [normalizeEmail(user.email), user])
  .filter(([email]) => email));

const candidates = [...candidatesByEmail.values()].sort((a, b) => a.email.localeCompare(b.email));
const rows = [];
let created = 0;
let updated = 0;
let skipped = 0;

for (const candidate of candidates) {
  const existing = existingUsersByEmail.get(candidate.email);
  const action = existing ? "update" : "create";
  rows.push({
    action: apply ? action : `dry-${action}`,
    email: candidate.email,
    displayName: candidate.displayName,
    memberId: candidate.memberId || "-",
    memberName: candidate.memberName || "-",
    existingUserId: existing?.id || "-"
  });
  if (!apply) continue;

  const authUser = existing?.id && !existing.id.startsWith("user-") && !existing.id.startsWith("contact-")
    ? await auth.getUser(existing.id).catch(() => getOrCreateAuthUser(candidate))
    : await getOrCreateAuthUser(candidate);

  const userRef = db.collection("users").doc(authUser.uid);
  await userRef.set({
    email: candidate.email,
    displayName: existing?.displayName || candidate.displayName,
    role: existing?.role || candidate.role,
    status: existing?.status || candidate.status,
    memberId: existing?.memberId || candidate.memberId || "",
    source: existing?.source || "member-email-backfill",
    invitationDelivery: existing?.invitationDelivery || "manual",
    invitationMailStatus: existing?.invitationMailStatus || "not_sent",
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  if (candidate.memberId && membersById.has(candidate.memberId)) {
    await db.collection("members").doc(candidate.memberId).set({
      linkedUserIds: FieldValue.arrayUnion(authUser.uid),
      linkedUserEmails: FieldValue.arrayUnion(candidate.email),
      linkedUsers: FieldValue.arrayUnion({
        uid: authUser.uid,
        email: candidate.email,
        displayName: existing?.displayName || candidate.displayName,
        role: existing?.role || candidate.role
      }),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  }

  if (existing) updated += 1;
  else created += 1;
}

if (!candidates.length) skipped = 1;

console.table(rows.map((row) => ({
  Aktion: row.action,
  Mail: row.email,
  Name: row.displayName,
  Memberprofil: row.memberName,
  "bestehender User": row.existingUserId
})));

console.log(JSON.stringify({
  projectId,
  apply,
  candidates: candidates.length,
  created,
  updated,
  skipped,
  mailQueueCreated: 0
}, null, 2));

if (!apply) {
  console.log("Dry-run: Es wurde nichts geschrieben und keine Mail ausgeloest. Fuer echtes Schreiben: node scripts/backfillMemberUsersFromEmails.mjs --apply");
}
