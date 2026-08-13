import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "prodigitaltv-da47b";
const eventId = "event-leica-welt-2026";
const topicIds = [
  "leica-2026-bert-sahm-ki-workflow",
  "leica-2026-thomas-schneider-trumpp-international-vermarktung",
  "leica-2026-jan-isenbart-werbewirkung",
  "leica-2026-christof-baron-lokale-publisher",
  "leica-2026-dirk-engel-posthumanes-marketing"
];
const speakerIds = [
  "speakers-13a2a41d-82ad-49c6-ac91-c1873cd25ef2",
  "speakers-thomas-schneider-trumpp",
  "speakers-jan-isenbart",
  "speakers-christof-baron",
  "speakers-dirk-engel"
];
const now = new Date().toISOString();

const without = (items = [], removals = []) => {
  const removeSet = new Set(removals);
  return (items || []).filter((item) => !removeSet.has(item));
};

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const eventRef = db.collection("events").doc(eventId);
const eventSnap = await eventRef.get();
if (!eventSnap.exists) throw new Error(`Event ${eventId} wurde nicht gefunden.`);

const event = eventSnap.data();
await eventRef.set({
  ...event,
  topicIds: without(event.topicIds, topicIds),
  speakerIds: without(event.speakerIds, speakerIds),
  updatedAt: now
}, { merge: true });

for (const topicId of topicIds) {
  const ref = db.collection("topics").doc(topicId);
  const snap = await ref.get();
  if (!snap.exists) continue;
  const topic = snap.data();
  await ref.set({
    ...topic,
    page: "topics",
    section: "topics",
    category: "Themenbeitrag",
    eventIds: without(topic.eventIds, [eventId]),
    updatedAt: now
  }, { merge: true });
}

for (const speakerId of speakerIds) {
  const ref = db.collection("speakers").doc(speakerId);
  const snap = await ref.get();
  if (!snap.exists) continue;
  const speaker = snap.data();
  await ref.set({
    ...speaker,
    eventIds: without(speaker.eventIds, [eventId]),
    updatedAt: now
  }, { merge: true });
}

console.log(`Geloest: ${topicIds.length} Themenbeitraege vom Event ${eventId}.`);
