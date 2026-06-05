import admin from "firebase-admin";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { internalEditorialSeed } from "../src/data/internalEditorialSeed.js";

const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "prodigitaltv-da47b";

function firestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(firestoreValue) } };
  if (typeof value === "object") return { mapValue: { fields: firestoreFields(value) } };
  return { stringValue: String(value) };
}

function firestoreFields(record) {
  return Object.fromEntries(Object.entries(record)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => [key, firestoreValue(value)]));
}

async function importWithAdmin() {
  if (!admin.apps.length) admin.initializeApp({ projectId });
  const db = admin.firestore();
  let written = 0;
  for (const record of internalEditorialSeed) {
    const id = record.slug || record.id;
    if (!id) continue;
    await db.collection("editorialContent").doc(id).set({ ...record, id, updatedAt: new Date().toISOString() }, { merge: true });
    written += 1;
  }
  return written;
}

function gcloudToken() {
  const gcloud = join(process.env.LOCALAPPDATA || "", "Google", "Cloud SDK", "google-cloud-sdk", "bin", "gcloud.cmd");
  return execFileSync("cmd.exe", ["/c", gcloud, "auth", "print-access-token"], { encoding: "utf8" }).trim();
}

async function importWithRest() {
  const token = gcloudToken();
  let written = 0;
  for (const seed of internalEditorialSeed) {
    const id = seed.slug || seed.id;
    if (!id) continue;
    const record = { ...seed, id, updatedAt: new Date().toISOString() };
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:commit`;
    const body = {
      writes: [{
        update: {
          name: `projects/${projectId}/databases/(default)/documents/editorialContent/${id}`,
          fields: firestoreFields(record)
        },
        updateMask: { fieldPaths: Object.keys(record) }
      }]
    };
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${await response.text()}`);
    written += 1;
  }
  return written;
}

let written = 0;
try {
  written = await importWithAdmin();
} catch (error) {
  console.warn(`Admin import failed, trying Firestore REST: ${error.message}`);
  written = await importWithRest();
}

console.log(`Imported or updated ${written} Interna editorial records in ${projectId}.`);
