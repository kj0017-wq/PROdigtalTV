import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

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

const serviceAccountPath = args.get("service-account") || process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!serviceAccountPath) throw new Error("Bitte --service-account <pfad> angeben.");

const articleId = args.get("id");
if (!articleId) throw new Error("Bitte --id <editorialContent-id> angeben.");

const serviceAccount = JSON.parse(await readFile(resolve(serviceAccountPath), "utf8"));
const projectId = args.get("project-id") || serviceAccount.project_id || "prodigitaltv-da47b";

initializeApp({ credential: cert(serviceAccount), projectId });
const db = getFirestore();

const placeholderPattern = /Dieser Datensatz ist ein gesperrter Themenvorschlag der KI-Redaktion\. Es wurde bewusst kein fertiger Beitragstext erzeugt, weil vor der Texterstellung eine aktuelle Quellenrecherche mit Belegstellen erforderlich ist\.?/i;

function clean(value = "") {
  return String(value || "")
    .normalize("NFC")
    .replace(/\r/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sourceLine(article = {}) {
  const sources = Array.isArray(article.source_snapshot_json)
    ? article.source_snapshot_json
    : Array.isArray(article.sources)
      ? article.sources
      : [];
  const source = sources.find((item) => item?.url || item?.publisher || item?.name || item?.title) || {};
  const label = source.publisher || source.name || source.title || article.source || "Quelle";
  const url = source.url || article.original_url || article.source_url || article.url || "";
  return url ? `Quelle: ${label} (${url})` : `Quelle: ${label}`;
}

function articleMessage(article = {}) {
  const title = clean(article.headline || article.title || "Nachricht");
  const subline = clean(article.subline || article.subtitle || article.summary || article.teaserText || "");
  const candidateText = [
    article.full_text,
    article.fullText,
    article.source_suggested_text,
    article.ai_original_suggested_text,
    article.summary,
    article.relevance_reason,
    article.editorial_note
  ]
    .map(clean)
    .find((value) => value && !placeholderPattern.test(value) && value.length > 40);
  const text = candidateText || subline || title;
  return [
    title,
    subline && subline !== title ? subline : "",
    text && text !== title && text !== subline ? text : "",
    sourceLine(article)
  ].filter(Boolean).join("\n\n");
}

const ref = db.collection("editorialContent").doc(articleId);
const snapshot = await ref.get();
if (!snapshot.exists) throw new Error(`Datensatz nicht gefunden: ${articleId}`);

const article = { id: snapshot.id, ...snapshot.data() };
const currentBody = clean(article.bodyText || article.body || "");
if (!placeholderPattern.test(currentBody)) {
  console.log("Kein Platzhaltertext im bodyText gefunden. Keine Aenderung noetig.");
  process.exit(0);
}

const nextBody = articleMessage(article);
await ref.set({
  bodyText: nextBody,
  body: nextBody,
  longDescription: nextBody,
  articleText: nextBody,
  ai_original_suggested_text: nextBody,
  source_suggested_text: nextBody,
  updatedAt: FieldValue.serverTimestamp()
}, { merge: true });

console.log(`Platzhalter ersetzt fuer ${articleId}.`);
console.log(nextBody);
