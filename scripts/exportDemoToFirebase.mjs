import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { demoDatabase } from "../src/data/demoData.js";
import { randomUUID } from "node:crypto";

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
  console.log(`PROdigitalTV Demo-Daten nach Firebase exportieren

Pflicht:
  --service-account <pfad>   Firebase Service-Account JSON

Optional:
  --project-id <id>          Firebase Projekt-ID, sonst aus Service Account
  --admin-email <email>      Auth-User als CMS-Admin markieren
  --admin-password <pass>    Auth-User bei Bedarf mit Passwort anlegen
  --upload-assets            Lokale /assets-Dateien nach Firebase Storage hochladen
  --storage-bucket <bucket>  Storage Bucket, sonst prodigitaltv-da47b.firebasestorage.app
  --dry-run                  Nur anzeigen, was geschrieben wuerde

Beispiel:
  node scripts/exportDemoToFirebase.mjs --service-account ./.secrets/prodigitaltv-service-account.json --admin-email name@example.com
`);
  process.exit(0);
}

const serviceAccountPath = args.get("service-account") || process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!serviceAccountPath) {
  throw new Error("Bitte --service-account <pfad> angeben oder GOOGLE_APPLICATION_CREDENTIALS setzen.");
}

const dryRun = args.has("dry-run");
const serviceAccount = JSON.parse(await readFile(resolve(serviceAccountPath), "utf8"));
const projectId = args.get("project-id") || serviceAccount.project_id || "prodigitaltv-da47b";

const shouldUploadAssets = args.has("upload-assets");
const storageBucket = args.get("storage-bucket") || `${projectId}.firebasestorage.app`;

const [{ initializeApp, cert }, { getFirestore, FieldValue }, { getAuth }, { getStorage }] = await Promise.all([
  import("firebase-admin/app"),
  import("firebase-admin/firestore"),
  import("firebase-admin/auth"),
  import("firebase-admin/storage")
]);

if (!dryRun) {
  initializeApp({
    credential: cert(serviceAccount),
    projectId,
    storageBucket
  });
}

const db = dryRun ? null : getFirestore();
const auth = dryRun ? null : getAuth();
const bucket = dryRun ? null : getStorage().bucket();
const assetUrlCache = new Map();

function isLocalAsset(value) {
  return typeof value === "string" && value.startsWith("/assets/");
}

function firebaseDownloadUrl(bucketName, storagePath, token) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
}

async function uploadAsset(localUrl) {
  if (!shouldUploadAssets || !isLocalAsset(localUrl)) return localUrl;
  if (assetUrlCache.has(localUrl)) return assetUrlCache.get(localUrl);

  const sourcePath = resolve(`public${localUrl}`);
  const storagePath = localUrl.replace(/^\//, "");
  const token = randomUUID();
  await bucket.upload(sourcePath, {
    destination: storagePath,
    metadata: {
      metadata: {
        firebaseStorageDownloadTokens: token
      }
    }
  });
  const url = firebaseDownloadUrl(bucket.name, storagePath, token);
  assetUrlCache.set(localUrl, url);
  return url;
}

async function cleanRecord(record) {
  const copy = JSON.parse(JSON.stringify(record));
  delete copy.sourceUrl;
  for (const field of ["imageUrl", "logoUrl", "photoUrl", "fileUrl"]) {
    if (isLocalAsset(copy[field])) copy[field] = await uploadAsset(copy[field]);
  }
  return copy;
}

async function writeCollection(collectionName, records) {
  if (!Array.isArray(records) || records.length === 0) return 0;
  if (dryRun) return records.length;

  let batch = db.batch();
  let pending = 0;
  let written = 0;

  for (const record of records) {
    if (!record.id) throw new Error(`Datensatz in ${collectionName} hat keine id.`);
    const reference = db.collection(collectionName).doc(record.id);
    batch.set(reference, {
      ...(await cleanRecord(record)),
      demo: true,
      importedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    pending += 1;
    written += 1;

    if (pending >= 450) {
      await batch.commit();
      batch = db.batch();
      pending = 0;
    }
  }

  if (pending > 0) await batch.commit();
  return written;
}

async function ensureAdminUser(email, password) {
  if (!email) return null;
  if (dryRun) return { uid: "dry-run-admin", email };

  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(email);
  } catch (error) {
    if (error.code !== "auth/user-not-found") throw error;
    if (!password) {
      throw new Error(`Auth-User ${email} existiert noch nicht. Bitte zuerst anmelden oder --admin-password setzen.`);
    }
    userRecord = await auth.createUser({
      email,
      password,
      emailVerified: true,
      displayName: "PROdigitalTV Admin"
    });
  }

  await auth.setCustomUserClaims(userRecord.uid, { role: "admin" });
  await db.collection("users").doc(userRecord.uid).set({
    email,
    displayName: userRecord.displayName || "PROdigitalTV Admin",
    role: "admin",
    status: "active",
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  return userRecord;
}

const summary = [];
for (const [collectionName, records] of Object.entries(demoDatabase)) {
  const count = await writeCollection(collectionName, records);
  if (count > 0) summary.push({ collection: collectionName, count });
}

const admin = await ensureAdminUser(args.get("admin-email"), args.get("admin-password"));

console.log(JSON.stringify({
  projectId,
  storageBucket: shouldUploadAssets ? (bucket?.name || storageBucket) : null,
  uploadedAssets: assetUrlCache.size,
  dryRun,
  collections: summary,
  admin: admin ? { uid: admin.uid, email: admin.email } : null
}, null, 2));
