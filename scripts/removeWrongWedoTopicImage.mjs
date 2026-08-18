import { initializeApp, applicationDefault } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "prodigitaltv-da47b";
const topicId = "berlinale-2026-gregor-blach-kreativitaet-ki";

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const ref = db.collection("topics").doc(topicId);
const snap = await ref.get();
if (!snap.exists) throw new Error(`Thema ${topicId} wurde nicht gefunden.`);

const topic = snap.data();
const before = {
  imageUrl: topic.imageUrl || "",
  imageDisplayUrl: topic.imageDisplayUrl || "",
  thumbnailUrl: topic.thumbnailUrl || "",
  thumbnail_url: topic.thumbnail_url || "",
  assetUrl: topic.assetUrl || "",
  thumbnail_media_asset_id: topic.thumbnail_media_asset_id || "",
  mediaAssetId: topic.mediaAssetId || "",
  assetStoragePath: topic.assetStoragePath || ""
};

await ref.set({
  imageUrl: FieldValue.delete(),
  imageDisplayUrl: FieldValue.delete(),
  thumbnailUrl: FieldValue.delete(),
  thumbnail_url: FieldValue.delete(),
  assetUrl: FieldValue.delete(),
  thumbnail_media_asset_id: FieldValue.delete(),
  mediaAssetId: FieldValue.delete(),
  assetStoragePath: FieldValue.delete(),
  updatedAt: new Date().toISOString()
}, { merge: true });

console.log(`Bildzuordnung entfernt: ${topicId}`);
console.log(JSON.stringify(before, null, 2));
