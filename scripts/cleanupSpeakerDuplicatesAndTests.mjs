import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "prodigitaltv-da47b";
const apply = process.argv.includes("--apply");
const now = new Date().toISOString();

function normalize(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ü/g, "ue")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function speakerName(speaker = {}) {
  return speaker.name || [speaker.firstName, speaker.lastName].filter(Boolean).join(" ").trim() || speaker.id || "";
}

function speakerScore(speaker = {}) {
  return [
    speaker.photoUrl || speaker.imageUrl || speaker.thumbnailUrl || speaker.assetUrl ? 6 : 0,
    speaker.longBio || speaker.vita || speaker.biography ? 5 : 0,
    speaker.shortBio || speaker.bio ? 3 : 0,
    Array.isArray(speaker.topicIds) ? speaker.topicIds.length : speaker.topicId ? 1 : 0,
    Array.isArray(speaker.eventIds) ? speaker.eventIds.length : 0,
    speaker.status === "published" ? 1 : 0
  ].reduce((sum, value) => sum + Number(value || 0), 0);
}

function shouldRemoveTestSpeaker(speaker = {}) {
  const name = normalize(speakerName(speaker));
  return name.includes("mustermann") || name === "klaus juli" || name.includes("klaus juli");
}

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const speakersSnap = await db.collection("speakers").get();
const speakers = speakersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
const byName = new Map();
for (const speaker of speakers) {
  const key = normalize(speakerName(speaker));
  if (!key) continue;
  byName.set(key, [...(byName.get(key) || []), speaker]);
}

const speakerIdsToArchive = new Set();
const notes = [];

for (const speaker of speakers.filter(shouldRemoveTestSpeaker)) {
  speakerIdsToArchive.add(speaker.id);
  notes.push(`Test/unerwuenscht: ${speaker.id} (${speakerName(speaker)})`);
}

const lennartCandidates = speakers.filter((speaker) => {
  const key = normalize([speaker.id, speakerName(speaker), speaker.firstName, speaker.lastName].filter(Boolean).join(" "));
  return key.includes("lenn") || key.includes("ruemmler") || key.includes("rummler");
});
if (lennartCandidates.length) {
  notes.push(`Lennart-Kandidaten: ${lennartCandidates.map((speaker) => `${speaker.id} (${speakerName(speaker)})`).join(", ")}`);
}
if (lennartCandidates.length > 1) {
  const sorted = [...lennartCandidates].sort((a, b) => {
    const canonicalA = a.id === "speakers-lennart-ruemmler" ? 1000 : 0;
    const canonicalB = b.id === "speakers-lennart-ruemmler" ? 1000 : 0;
    return (canonicalB + speakerScore(b)) - (canonicalA + speakerScore(a));
  });
  const keep = sorted[0];
  notes.push(`Lennart-Schreibweise: behalten ${keep.id} (${speakerName(keep)})`);
  sorted.slice(1).forEach((speaker) => {
    speakerIdsToArchive.add(speaker.id);
    notes.push(`Lennart-Schreibweise: archivieren ${speaker.id} (${speakerName(speaker)})`);
  });
}

const lennartGroups = [...byName.entries()]
  .filter(([key]) => (key.includes("lenn") || key.includes("ruemmler") || key.includes("rummler")));

for (const [, group] of lennartGroups) {
  if (group.length < 2) continue;
  const sorted = [...group].sort((a, b) => {
    const canonicalA = a.id === "speakers-lennart-ruemmler" ? 1000 : 0;
    const canonicalB = b.id === "speakers-lennart-ruemmler" ? 1000 : 0;
    return (canonicalB + speakerScore(b)) - (canonicalA + speakerScore(a));
  });
  const keep = sorted[0];
  notes.push(`Lennart-Dublette: behalten ${keep.id} (${speakerName(keep)})`);
  sorted.slice(1).forEach((speaker) => {
    speakerIdsToArchive.add(speaker.id);
    notes.push(`Lennart-Dublette: archivieren ${speaker.id} (${speakerName(speaker)})`);
  });
}

const ids = [...speakerIdsToArchive];
console.log(apply ? "APPLY" : "DRY RUN");
console.log(notes.join("\n") || "Keine passenden Datensaetze gefunden.");

if (!ids.length) process.exit(0);

const collectionsToClean = ["events", "topics"];
const affected = {};
for (const collectionName of collectionsToClean) {
  const snap = await db.collection(collectionName).get();
  affected[collectionName] = snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((record) => {
      const speakerIds = Array.isArray(record.speakerIds) ? record.speakerIds : [];
      return ids.some((id) => speakerIds.includes(id) || record.speakerId === id);
    });
}

console.log(`Zu archivieren: ${ids.join(", ")}`);
Object.entries(affected).forEach(([collectionName, records]) => {
  console.log(`${collectionName}: ${records.length} Zuordnungen betroffen`);
  records.forEach((record) => console.log(`- ${collectionName}/${record.id}`));
});

if (!apply) {
  console.log("Noch nichts geaendert. Mit --apply ausfuehren, um zu archivieren.");
  process.exit(0);
}

const batch = db.batch();
ids.forEach((id) => {
  batch.set(db.collection("speakers").doc(id), {
    status: "archived",
    visibility: "internal",
    visible: false,
    archivedAt: now,
    archiveReason: "Dubletten/Testpersonen aus Referentenansicht entfernt",
    updatedAt: now
  }, { merge: true });
});

for (const [collectionName, records] of Object.entries(affected)) {
  records.forEach((record) => {
    const next = {
      updatedAt: now
    };
    if (Array.isArray(record.speakerIds)) {
      next.speakerIds = record.speakerIds.filter((id) => !speakerIdsToArchive.has(id));
    }
    if (speakerIdsToArchive.has(record.speakerId)) {
      next.speakerId = next.speakerIds?.[0] || "";
    }
    batch.set(db.collection(collectionName).doc(record.id), next, { merge: true });
  });
}

await batch.commit();
console.log("Referenten bereinigt.");
