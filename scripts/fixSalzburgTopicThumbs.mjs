import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "prodigitaltv-da47b";

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const fixes = [
  {
    topicId: "salzburg-2025-jan-bertil-dahms-go-big-or-go-small",
    assetId: "media-asset-7608d08c-1e0d-4b2b-8926-5f095faaacd7"
  },
  {
    topicId: "salzburg-2025-christian-schmeichel-dokumentarfilm-produktion",
    assetId: "media-asset-392e5abd-0b24-4b73-923e-ac34b8cb0db2"
  },
  {
    topicId: "salzburg-2025-jeanine-harmtodt-social-media-trends",
    assetId: "media-asset-cd4091d4-8795-4e90-bd3f-e5d357fdc311"
  }
];

const urlForAsset = (asset = {}) =>
  asset.file_path_web_url || asset.file_path_original_url || asset.file_path_thumb_url || asset.imageUrl || asset.assetUrl || "";

for (const fix of fixes) {
  const [topicSnap, assetSnap] = await Promise.all([
    db.collection("topics").doc(fix.topicId).get(),
    db.collection("media_assets").doc(fix.assetId).get()
  ]);
  if (!topicSnap.exists) throw new Error(`Topic fehlt: ${fix.topicId}`);
  if (!assetSnap.exists) throw new Error(`Asset fehlt: ${fix.assetId}`);
  const topic = { id: topicSnap.id, ...topicSnap.data() };
  const asset = { id: assetSnap.id, ...assetSnap.data() };
  const url = urlForAsset(asset);
  if (!url) throw new Error(`Asset ${fix.assetId} hat keine URL.`);
  const now = new Date().toISOString();
  const existingVariants = Array.isArray(topic.thumbnail_variant_asset_ids) ? topic.thumbnail_variant_asset_ids : [];
  const update = {
    thumbnail_url: url,
    thumbnailUrl: url,
    thumbnail_media_asset_id: fix.assetId,
    thumbnailMediaAssetId: fix.assetId,
    thumbnail_variant_asset_ids: Array.from(new Set([fix.assetId, ...existingVariants].filter(Boolean))).slice(0, 24),
    updatedAt: now
  };
  if (!topic.imageUrl) update.imageUrl = url;
  if (!topic.assetUrl || topic.assetUrl === topic.thumbnail_url || topic.assetUrl === topic.thumbnailUrl) update.assetUrl = url;
  if (!topic.mediaAssetId && !topic.media_asset_id) {
    update.mediaAssetId = fix.assetId;
    update.media_asset_id = fix.assetId;
  }
  await db.collection("topics").doc(fix.topicId).set(update, { merge: true });
  await db.collection("media_assets").doc(fix.assetId).set({
    status: "active",
    visibility: "public",
    target_collection: "topics",
    target_id: fix.topicId,
    target_field: "thumbnail_url",
    targetCollection: "topics",
    targetId: fix.topicId,
    targetField: "thumbnail_url",
    linked_collection: "topics",
    linked_record_id: fix.topicId,
    linked_field: "thumbnail_url",
    linkedCollection: "topics",
    linkedRecordId: fix.topicId,
    linkedField: "thumbnail_url",
    updated_at: now,
    updatedAt: now
  }, { merge: true });
  console.log(`${topic.title || fix.topicId}: ${url}`);
}
