import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "prodigitaltv-da47b";
const topicId = "berlinale-2026-vogelbacher-merkl-micro-dramas";

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const compact = (value = {}) => Object.fromEntries(Object.entries(value)
  .filter(([key, entry]) => /^(id|status|visibility)$|image|photo|logo|asset|thumb|media|company|name|title|target|linked|url/i.test(key) && entry !== undefined && entry !== "")
  .sort(([a], [b]) => a.localeCompare(b)));

const topicSnap = await db.collection("topics").doc(topicId).get();
if (!topicSnap.exists) throw new Error(`Topic ${topicId} fehlt.`);
const topic = { id: topicSnap.id, ...topicSnap.data() };
console.log("TOPIC", JSON.stringify(compact(topic), null, 2));

const speakerIds = new Set([...(topic.speakerIds || []), topic.speakerId].filter(Boolean));
const speakerQuery = await db.collection("speakers").where("topicIds", "array-contains", topicId).get().catch(() => null);
speakerQuery?.docs.forEach((doc) => speakerIds.add(doc.id));
for (const id of speakerIds) {
  const snap = await db.collection("speakers").doc(id).get();
  if (snap.exists) console.log("SPEAKER", JSON.stringify(compact({ id: snap.id, ...snap.data() }), null, 2));
}

const assets = await db.collection("media_assets").get();
const matches = [];
for (const doc of assets.docs) {
  const asset = { id: doc.id, ...doc.data() };
  const haystack = JSON.stringify(asset).toLowerCase();
  if (
    haystack.includes(topicId.toLowerCase())
    || haystack.includes("vertical")
    || haystack.includes("minds")
    || haystack.includes("vogelbacher")
    || haystack.includes("merkl")
  ) {
    matches.push(compact(asset));
  }
}
console.log("MATCHING_ASSETS", JSON.stringify(matches, null, 2));
