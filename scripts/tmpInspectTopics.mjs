import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "prodigitaltv-da47b";
const topicIds = process.argv.slice(2);
initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();
for (const id of topicIds) {
  const snap = await db.collection("topics").doc(id).get();
  if (!snap.exists) continue;
  const topic = { id: snap.id, ...snap.data() };
  console.log(`\n${topic.id}: ${topic.title}`);
  ["subtitle", "shortDescription", "longDescription", "description", "bodyText"].forEach((field) => {
    if (topic[field]) console.log(`${field}: ${String(topic[field]).slice(0, 600)}`);
  });
}
