import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "prodigitaltv-da47b";
const eventId = "event-salzburg-2025";

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

function pick(record = {}) {
  return Object.fromEntries(Object.entries(record)
    .filter(([key, value]) => /^(id|title|subtitle|description|shortDescription|longDescription|bodyText|articleText|text|date|location|locationName|city|topicIds|speakerIds|linkedEventId|eventId|section|page|status|visibility|name|company|position|firstName|lastName|slug)$/i.test(key) && value !== undefined && value !== "")
    .sort(([a], [b]) => a.localeCompare(b)));
}

const eventSnap = await db.collection("events").doc(eventId).get();
if (!eventSnap.exists) throw new Error(`Event ${eventId} nicht gefunden.`);
const event = { id: eventSnap.id, ...eventSnap.data() };
console.log("EVENT", JSON.stringify(pick(event), null, 2));

for (const topicId of event.topicIds || []) {
  const snap = await db.collection("topics").doc(topicId).get();
  if (snap.exists) console.log("TOPIC", JSON.stringify(pick({ id: snap.id, ...snap.data() }), null, 2));
}

for (const speakerId of event.speakerIds || []) {
  const snap = await db.collection("speakers").doc(speakerId).get();
  if (snap.exists) console.log("SPEAKER", JSON.stringify(pick({ id: snap.id, ...snap.data() }), null, 2));
}

const editorial = await db.collection("editorialContent").get();
const eventText = JSON.stringify(event).toLowerCase();
const matches = editorial.docs
  .map((doc) => ({ id: doc.id, ...doc.data() }))
  .filter((item) => {
    const text = JSON.stringify(item).toLowerCase();
    return text.includes(eventId)
      || text.includes("salzburg")
      || text.includes("red bull")
      || text.includes("redbull")
      || (item.linkedEventId && item.linkedEventId === eventId)
      || eventText.includes(String(item.id || "").toLowerCase());
  })
  .slice(0, 12);

matches.forEach((item) => console.log("EDITORIAL", JSON.stringify(pick(item), null, 2)));
