import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "prodigitaltv-da47b";
const topicId = "berlinale-2026-vogelbacher-merkl-micro-dramas";
const primaryAssetId = "media-asset-3e7d5612-3f17-4b08-87d0-5de533789cce";
const secondaryAssetId = "media-asset-5c8a6c7c-3b19-4829-bc34-64dc1baa913a";

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const assetSnap = await db.collection("media_assets").doc(primaryAssetId).get();
if (!assetSnap.exists) throw new Error(`Asset ${primaryAssetId} fehlt.`);

const asset = { id: assetSnap.id, ...assetSnap.data() };
const url = asset.file_path_web_url || asset.file_path_original_url || asset.file_path_thumb_url || "";
if (!url) throw new Error("Das Vertical-Minds-Asset hat keine Bild-URL.");

const now = new Date().toISOString();
await db.collection("topics").doc(topicId).set({
  imageUrl: url,
  thumbnail_url: url,
  thumbnailUrl: url,
  assetUrl: url,
  assetStoragePath: asset.storage_path_web || asset.storage_path_original || asset.file_path_web || asset.file_path_original || "",
  mediaAssetId: primaryAssetId,
  media_asset_id: primaryAssetId,
  thumbnail_media_asset_id: primaryAssetId,
  thumbnailMediaAssetId: primaryAssetId,
  thumbnail_variant_asset_ids: [primaryAssetId, secondaryAssetId],
  updatedAt: now
}, { merge: true });

for (const id of [primaryAssetId, secondaryAssetId]) {
  await db.collection("media_assets").doc(id).set({
    status: "active",
    visibility: "public",
    target_collection: "topics",
    target_id: topicId,
    target_field: "imageUrl",
    linked_collection: "topics",
    linked_record_id: topicId,
    linked_field: "imageUrl",
    updated_at: now,
    updatedAt: now
  }, { merge: true });
}

console.log(`Vertical-Minds-Themenbild gesetzt: ${topicId}`);
console.log(url);
