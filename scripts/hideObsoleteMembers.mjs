import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

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

const currentMemberIds = new Set([
  "bibel-tv-stiftung",
  "channel-21",
  "kj-technical-consulting-klaus-juli",
  "dsc-dietmar-schickel-consulting",
  "ors-comm",
  "buero-fuer-moderne-werbung-tv",
  "markus-vogelbacher",
  "blu-tec-one",
  "house-of-research",
  "goldvisite-media",
  "schneider-enterprise",
  "fashion-tv-production",
  "stingray-digital-international",
  "eutelsat-services-beteiligungen",
  "farbi-flora",
  "anixe-hd",
  "js-consult",
  "thorsten-lork",
  "red-bull-media-house",
  "hardy-heine",
  "no-limits-media",
  "itsmaxsuhr",
  "major-seven-consulting",
  "sebastian-labonte",
  "michael-kayser",
  "idee-medien",
  "conrad-heberling",
  "tv-2000plus",
  "3q",
  "johannes-kors",
  "claudio-malasomma-bellavista"
]);

const serviceAccountPath = args.get("service-account") || process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!serviceAccountPath) throw new Error("Bitte --service-account <pfad> angeben.");

const apply = args.has("apply");
const serviceAccount = JSON.parse(await readFile(resolve(serviceAccountPath), "utf8"));
const projectId = args.get("project-id") || serviceAccount.project_id || "prodigitaltv-da47b";

initializeApp({ credential: cert(serviceAccount), projectId });
const db = getFirestore();
const snapshot = await db.collection("members").get();
const obsolete = snapshot.docs
  .map((doc) => ({ id: doc.id, ...doc.data() }))
  .filter((member) => !currentMemberIds.has(member.id));

console.log(`${obsolete.length} veraltete Mitglieder-Datensaetze gefunden.`);
console.table(obsolete.map((member) => ({
  id: member.id,
  name: member.name || "",
  status: member.status || "",
  visibility: member.visibility || "",
  visible: member.visible,
  isLive: member.isLive
})));

if (!apply) {
  console.log("Dry-run. Mit --apply werden diese Datensaetze archiviert und intern/nicht sichtbar gesetzt.");
  process.exit(0);
}

let batch = db.batch();
let pending = 0;
let updated = 0;
for (const member of obsolete) {
  const reference = db.collection("members").doc(member.id);
  batch.update(reference, {
    status: "archived",
    visibility: "internal",
    visible: false,
    isLive: false,
    membershipAccessStatus: "inactive",
    publicHiddenAt: FieldValue.serverTimestamp(),
    publicHiddenReason: "Nicht Bestandteil der aktuellen Mitgliederliste 2026.",
    obsoleteArchivedAt: FieldValue.serverTimestamp()
  });
  pending += 1;
  updated += 1;
  if (pending === 450) {
    await batch.commit();
    batch = db.batch();
    pending = 0;
  }
}
if (pending) await batch.commit();
console.log(`${updated} veraltete Mitglieder-Datensaetze archiviert.`);
