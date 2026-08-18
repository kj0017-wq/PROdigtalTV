import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "prodigitaltv-da47b";
const eventId = "event-salzburg-2025";

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const eventSnap = await db.collection("events").doc(eventId).get();
if (!eventSnap.exists) throw new Error(`Event ${eventId} nicht gefunden.`);
const event = { id: eventSnap.id, ...eventSnap.data() };

for (const topicId of event.topicIds || []) {
  const topicSnap = await db.collection("topics").doc(topicId).get();
  if (!topicSnap.exists) continue;
  const topic = { id: topicSnap.id, ...topicSnap.data() };
  const assetsSnap = await db.collection("media_assets")
    .where("linked_collection", "==", "topics")
    .where("linked_record_id", "==", topicId)
    .get();
  const targetAssetsSnap = await db.collection("media_assets")
    .where("target_collection", "==", "topics")
    .where("target_id", "==", topicId)
    .get();
  const assets = new Map();
  for (const doc of [...assetsSnap.docs, ...targetAssetsSnap.docs]) assets.set(doc.id, { id: doc.id, ...doc.data() });
  console.log(JSON.stringify({
    id: topic.id,
    title: topic.title,
    imageUrl: topic.imageUrl || "",
    thumbnail_url: topic.thumbnail_url || "",
    thumbnailUrl: topic.thumbnailUrl || "",
    assetUrl: topic.assetUrl || "",
    mediaAssetId: topic.mediaAssetId || topic.media_asset_id || "",
    article_media_asset_id: topic.article_media_asset_id || topic.articleMediaAssetId || "",
    thumbnail_media_asset_id: topic.thumbnail_media_asset_id || topic.thumbnailMediaAssetId || "",
    thumbnail_variant_asset_ids: topic.thumbnail_variant_asset_ids || [],
    assets: [...assets.values()].map((asset) => ({
      id: asset.id,
      title: asset.title || "",
      variant_key: asset.variant_key || asset.variantKey || "",
      usage_preset: asset.usage_preset || "",
      target_field: asset.target_field || asset.targetField || "",
      linked_field: asset.linked_field || asset.linkedField || "",
      media_type: asset.media_type || "",
      status: asset.status || "",
      url: asset.file_path_web_url || asset.file_path_original_url || asset.file_path_thumb_url || asset.imageUrl || asset.assetUrl || ""
    }))
  }, null, 2));
}
