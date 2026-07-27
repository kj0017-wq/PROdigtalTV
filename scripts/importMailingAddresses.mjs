import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

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
  console.log(`PROdigitalTV Mailing-Adressen importieren

Pflicht:
  --file <pfad>              CSV-Datei
  --service-account <pfad>   Firebase Service-Account JSON

Optional:
  --project-id <id>          Firebase Projekt-ID, sonst aus Service Account
  --dry-run                  Nur pruefen, nichts schreiben
  --yes                      Fuer echte Schreibaktionen erforderlich

Beispiel:
  node scripts/importMailingAddresses.mjs --file "C:/.../Mailliste Import.csv" --service-account ./.secrets/prodigitaltv-service-account.json --dry-run
`);
  process.exit(0);
}

const filePath = args.get("file");
const serviceAccountPath = args.get("service-account") || process.env.GOOGLE_APPLICATION_CREDENTIALS;
const dryRun = args.has("dry-run");
const yes = args.has("yes");

if (!filePath) throw new Error("Bitte --file <pfad> angeben.");
if (!serviceAccountPath && !dryRun) throw new Error("Bitte --service-account <pfad> angeben oder GOOGLE_APPLICATION_CREDENTIALS setzen.");
if (!dryRun && !yes) throw new Error("Echte Schreibaktionen brauchen --yes. Fuer eine Vorschau bitte --dry-run nutzen.");

function normalizeEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

function contactId(email = "") {
  return `contact-${createHash("sha256").update(normalizeEmail(email)).digest("hex").slice(0, 32)}`;
}

function parseCsv(text) {
  const firstLine = String(text || "").split(/\r?\n/).find((line) => line.trim()) || "";
  const delimiter = [";", "\t", ","].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const source = String(text || "").replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function pick(headers, record, names) {
  const indexes = names.map((name) => headers.indexOf(name)).filter((index) => index >= 0);
  const match = indexes.find((index) => record[index] !== undefined && String(record[index]).trim());
  return match === undefined ? "" : String(record[match] || "").trim();
}

function booleanValue(value = "") {
  return ["1", "ja", "yes", "true", "x", "erlaubt"].includes(String(value || "").trim().toLowerCase());
}

function readRows(csvText) {
  const rows = parseCsv(csvText);
  if (rows.length < 2) return [];
  const headers = rows[0].map((header) => String(header || "").trim().toLowerCase().replace(/[^a-z0-9äöüß]+/gi, ""));
  return rows.slice(1).map((record, index) => {
    const email = normalizeEmail(pick(headers, record, ["email", "emailadresse", "emailaddress", "mail"]));
    return {
      rowNumber: index + 2,
      firstName: pick(headers, record, ["vorname", "firstname", "first"]),
      lastName: pick(headers, record, ["nachname", "lastname", "last", "name"]),
      company: pick(headers, record, ["firma", "company", "unternehmen", "organisation", "organization"]),
      position: pick(headers, record, ["position", "funktion", "jobtitle", "rolle"]),
      department: pick(headers, record, ["abteilung", "department"]),
      email,
      mobile: pick(headers, record, ["mobilnummer", "mobil", "mobile", "telefon", "phone"]),
      type: pick(headers, record, ["typ", "type", "art"]),
      newsletter: pick(headers, record, ["newsletter", "newslettererlaubt", "newsletterallowed"])
    };
  }).filter((record) => record.email);
}

const rows = readRows(await readFile(resolve(filePath), "utf8"));
const unique = new Map();
const duplicates = [];
for (const row of rows) {
  if (unique.has(row.email)) duplicates.push(row.email);
  unique.set(row.email, row);
}

console.log(`CSV-Zeilen mit E-Mail: ${rows.length}`);
console.log(`Eindeutige E-Mail-Adressen: ${unique.size}`);
console.log(`Dubletten in CSV: ${duplicates.length}`);

if (dryRun) {
  console.log("Dry-run: keine Daten geschrieben.");
  process.exit(0);
}

const serviceAccount = JSON.parse(await readFile(resolve(serviceAccountPath), "utf8"));
const projectId = args.get("project-id") || serviceAccount.project_id || "prodigitaltv-da47b";
const { cert, initializeApp } = await import("firebase-admin/app");
const { FieldValue, getFirestore } = await import("firebase-admin/firestore");
initializeApp({ credential: cert(serviceAccount), projectId });
const db = getFirestore();

let created = 0;
let updated = 0;
const batchLimit = 350;
let batch = db.batch();
let pending = 0;

async function commitIfNeeded(force = false) {
  if (!pending || (!force && pending < batchLimit)) return;
  await batch.commit();
  batch = db.batch();
  pending = 0;
}

for (const row of unique.values()) {
  const ref = db.collection("contacts").doc(contactId(row.email));
  const existing = await ref.get();
  const data = existing.data() || {};
  const typeValue = String(row.type || "").toLowerCase().includes("mitglied") ? "member" : data.type || "contact";
  batch.set(ref, {
    id: ref.id,
    firstName: row.firstName || data.firstName || "",
    lastName: row.lastName || data.lastName || "",
    company: row.company || data.company || "",
    position: row.position || data.position || "",
    department: row.department || data.department || "",
    email: row.email,
    mobile: row.mobile || data.mobile || data.phone || "",
    phone: row.mobile || data.phone || data.mobile || "",
    type: data.type === "member" ? "member" : typeValue,
    newsletterAllowed: row.newsletter ? booleanValue(row.newsletter) : Boolean(data.newsletterAllowed || data.newsletterConsent),
    source: data.source || "excel_import",
    sourceType: "excel_import",
    status: data.status || "active",
    createdAt: data.createdAt || FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    lastImportedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  existing.exists ? updated += 1 : created += 1;
  pending += 1;
  await commitIfNeeded();
}

await commitIfNeeded(true);

console.log(`Import abgeschlossen: ${created} neu, ${updated} aktualisiert.`);
