import { writeFile } from "node:fs/promises";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const write = process.argv.includes("--yes");
const csvIndex = process.argv.indexOf("--csv");
const csvPath = csvIndex >= 0 && process.argv[csvIndex + 1] ? process.argv[csvIndex + 1] : "phone-number-review.csv";
const projectId = "prodigitaltv-da47b";
const collections = ["members", "users", "contacts", "registrations", "speakers"];
const directFields = ["phone", "mobile", "mobilePhone", "contactPhone", "primaryPhone"];

function normalizeGermanPhone(value = "") {
  const original = String(value || "").trim();
  if (!original) return { value: "", changed: false, valid: false };
  const compact = original.replace(/[\s()./-]/g, "");
  let normalized = compact;
  if (normalized.startsWith("00")) normalized = `+${normalized.slice(2)}`;
  if (normalized.startsWith("49")) normalized = `+${normalized}`;
  if (normalized.startsWith("0") && !normalized.startsWith("00")) normalized = `+49${normalized.slice(1)}`;
  if (!normalized.startsWith("+49")) return { value: original, changed: false, valid: false };
  const isGermanMobile = /^\+491[567]\d{7,12}$/.test(normalized) && !/^\+4916[4689]/.test(normalized);
  if (!isGermanMobile) return { value: original, changed: false, valid: false };
  return { value: normalized, changed: normalized !== original, valid: true };
}

function normalizeObject(value, path, updates, issues) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) return value.map((item, index) => normalizeObject(item, `${path}[${index}]`, updates, issues));
  const resultObject = { ...value };
  for (const field of directFields) {
    if (typeof value[field] !== "string" || !value[field].trim()) continue;
    const result = normalizeGermanPhone(value[field]);
    if (result.changed) {
      resultObject[field] = result.value;
      updates.push({ path: `${path}.${field}`, before: value[field], after: result.value });
    }
    else if (!result.valid) issues.push({ path: `${path}.${field}`, value: value[field] });
  }
  for (const field of ["eventContacts", "contacts"]) {
    if (Array.isArray(value[field])) resultObject[field] = value[field].map((item, index) => normalizeObject(item, `${path}.${field}[${index}]`, updates, issues));
  }
  return resultObject;
}

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();
const report = { projectId, write, checkedAt: new Date().toISOString(), changed: [], unclear: [] };
for (const collection of collections) {
  const snapshot = await db.collection(collection).get();
  for (const document of snapshot.docs) {
    const updates = [];
    const issues = [];
    const original = document.data();
    const normalized = normalizeObject(original, `${collection}/${document.id}`, updates, issues);
    report.changed.push(...updates);
    report.unclear.push(...issues);
    if (write && updates.length) {
      const data = {};
      for (const field of [...directFields, "eventContacts", "contacts"]) {
        if (JSON.stringify(original[field]) !== JSON.stringify(normalized[field])) data[field] = normalized[field];
      }
      if (Object.keys(data).length) await document.ref.set({ ...data, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
  }
}
const csvRows = [
  ["collection", "documentId", "field", "status", "before", "after"],
  ...report.changed.map((item) => {
    const [collection, documentId, ...fieldParts] = item.path.split("/");
    return [collection, documentId.split(".")[0], fieldParts.join("/"), "wird geändert", item.before, item.after];
  }),
  ...report.unclear.map((item) => {
    const [collection, documentId, ...fieldParts] = item.path.split("/");
    return [collection, documentId.split(".")[0], fieldParts.join("/"), "unklar", item.value, ""];
  })
].map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
await writeFile(csvPath, `${csvRows}\n`, "utf8");
console.log(JSON.stringify({
  ...report,
  summary: { changed: report.changed.length, unclear: report.unclear.length },
  csvPath,
  changed: report.changed.slice(0, 500),
  unclear: report.unclear.slice(0, 500)
}, null, 2));
