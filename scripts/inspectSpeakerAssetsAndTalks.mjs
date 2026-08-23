import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "prodigitaltv-da47b";
const speakerIds = process.argv.slice(2);

function name(record = {}) {
  return record.name || [record.firstName, record.lastName].filter(Boolean).join(" ").trim() || record.id || "";
}

function assetUrl(asset = {}) {
  return asset.file_path_web_url || asset.file_path_thumb_url || asset.file_path_original_url || asset.imageUrl || asset.assetUrl || asset.url || "";
}

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const [speakerSnap, topicSnap, assetSnap] = await Promise.all([
  db.collection("speakers").get(),
  db.collection("topics").get(),
  db.collection("media_assets").get()
]);

const speakers = speakerSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
  .filter((speaker) => !speakerIds.length || speakerIds.includes(speaker.id));
const topics = topicSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
const assets = assetSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

for (const speaker of speakers) {
  const linkedTopics = topics.filter((topic) => {
    const ids = Array.isArray(topic.speakerIds) ? topic.speakerIds : [];
    return ids.includes(speaker.id) || topic.speakerId === speaker.id
      || (Array.isArray(speaker.topicIds) && speaker.topicIds.includes(topic.id))
      || speaker.topicId === topic.id;
  });
  const linkedAssets = assets.filter((asset) => {
    const targetCollection = asset.target_collection || asset.targetCollection || asset.collection || "";
    const targetId = asset.target_id || asset.targetId || asset.recordId || "";
    const linkedCollection = asset.linked_collection || asset.linkedCollection || "";
    const linkedId = asset.linked_record_id || asset.linkedRecordId || asset.linked_id || asset.linkedId || "";
    return (String(targetCollection) === "speakers" && targetId === speaker.id)
      || (String(linkedCollection) === "speakers" && linkedId === speaker.id);
  });
  console.log(`\n${name(speaker)} [${speaker.id}]`);
  console.log(`photoUrl=${speaker.photoUrl || ""}`);
  console.log(`topics=${linkedTopics.map((topic) => `${topic.id}: ${topic.title}`).join(" | ") || "-"}`);
  console.log(`assets=${linkedAssets.map((asset) => `${asset.id}: ${assetUrl(asset)}`).join(" | ") || "-"}`);
}
