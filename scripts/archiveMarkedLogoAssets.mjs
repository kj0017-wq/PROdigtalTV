import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const value = process.argv[index];
  if (!value.startsWith("--")) continue;
  const key = value.slice(2);
  const next = process.argv[index + 1];
  if (!next || next.startsWith("--")) args.set(key, true);
  else {
    args.set(key, next);
    index += 1;
  }
}

const serviceAccountPath = args.get("service-account") || process.env.GOOGLE_APPLICATION_CREDENTIALS || "./.secrets/prodigitaltv-service-account.json";
const serviceAccount = JSON.parse(await readFile(resolve(serviceAccountPath), "utf8"));
const projectId = args.get("project-id") || serviceAccount.project_id || "prodigitaltv-da47b";
const apply = args.has("apply");

const officialCurrentMemberIds = new Set([
  "bibel-tv-stiftung",
  "channel-21",
  "kj-technical-consulting-klaus-juli",
  "dsc-dietmar-schickel-consulting",
  "ors-comm",
  "buero-fuer-moderne-werbung-tv",
  "markus-vogelbacher",
  "blu-tec-one",
  "house-of-research",
  "goldvisite-media",
  "goldbach-germany",
  "schneider-enterprise",
  "fashion-tv-production",
  "stingray-digital-international",
  "eutelsat-services-beteiligungen",
  "farbi-flora",
  "anixe-hd",
  "js-consult",
  "thorsten-lork",
  "red-bull-media-house",
  "hardy-heine",
  "no-limits-media",
  "itsmaxsuhr",
  "major-seven-consulting",
  "sebastian-labonte",
  "michael-kayser",
  "idee-medien",
  "conrad-heberling",
  "tv-2000plus",
  "3q",
  "johannes-kors",
  "claudio-malasomma-bellavista"
]);

initializeApp({ credential: cert(serviceAccount), projectId });
const db = getFirestore();

const normalize = (value = "") => String(value || "").trim();
const lower = (value = "") => normalize(value).toLowerCase();
const urlValues = (record = {}) => [
  record.logoUrl,
  record.imageUrl,
  record.thumbnail_url,
  record.thumbnailUrl,
  record.assetUrl,
  record.url,
  record.file_url,
  record.fileUrl,
  record.downloadUrl,
  record.publicUrl,
  record.storageUrl,
  record.file_path_web,
  record.file_path_original,
  record.filename_web,
  record.filename_original,
  record.original_filename
].map(normalize).filter(Boolean);

function memberIsCurrent(member = {}) {
  return officialCurrentMemberIds.has(member.id)
    || (!["inactive", "cancelled", "archived"].includes(lower(member.status))
    && !["inactive", "cancelled"].includes(lower(member.membershipAccessStatus))
    && member.visible !== false
    && member.isLive !== false);
}

function memberIsFormer(member = {}) {
  if (officialCurrentMemberIds.has(member.id)) return false;
  return ["inactive", "cancelled", "archived"].includes(lower(member.status))
    || ["inactive", "cancelled"].includes(lower(member.membershipAccessStatus))
    || member.visible === false
    || member.isLive === false;
}

function isLogoAsset(asset = {}, memberUses = []) {
  const label = lower([
    asset.media_type,
    asset.mediaType,
    asset.type,
    asset.category,
    asset.title,
    asset.filename_original,
    asset.original_filename,
    asset.filename_web
  ].filter(Boolean).join(" "));
  return memberUses.length > 0
    || label.includes("logo")
    || label.includes("member")
    || label.includes("mitglied");
}

function protectedLogo(asset = {}) {
  const label = lower([asset.title, asset.filename_original, asset.original_filename, asset.filename_web].filter(Boolean).join(" "));
  return label.includes("flame") && label.includes("media");
}

function assetMatchesMember(asset = {}, member = {}) {
  const assetUrls = new Set(urlValues(asset));
  const memberUrls = urlValues(member);
  const explicitIds = [
    member.logoMediaAssetId,
    member.logo_media_asset_id,
    member.mediaAssetId,
    member.thumbnail_media_asset_id,
    member.thumbnailMediaAssetId
  ].map(normalize).filter(Boolean);
  if (explicitIds.includes(asset.id)) return true;
  if (asset.target_collection === "members" && asset.target_id === member.id) return true;
  if (asset.linked_collection === "members" && asset.linked_record_id === member.id) return true;
  return memberUrls.some((url) => assetUrls.has(url));
}

function preferredLogoId(member = {}, memberAssets = []) {
  const explicit = [
    member.logoMediaAssetId,
    member.logo_media_asset_id,
    member.mediaAssetId,
    member.thumbnail_media_asset_id,
    member.thumbnailMediaAssetId
  ].map(normalize).find((id) => id && memberAssets.some((asset) => asset.id === id));
  if (explicit) return explicit;
  const byUrl = memberAssets.find((asset) => urlValues(member).some((url) => urlValues(asset).includes(url)));
  if (byUrl) return byUrl.id;
  return memberAssets
    .slice()
    .sort((a, b) => String(b.updatedAt || b.updated_at || b.createdAt || b.created_at || "").localeCompare(String(a.updatedAt || a.updated_at || a.createdAt || a.created_at || "")))[0]?.id || "";
}

const [assetSnapshot, memberSnapshot] = await Promise.all([
  db.collection("media_assets").get(),
  db.collection("members").get()
]);

const assets = assetSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
const members = memberSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
const currentMembers = members.filter(memberIsCurrent);

const memberAssets = new Map();
for (const member of members) {
  const matches = assets.filter((asset) => assetMatchesMember(asset, member));
  if (matches.length) memberAssets.set(member.id, matches);
}

const preferredIds = new Set();
for (const member of currentMembers) {
  const preferred = preferredLogoId(member, memberAssets.get(member.id) || []);
  if (preferred) preferredIds.add(preferred);
}

const marked = [];
for (const asset of assets) {
  if (["archived", "deleted"].includes(lower(asset.status)) || asset.trash_status === "paperkorb") continue;
  const uses = members
    .filter((member) => assetMatchesMember(asset, member))
    .map((member) => ({
      id: member.id,
      name: member.name || member.title || member.id,
      current: memberIsCurrent(member),
      former: memberIsFormer(member)
    }));
  if (!isLogoAsset(asset, uses) || protectedLogo(asset)) continue;
  const linkedCurrent = uses.some((entry) => entry.current);
  const explicitlyFormer = uses.length > 0 && uses.every((entry) => entry.former);
  if (explicitlyFormer && !linkedCurrent) {
    marked.push({ asset, reason: "Ausgeschieden", uses });
  } else if (linkedCurrent && preferredIds.size && !preferredIds.has(asset.id)) {
    marked.push({ asset, reason: "Doppelt", uses });
  }
}

console.log(`${marked.length} Logo-Dateien fuer Papierkorb markiert.`);
console.table(marked.map(({ asset, reason, uses }) => ({
  id: asset.id,
  grund: reason,
  titel: asset.title || asset.filename_original || asset.original_filename || "",
  verknuepfung: uses.map((entry) => entry.name).join(", ")
})));

if (!apply) {
  console.log("Dry-run. Mit --apply werden diese Logo-Dateien in den Papierkorb verschoben.");
  process.exit(0);
}

let batch = db.batch();
let pending = 0;
let updated = 0;
for (const { asset, reason } of marked) {
  const reference = db.collection("media_assets").doc(asset.id);
  batch.update(reference, {
    status: "archived",
    deleted_at: new Date().toISOString(),
    trash_status: "paperkorb",
    trash_reason: reason,
    updatedAt: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    archivedAt: FieldValue.serverTimestamp()
  });
  pending += 1;
  updated += 1;
  if (pending >= 400) {
    await batch.commit();
    batch = db.batch();
    pending = 0;
  }
}
if (pending) await batch.commit();
console.log(`${updated} Logo-Dateien in den Papierkorb verschoben.`);
