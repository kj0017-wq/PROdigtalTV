import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "prodigitaltv-da47b";
const apply = process.argv.includes("--apply");
const now = new Date().toISOString();

const mappings = [
  ["speakers-bjorn-adamski", "berlinale-2026-bjoern-adamski-cloudunabhaengiges-videostreaming"],
  ["speakers-christian-schmeichel", "salzburg-2025-christian-schmeichel-dokumentarfilm-produktion"],
  ["speakers-gregor-c-blach", "berlinale-2026-gregor-blach-kreativitaet-ki"],
  ["speakers-jeanine-harmtodt", "salzburg-2025-jeanine-harmtodt-social-media-trends"],
  ["speakers-stefan-uhl", "berlinale-2026-stefan-uhl-tv-pricing-modell"]
];

function speakerName(speaker = {}) {
  return speaker.name || [speaker.firstName, speaker.lastName].filter(Boolean).join(" ").trim() || speaker.id || "";
}

function cleanText(value = "") {
  return String(value || "")
    .replace(/\*\*/g, "")
    .replace(/^\s*#+\s*/gm, "")
    .replace(/^\s*\*([^*]+)\*\s*$/gm, "$1")
    .trim();
}

function shortText(topic = {}) {
  return cleanText(topic.shortDescription || topic.subtitle || topic.subline || topic.description || "").slice(0, 360);
}

function longText(topic = {}) {
  return cleanText(topic.longDescription || topic.description || topic.bodyText || topic.shortDescription || "");
}

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const changes = [];
for (const [speakerId, topicId] of mappings) {
  const [speakerSnap, topicSnap] = await Promise.all([
    db.collection("speakers").doc(speakerId).get(),
    db.collection("topics").doc(topicId).get()
  ]);
  if (!speakerSnap.exists || !topicSnap.exists) continue;
  const speaker = { id: speakerSnap.id, ...speakerSnap.data() };
  const topic = { id: topicSnap.id, ...topicSnap.data() };
  const update = { updatedAt: now };
  if (!speaker.shortBio && !speaker.bio) update.shortBio = shortText(topic);
  if (!speaker.longBio && !speaker.vita && !speaker.biography) {
    update.longBio = longText(topic);
    update.vita = longText(topic);
  }
  if (Object.keys(update).length > 1) {
    changes.push({ speaker, topic, update });
  }
}

console.log(apply ? "APPLY" : "DRY RUN");
changes.forEach(({ speaker, topic, update }) => {
  console.log(`- ${speakerName(speaker)} [${speaker.id}] <= ${topic.title}`);
  console.log(`  shortBio: ${update.shortBio ? "setzen" : "unveraendert"}, longBio: ${update.longBio ? "setzen" : "unveraendert"}`);
});
if (!changes.length) console.log("Keine fehlenden Vita-Texte zu fuellen.");

if (!apply) {
  console.log("Noch nichts geaendert. Mit --apply ausfuehren.");
  process.exit(0);
}

const batch = db.batch();
changes.forEach(({ speaker, update }) => {
  batch.set(db.collection("speakers").doc(speaker.id), update, { merge: true });
});
await batch.commit();
console.log("Vita-Texte wurden ergaenzt.");
