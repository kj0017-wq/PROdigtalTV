import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { demoDatabase } from "../src/data/demoData.js";

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
  console.log(`PROdigitalTV Event-Pipeline

Pflicht:
  --service-account <pfad>   Firebase Service-Account JSON

Modi:
  --backup                   Aktuelle Firestore-Events als JSON sichern
  --repair                   Bestehende Firestore-Events anhand Datum/Ablauf klassifizieren
  --reset-from-seed          Events sichern, Collection leeren und Seed-Events neu importieren

Sicherheit:
  --dry-run                  Nur anzeigen, was passieren wuerde
  --yes                      Erforderlich fuer echte Schreib-/Loeschaktionen

Optional:
  --project-id <id>          Firebase Projekt-ID, sonst aus Service Account
  --backup-dir <pfad>        Zielordner fuer Backups, Standard ./.secrets/backups
  --today <YYYY-MM-DD>       Stichtag fuer Klassifizierung, Standard heutiges Datum

Beispiele:
  npm run firebase:events:pipeline -- --service-account ./.secrets/prodigitaltv-service-account.json --backup --dry-run
  npm run firebase:events:pipeline -- --service-account ./.secrets/prodigitaltv-service-account.json --repair --dry-run
  npm run firebase:events:pipeline -- --service-account ./.secrets/prodigitaltv-service-account.json --reset-from-seed --yes
`);
  process.exit(0);
}

const serviceAccountPath = args.get("service-account") || process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!serviceAccountPath) {
  throw new Error("Bitte --service-account <pfad> angeben oder GOOGLE_APPLICATION_CREDENTIALS setzen.");
}

const modeFlags = ["backup", "repair", "reset-from-seed"].filter((mode) => args.has(mode));
if (modeFlags.length !== 1) {
  throw new Error("Bitte genau einen Modus angeben: --backup, --repair oder --reset-from-seed.");
}

const mode = modeFlags[0];
const dryRun = args.has("dry-run");
const yes = args.has("yes");
const writesData = mode !== "backup";
if (writesData && !dryRun && !yes) {
  throw new Error("Schreib-/Loeschaktionen brauchen --yes. Fuer eine Vorschau bitte --dry-run nutzen.");
}

const serviceAccount = JSON.parse(await readFile(resolve(serviceAccountPath), "utf8"));
const projectId = args.get("project-id") || serviceAccount.project_id || "prodigitaltv-da47b";
const today = args.get("today") || new Date().toISOString().slice(0, 10);
const backupDir = resolve(args.get("backup-dir") || "./.secrets/backups");

const [{ initializeApp, cert }, { getFirestore, FieldValue, Timestamp }] = await Promise.all([
  import("firebase-admin/app"),
  import("firebase-admin/firestore")
]);

initializeApp({ credential: cert(serviceAccount), projectId });
const db = getFirestore();

function serializeValue(value) {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serializeValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serializeValue(item)]));
  }
  return value;
}

function isExpired(event) {
  return Boolean(event.expiresAt && new Date(event.expiresAt).getTime() <= Date.now());
}

function isPastEvent(event) {
  if (["post_processing", "archive_published", "archived"].includes(event.lifecyclePhase)) return true;
  if (isExpired(event)) return true;
  return Boolean(event.date && event.date < today);
}

function classifyEvent(event) {
  const past = isPastEvent(event);
  if (past) {
    return {
      ...event,
      status: event.status === "inactive" ? "inactive" : "published",
      lifecyclePhase: event.lifecyclePhase === "post_processing" ? "post_processing" : "archive_published",
      registrationEnabled: false,
      allowPublicRegistration: false,
      allowMemberRegistration: false,
      updatedAt: new Date().toISOString()
    };
  }

  return {
    ...event,
    status: event.status === "inactive" ? "draft" : event.status || "draft",
    lifecyclePhase: ["planning", "invitation", "registration_open", "registration_closed", "event_day"].includes(event.lifecyclePhase)
      ? event.lifecyclePhase
      : "planning",
    updatedAt: new Date().toISOString()
  };
}

async function listEvents() {
  const snapshot = await db.collection("events").get();
  return snapshot.docs.map((document) => ({ id: document.id, ...serializeValue(document.data()) }));
}

async function writeBackup(events) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = resolve(backupDir, `events-backup-${stamp}.json`);
  if (!dryRun) {
    await mkdir(backupDir, { recursive: true });
    await writeFile(path, JSON.stringify({ projectId, exportedAt: new Date().toISOString(), events }, null, 2), "utf8");
  }
  return path;
}

function diffSummary(before, after) {
  const changed = [];
  for (const event of before) {
    const next = after.find((item) => item.id === event.id);
    if (!next) continue;
    const changes = {};
    for (const field of ["status", "lifecyclePhase", "registrationEnabled", "allowPublicRegistration", "allowMemberRegistration"]) {
      if (event[field] !== next[field]) changes[field] = { from: event[field], to: next[field] };
    }
    if (Object.keys(changes).length) changed.push({ id: event.id, title: event.title, date: event.date, changes });
  }
  return changed;
}

async function commitInBatches(entries, operation) {
  let batch = db.batch();
  let pending = 0;
  let total = 0;
  for (const entry of entries) {
    operation(batch, entry);
    pending += 1;
    total += 1;
    if (pending >= 450) {
      await batch.commit();
      batch = db.batch();
      pending = 0;
    }
  }
  if (pending) await batch.commit();
  return total;
}

const currentEvents = await listEvents();
const backupPath = await writeBackup(currentEvents);

if (mode === "backup") {
  console.log(JSON.stringify({
    mode,
    dryRun,
    projectId,
    eventCount: currentEvents.length,
    backupPath: dryRun ? `${backupPath} (dry-run, nicht geschrieben)` : backupPath
  }, null, 2));
  process.exit(0);
}

if (mode === "repair") {
  const repaired = currentEvents.map(classifyEvent);
  const changed = diffSummary(currentEvents, repaired);
  if (!dryRun) {
    await commitInBatches(repaired, (batch, event) => {
      batch.set(db.collection("events").doc(event.id), {
        ...event,
        pipelineUpdatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    });
  }
  console.log(JSON.stringify({
    mode,
    dryRun,
    projectId,
    today,
    backupPath,
    eventCount: currentEvents.length,
    changedCount: changed.length,
    sampleChanges: changed.slice(0, 20)
  }, null, 2));
  process.exit(0);
}

const seedEvents = demoDatabase.events.map(classifyEvent);
if (!dryRun) {
  await commitInBatches(currentEvents, (batch, event) => {
    batch.delete(db.collection("events").doc(event.id));
  });
  await commitInBatches(seedEvents, (batch, event) => {
    batch.set(db.collection("events").doc(event.id), {
      ...event,
      demo: true,
      pipelineImportedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });
}

console.log(JSON.stringify({
  mode,
  dryRun,
  projectId,
  today,
  backupPath,
  deletedEvents: currentEvents.length,
  importedEvents: seedEvents.length,
  upcomingEvents: seedEvents.filter((event) => !isPastEvent(event)).length,
  followUpEvents: seedEvents.filter(isPastEvent).length
}, null, 2));
