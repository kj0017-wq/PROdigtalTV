import { existsSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

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

if (args.has("help")) {
  console.log(`Referenced Firebase Asset Sync

Prueft Firestore auf lokale /assets- und /images-Pfade und laedt vorhandene lokale Dateien nach Storage.

Optionen:
  --service-account <pfad>   Firebase Service-Account JSON
  --project-id <id>          Firebase Projekt-ID
  --storage-bucket <bucket>  Storage Bucket
  --dry-run                  Nur pruefen, nichts schreiben
  --update-records           Firestore-Felder auf Firebase-Download-URLs aktualisieren
`);
  process.exit(0);
}

const serviceAccountPath = args.get("service-account") || process.env.GOOGLE_APPLICATION_CREDENTIALS || "./.secrets/prodigitaltv-service-account.json";
const serviceAccount = JSON.parse(await import("node:fs/promises").then(({ readFile }) => readFile(serviceAccountPath, "utf8")));
const projectId = args.get("project-id") || serviceAccount.project_id || "prodigitaltv-da47b";
const storageBucket = args.get("storage-bucket") || `${projectId}.firebasestorage.app`;
const dryRun = args.has("dry-run");
const updateRecords = args.has("update-records");

initializeApp({
  credential: cert(serviceAccount),
  projectId,
  storageBucket
});

const db = getFirestore();
const bucket = getStorage().bucket();

const collections = [
  "members",
  "editorialContent",
  "events",
  "galleries",
  "boardMembers",
  "speakers",
  "sponsors",
  "downloads",
  "topics",
  "internalPages"
];

const directFields = [
  "imageUrl",
  "logoUrl",
  "photoUrl",
  "fileUrl",
  "thumbnail_url",
  "thumbnailUrl",
  "assetUrl",
  "audioUrl",
  "audioAccessibleUrl",
  "audioNaturalUrl",
  "timingUrl"
];

function isLocalReference(value = "") {
  return typeof value === "string" && (value.startsWith("/assets/") || value.startsWith("/images/"));
}

function localFileForReference(value = "") {
  return join("public", value.replace(/[?#].*$/, "").replace(/^\//, ""));
}

function storagePathForReference(value = "") {
  return value.replace(/[?#].*$/, "").replace(/^\//, "");
}

function contentTypeFor(filePath = "") {
  const ext = extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".wav") return "audio/wav";
  if (ext === ".json") return "application/json";
  return "application/octet-stream";
}

function firebaseDownloadUrl(bucketName, storagePath, token) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
}

function collectRefs(value, path, refs) {
  if (!value) return;
  if (typeof value === "string") {
    if (isLocalReference(value)) refs.push({ path, value });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectRefs(entry, `${path}[${index}]`, refs));
    return;
  }
  if (typeof value === "object") {
    Object.entries(value).forEach(([key, entry]) => collectRefs(entry, path ? `${path}.${key}` : key, refs));
  }
}

function setPath(target, path, value) {
  const tokens = String(path).replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
  let cursor = target;
  for (let index = 0; index < tokens.length - 1; index += 1) {
    cursor = cursor?.[tokens[index]];
    if (!cursor) return false;
  }
  const key = tokens[tokens.length - 1];
  if (!key || cursor?.[key] === undefined) return false;
  cursor[key] = value;
  return true;
}

async function objectExists(storagePath) {
  const [exists] = await bucket.file(storagePath).exists();
  return exists;
}

async function uploadReference(localReference) {
  const localPath = localFileForReference(localReference);
  const storagePath = storagePathForReference(localReference);
  const token = randomUUID();
  if (!dryRun) {
    await bucket.upload(localPath, {
      destination: storagePath,
      metadata: {
        contentType: contentTypeFor(localPath),
        metadata: { firebaseStorageDownloadTokens: token }
      }
    });
  }
  return firebaseDownloadUrl(bucket.name, storagePath, token);
}

const allRefs = [];
const missingLocalFiles = [];
const uploaded = [];
const alreadyInStorage = [];
const updatedRecords = [];
const uploadedByPath = new Map();

for (const collectionName of collections) {
  const snapshot = await db.collection(collectionName).get();
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const refs = [];
    directFields.forEach((field) => collectRefs(data[field], field, refs));
    collectRefs(data.images, "images", refs);
    collectRefs(data.galleryImages, "galleryImages", refs);
    for (const ref of refs) {
      const localPath = localFileForReference(ref.value);
      const existsLocal = existsSync(localPath);
      const size = existsLocal ? statSync(localPath).size : 0;
      const storagePath = storagePathForReference(ref.value);
      allRefs.push({ collectionName, id: doc.id, ...ref, localPath, storagePath, existsLocal, size });
      if (!existsLocal) {
        missingLocalFiles.push({ collectionName, id: doc.id, ...ref, localPath });
        continue;
      }
      if (await objectExists(storagePath)) {
        alreadyInStorage.push({ collectionName, id: doc.id, ...ref, storagePath });
        continue;
      }
      const downloadUrl = uploadedByPath.get(storagePath) || await uploadReference(ref.value);
      uploadedByPath.set(storagePath, downloadUrl);
      uploaded.push({ collectionName, id: doc.id, ...ref, storagePath, size, downloadUrl });
      if (updateRecords && !dryRun) {
        const nextData = structuredClone(data);
        if (setPath(nextData, ref.path, downloadUrl)) {
          await doc.ref.set({ ...nextData, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
          updatedRecords.push({ collectionName, id: doc.id, path: ref.path });
        }
      }
    }
  }
}

console.log(JSON.stringify({
  projectId,
  storageBucket: bucket.name,
  dryRun,
  updateRecords,
  checkedAt: new Date().toISOString(),
  localReferences: allRefs.length,
  alreadyInStorage: alreadyInStorage.length,
  uploaded: uploaded.length,
  uploadedReferences: uploaded.length,
  uploadedUniqueFiles: uploadedByPath.size,
  updatedRecords: updatedRecords.length,
  missingLocalFiles: missingLocalFiles.length,
  uploadedPreview: uploaded.slice(0, 40),
  missingLocalFilesPreview: missingLocalFiles.slice(0, 40)
}, null, 2));
