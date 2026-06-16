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

if (args.has("help")) {
  console.log(`RG-Datum aus allen Mitgliedsprofilen entfernen

Pflicht:
  --service-account <pfad>   Firebase Service-Account JSON

Optional:
  --project-id <id>          Firebase Projekt-ID, sonst aus Service Account
  --dry-run                  Nur anzeigen, welche Datensaetze betroffen sind
`);
  process.exit(0);
}

const serviceAccountPath = args.get("service-account") || process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!serviceAccountPath) throw new Error("Bitte --service-account <pfad> angeben oder GOOGLE_APPLICATION_CREDENTIALS setzen.");

const dryRun = args.has("dry-run");
const serviceAccount = JSON.parse(await readFile(resolve(serviceAccountPath), "utf8"));
const projectId = args.get("project-id") || serviceAccount.project_id || "prodigitaltv-da47b";

initializeApp({ credential: cert(serviceAccount), projectId });
const db = getFirestore();
const snapshot = await db.collection("members").get();
const affected = snapshot.docs
  .map((document) => ({ id: document.id, ...document.data() }))
  .filter((member) => Object.prototype.hasOwnProperty.call(member, "rgDate"));

if (dryRun) {
  console.log(`Dry-run: ${affected.length} members-Datensaetze enthalten rgDate.`);
  console.table(affected.map((member) => ({
    id: member.id,
    name: member.name || "",
    rgDate: member.rgDate || ""
  })));
  process.exit(0);
}

let batch = db.batch();
let pending = 0;
let removed = 0;

async function commitIfNeeded(force = false) {
  if (!pending || (!force && pending < 450)) return;
  await batch.commit();
  batch = db.batch();
  pending = 0;
}

for (const member of affected) {
  batch.update(db.collection("members").doc(member.id), {
    rgDate: FieldValue.delete(),
    updatedAt: new Date().toISOString()
  });
  pending += 1;
  removed += 1;
  await commitIfNeeded();
}

await commitIfNeeded(true);
console.log(`${removed} members-Datensaetze in ${projectId}/members ohne rgDate gespeichert.`);
