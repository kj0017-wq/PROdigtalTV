import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "prodigitaltv-da47b";
const terms = process.argv.slice(2).map((term) => String(term || "").toLowerCase()).filter(Boolean);

if (!terms.length) {
  console.error("Usage: node scripts/findMediaAssetsByText.mjs <term> [term...]");
  process.exit(1);
}

function searchable(record = {}) {
  return JSON.stringify(record, (_key, value) => {
    if (value && typeof value.toDate === "function") return value.toDate().toISOString();
    return value;
  }).toLowerCase();
}

function assetUrl(asset = {}) {
  return asset.file_path_web_url
    || asset.file_path_thumb_url
    || asset.file_path_original_url
    || asset.imageUrl
    || asset.assetUrl
    || asset.url
    || "";
}

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();
const collections = ["media_assets", "speakers", "topics"];

for (const collection of collections) {
  const snapshot = await db.collection(collection).get();
  const matches = snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((record) => {
      const haystack = searchable({ id: record.id, ...record });
      return terms.some((term) => haystack.includes(term));
    });

  console.log(`\n${collection}: ${matches.length}`);
  matches.forEach((record) => {
    console.log(`- ${record.id}`);
    console.log(`  title/name=${record.title || record.name || [record.firstName, record.lastName].filter(Boolean).join(" ") || ""}`);
    console.log(`  target=${record.target_collection || record.targetCollection || ""}:${record.target_id || record.targetId || ""}`);
    console.log(`  linked=${record.linked_collection || record.linkedCollection || ""}:${record.linked_record_id || record.linkedRecordId || record.linked_id || record.linkedId || ""}`);
    console.log(`  url=${assetUrl(record)}`);
  });
}
