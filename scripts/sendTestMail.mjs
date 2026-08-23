import { applicationDefault, initializeApp } from "firebase-admin/app";
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

const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT || "prodigitaltv-da47b";
const to = String(args.get("to") || "kj_privat@yahoo.de").trim().toLowerCase();
const subject = String(args.get("subject") || "PROdigitalTV Testmail").trim();
const text = String(args.get("text") || [
  "Hallo Klaus,",
  "",
  "das ist eine Testmail aus der PROdigitalTV-MailQueue.",
  "Wenn diese Mail angekommen ist, funktioniert der Versandweg grundsätzlich.",
  "",
  "Viele Grüße",
  "PROdigitalTV"
].join("\n"));

if (!to || !to.includes("@")) throw new Error("Bitte --to mit gueltiger E-Mail-Adresse angeben.");

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const ref = await db.collection("mailQueue").add({
  type: "test",
  template: "plain",
  to,
  subject,
  text,
  body: text,
  status: "queued",
  queuedAt: FieldValue.serverTimestamp(),
  createdAt: FieldValue.serverTimestamp(),
  updatedAt: FieldValue.serverTimestamp(),
  source: "codex-test-mail"
});

console.log(JSON.stringify({ ok: true, projectId, mailQueueId: ref.id, to, subject }, null, 2));
