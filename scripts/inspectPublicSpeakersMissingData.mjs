import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "prodigitaltv-da47b";

function speakerName(speaker = {}) {
  return speaker.name || [speaker.firstName, speaker.lastName].filter(Boolean).join(" ").trim() || speaker.id || "";
}

function publicVisible(speaker = {}) {
  const status = String(speaker.status || "published").toLowerCase();
  const visibility = String(speaker.visibility || "public").toLowerCase();
  return !["archived", "deleted", "hidden", "inactive"].includes(status)
    && !["internal", "hidden"].includes(visibility);
}

function fieldValue(record = {}, fields = []) {
  return fields.find((field) => String(record[field] || "").trim()) || "";
}

function fieldList(record = {}, fields = []) {
  return fields.filter((field) => String(record[field] || "").trim());
}

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const snap = await db.collection("speakers").get();
const speakers = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
  .filter(publicVisible)
  .sort((a, b) => speakerName(a).localeCompare(speakerName(b), "de", { sensitivity: "base" }));

const imageFields = ["photoUrl", "imageUrl", "thumbnailUrl", "thumbnail_url", "assetUrl", "portraitUrl", "profileImageUrl"];
const textFields = ["shortBio", "bio", "introText", "description", "shortDescription", "teaserText", "longBio", "vita", "biography", "bodyText", "longDescription", "profileText"];

console.log(`Oeffentliche Referenten: ${speakers.length}`);
speakers.forEach((speaker) => {
  const images = fieldList(speaker, imageFields);
  const texts = fieldList(speaker, textFields);
  const missing = [
    images.length ? "" : "Bild fehlt",
    texts.length ? "" : "Text/Vita fehlt"
  ].filter(Boolean).join(", ");
  if (!missing) return;
  console.log(`- ${speakerName(speaker)} [${speaker.id}] -> ${missing}`);
  console.log(`  status=${speaker.status || ""}, visibility=${speaker.visibility || ""}, company=${speaker.company || ""}`);
  console.log(`  imageFields=${images.join(", ") || "-"}`);
  console.log(`  textFields=${texts.join(", ") || "-"}`);
});
