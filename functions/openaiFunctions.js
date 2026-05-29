const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const db = getFirestore();
const region = "europe-west3";
const openAiApiKey = defineSecret("OPENAI_API_KEY");

const SYSTEM_PROMPT = "Du schreibst fuer PROdigitalTV, ein professionelles Branchennetzwerk der digitalen Medienwirtschaft. Die Sprache ist deutsch, serioes, klar, hochwertig und B2B-orientiert. Texte sollen praezise, gut lesbar und nicht uebertrieben werblich sein. Erfinde keine Fakten. Wenn Informationen fehlen, weise auf fehlende Angaben hin. Erzeuge nur Inhalte, die ein Redakteur anschliessend pruefen und freigeben kann.";

const ACTIONS = {
  improveText: { label: "Text verbessern", mode: "text", instruction: "Verbessere den Text redaktionell, ohne Fakten zu erfinden." },
  shortenText: { label: "Text kuerzen", mode: "text", instruction: "Kuerze den Text fuer eine bessere Lesbarkeit." },
  extendText: { label: "Text verlaengern", mode: "text", instruction: "Erweitere den Text sachlich mit den vorhandenen Informationen." },
  generateSeoMeta: { label: "SEO-Daten erzeugen", mode: "json", instruction: "Erzeuge SEO-Daten als JSON mit seoTitle, seoDescription, keywords und summary." },
  generateEventDescription: { label: "Eventbeschreibung erzeugen", mode: "text", instruction: "Erzeuge eine Eventbeschreibung aus den vorhandenen Eventdaten." },
  generateEventInvitation: { label: "Einladungstext erzeugen", mode: "text", instruction: "Erzeuge einen professionellen Einladungstext fuer das Event." },
  generateEventAgenda: { label: "Agenda strukturieren", mode: "text", instruction: "Strukturiere eine Agenda aus Stichpunkten. Markiere fehlende Angaben." },
  generateEventFaq: { label: "FAQ erzeugen", mode: "text", instruction: "Erzeuge eine kurze FAQ zum Event." },
  generateTopicDescription: { label: "Themenbeschreibung erzeugen", mode: "text", instruction: "Erzeuge eine globale Themenbeschreibung." },
  generateEventTopicDescription: { label: "Event-Thema beschreiben", mode: "text", instruction: "Erklaere das Thema im Kontext dieses Events." },
  generateSpeakerTalkText: { label: "Referententext erzeugen", mode: "text", instruction: "Erzeuge Vortragstitel, Kurzbeschreibung oder Moderationstext nur mit vorhandenen Namen, Rollen und Unternehmen." },
  generateSponsorText: { label: "Sponsor-/Gastgebertext erzeugen", mode: "text", instruction: "Erzeuge einen neutralen B2B-orientierten Sponsor- oder Gastgebertext ohne werbliche Uebertreibung." },
  generateRegistrationMailText: { label: "Mailtext erzeugen", mode: "text", instruction: "Erzeuge einen Mailtext mit Platzhaltern wie {{firstName}}, {{eventTitle}}, {{eventDate}}, {{confirmationLink}}. Keine echten Teilnehmerdaten verwenden." },
  generateEventSummary: { label: "Nachbericht erzeugen", mode: "text", instruction: "Erzeuge einen Nachbericht aus belegten Stichpunkten und melde fehlende Informationen." },
  generateArchiveText: { label: "Archivtext erzeugen", mode: "text", instruction: "Formuliere einen Rueckblicktext fuer Archiv oder Eventnachlauf." },
  generateEventRetrospective: { label: "Rueckblick aus Redaktionstext erzeugen", mode: "text", instruction: "Erzeuge aus Pressemitteilung, Einladung, Agenda oder vorhandenen Stichpunkten einen zusammenhaengenden Rueckblick als Fliesstext. Nutze den im Feld retrospectivePrompt uebergebenen Redaktionsprompt als vorrangige Arbeitsanweisung. Formuliere konsequent in der Vergangenheit, bevorzugt mit Praeteritum oder Perfekt. Beginne nach Moeglichkeit konkret: 'Am [Datum] fand das [Event] bei [Gastgeber] im [Ort/Location] statt. Im Mittelpunkt standen [Themen].' Keine Einladung, keine Anmeldung, keine Zukunftsform, keine Bulletpoints und keine nicht belegten Fakten erfinden." },
  generateGalleryIntro: { label: "Galerie-Einleitung erzeugen", mode: "text", instruction: "Erzeuge eine kurze Einleitung fuer eine Event-Fotogalerie." },
  generateImageAltText: { label: "Alt-Texte erzeugen", mode: "json", instruction: "Erzeuge JSON mit images[]. Nutze Dateiname, Eventtitel, Thema und manuelle Beschreibung; keine Bildinhalte erfinden." },
  generateDownloadDescription: { label: "Downloadbeschreibung erzeugen", mode: "text", instruction: "Erzeuge eine sachliche Beschreibung fuer einen Download." },
  analyzeEventPipelineQuality: { label: "Pipeline-KI-Pruefung", mode: "json", instruction: "Pruefe die Event-Pipeline als JSON mit blockers, warnings, recommendations, optionalNotes und summary. KI-Hinweise duerfen Statuswechsel nicht blockieren." }
};

function preview(value) {
  return typeof value === "string" ? value.slice(0, 600) : JSON.stringify(value).slice(0, 600);
}

function compactText(value = "", maxLength = 10000) {
  const clean = String(value || "").replace(/\r/g, "").trim();
  if (clean.length <= maxLength) return clean;
  const headLength = Math.floor(maxLength * 0.7);
  const tailLength = maxLength - headLength;
  return `${clean.slice(0, headLength).trim()}\n\n[Text gekuerzt]\n\n${clean.slice(-tailLength).trim()}`;
}

async function profileFor(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login erforderlich.");
  const profile = (await db.collection("users").doc(request.auth.uid).get()).data();
  if (!profile || profile.status !== "active") throw new HttpsError("permission-denied", "Benutzer ist nicht aktiv.");
  return { ...profile, uid: request.auth.uid, email: request.auth.token.email || profile.email || "" };
}

async function aiSettings() {
  const snapshot = await db.collection("settings").doc("ai").get();
  return {
    enabled: true,
    provider: "openai",
    model: "gpt-4.1-mini",
    temperature: 0.3,
    maxTokens: 900,
    defaultLanguage: "de",
    defaultTone: "serioes, professionell, B2B-orientiert",
    allowedRoles: ["admin", "editor"],
    loggingEnabled: true,
    ...(snapshot.exists ? snapshot.data() : {})
  };
}

async function requireAiAccess(request) {
  const [profile, settings] = await Promise.all([profileFor(request), aiSettings()]);
  if (!settings.enabled) throw new HttpsError("failed-precondition", "ChatGPT ist deaktiviert.");
  if (!settings.allowedRoles?.includes(profile.role)) throw new HttpsError("permission-denied", "Keine ChatGPT-Berechtigung.");
  return { profile, settings };
}

function buildPrompt(action, payload) {
  const actionConfig = ACTIONS[action];
  if (!actionConfig) throw new HttpsError("invalid-argument", "Unbekannte ChatGPT-Aktion.");
  const fieldName = payload.fieldName || "";
  const context = payload.context || {};
  const isRetrospective = Boolean(context.isRetrospective) || action === "generateEventRetrospective";
  const fieldRules = {
    title: isRetrospective
      ? "Feldregel: Erzeuge nur eine einzelne Rueckblick-Ueberschrift fuer ein vergangenes Event, maximal 90 Zeichen. Sie muss nachtraegliche Berichterstattung signalisieren, nicht Einladung oder Ankuendigung. Keine Subline, keinen Fliesstext."
      : "Feldregel: Erzeuge nur eine einzelne Ueberschrift, maximal 90 Zeichen, keine Subline, keinen Fliesstext.",
    subtitle: isRetrospective
      ? "Feldregel: Erzeuge nur eine einzelne Rueckblick-Subline fuer ein vergangenes Event, maximal 150 Zeichen. Sie soll Ort, Thema, Ergebnis oder Einordnung verdichten, nicht zur Teilnahme auffordern."
      : "Feldregel: Erzeuge nur eine einzelne Subline, maximal 150 Zeichen, keine Ueberschrift, keinen Fliesstext.",
    shortDescription: "Feldregel: Erzeuge nur einen kurzen Teasertext, maximal 180 Zeichen, keine Artikelstruktur.",
    introText: "Feldregel: Erzeuge nur einen kurzen Intro-/Teasertext, maximal 220 Zeichen, keine Artikelstruktur.",
    bodyText: isRetrospective
      ? "Feldregel: Formuliere als nachtraeglichen Rueckblick auf ein vergangenes Event im Fliesstext. Verwende Praeteritum oder Perfekt. Ersetze Einladungs-, Anmelde-, Ankuendigungs- und Zukunftsformulierungen durch Vergangenheit. Keine Bulletpoints."
      : "",
    seoTitle: "Feldregel: Maximal 70 Zeichen.",
    seoDescription: "Feldregel: Maximal 160 Zeichen."
  };
  const safePayload = {
    module: payload.module || "cms",
    entityType: payload.entityType || "event",
    entityId: payload.entityId || "",
    fieldName,
    originalText: compactText(payload.originalText || "", isRetrospective ? 9000 : 12000),
    context,
    placeholders: payload.placeholders || ["{{firstName}}", "{{lastName}}", "{{eventTitle}}", "{{eventDate}}", "{{eventLocation}}", "{{confirmationLink}}"]
  };
  return [
    actionConfig.instruction,
    fieldRules[fieldName] || "",
    isRetrospective ? "Kontextregel Rueckblick: Alle Texte muessen als nachtraegliche Berichterstattung ueber ein bereits vergangenes Event klingen. Verboten sind Formulierungen wie 'wir laden ein', 'melden Sie sich an', 'findet statt', 'wird stattfinden', 'wird sich beschaeftigen', 'wir freuen uns' oder andere Einladungs- und Zukunftslogik. Verwende stattdessen 'fand statt', 'stand im Mittelpunkt', 'diskutierten', 'beleuchtete', 'bot'." : "",
    "Arbeite nur mit den uebergebenen Informationen.",
    "Gib keine automatische Freigabe oder Veroeffentlichung aus.",
    actionConfig.mode === "json" ? "Antworte ausschliesslich als valides JSON." : "Antworte als direkt nutzbarer redaktioneller Vorschlag.",
    `Eingaben: ${JSON.stringify(safePayload)}`
  ].join("\n\n");
}

async function callOpenAi(action, payload, settings) {
  const key = openAiApiKey.value() || process.env.OPENAI_API_KEY;
  if (!key) throw new HttpsError("failed-precondition", "OPENAI_API_KEY ist nicht als Firebase Secret/Environment gesetzt.");
  const actionConfig = ACTIONS[action];
  const body = {
    model: settings.model || "gpt-4.1-mini",
    temperature: Number(settings.temperature ?? 0.3),
    max_output_tokens: Number(settings.maxTokens ?? 900),
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildPrompt(action, payload) }
    ]
  };
  if (actionConfig.mode === "json") {
    body.text = { format: { type: "json_object" } };
  }
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw new HttpsError("internal", data.error?.message || "OpenAI API Fehler.");
  const text = data.output_text || data.output?.flatMap((item) => item.content || []).map((item) => item.text).filter(Boolean).join("\n") || "";
  if (actionConfig.mode !== "json") return { text, raw: data };
  try {
    return { json: JSON.parse(text), text, raw: data };
  } catch {
    return { json: null, text, raw: data };
  }
}

function buildImagePrompt(payload = {}) {
  const context = payload.context || {};
  const manualPrompt = String(payload.prompt || "").trim();
  const title = context.title || payload.title || "";
  const subtitle = context.subtitle || "";
  const text = context.longDescription || context.bodyText || context.introText || context.shortDescription || "";
  const source = [title, subtitle, text].filter(Boolean).join("\n\n");
  return [
    "Erzeuge ein hochwertiges redaktionelles Thumb-Bild fuer PROdigitalTV.",
    "Stil: moderne B2B-Medienwirtschaft, abstrakte Collage, hochwertige TV-/Streaming-/Datenwelt, keine Logos, keine lesbaren Texte, keine Personenportraets, keine Marken.",
    "Bildsprache: klare Komposition, professionelle digitale Collage, Navy/Weiss/Rot als dezente Markenfarben, geeignet fuer Website-Karten und Artikel-Header.",
    manualPrompt ? `Manueller Bildprompt der Redaktion, vorrangig umsetzen: ${manualPrompt.slice(0, 1200)}` : "",
    source ? `Inhaltliche Grundlage aus dem CMS, nur als Kontext nutzen: ${source.slice(0, 1200)}` : ""
  ].filter(Boolean).join("\n\n");
}

async function callOpenAiImage(payload, settings) {
  const key = openAiApiKey.value() || process.env.OPENAI_API_KEY;
  if (!key) throw new HttpsError("failed-precondition", "OPENAI_API_KEY ist nicht als Firebase Secret/Environment gesetzt.");
  const prompt = buildImagePrompt(payload);
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: settings.imageModel || "gpt-image-1",
      prompt,
      size: payload.size || "1536x1024",
      quality: payload.quality || "medium"
    })
  });
  const data = await response.json();
  if (!response.ok) throw new HttpsError("internal", data.error?.message || "OpenAI Bildgenerierung fehlgeschlagen.");
  const imageBase64 = data.data?.[0]?.b64_json;
  if (!imageBase64) throw new HttpsError("internal", "OpenAI hat kein Bild geliefert.");
  return {
    imageDataUrl: `data:image/png;base64,${imageBase64}`,
    mimeType: "image/png",
    prompt,
    fileName: `${payload.entityId || "cms-thumb"}-ki-collage.png`
  };
}

async function writeAiLog({ profile, settings, action, payload, result, status }) {
  if (settings.loggingEnabled === false) return;
  await db.collection("aiLogs").add({
    userId: profile.uid,
    userEmail: profile.email,
    module: payload.module || "cms",
    entityType: payload.entityType || "event",
    entityId: payload.entityId || "",
    action,
    prompt: preview(payload),
    resultPreview: preview(result?.json || result?.text || result),
    provider: "openai",
    model: settings.model || "gpt-4.1-mini",
    status,
    createdAt: FieldValue.serverTimestamp()
  });
}

async function runAiAction(action, request) {
  const payload = request.data || {};
  const { profile, settings } = await requireAiAccess(request);
  try {
    const result = await callOpenAi(action, payload, settings);
    await writeAiLog({ profile, settings, action, payload, result, status: "success" });
    return { action, suggestedText: result.text || "", structured: result.json || null, status: "suggested" };
  } catch (error) {
    await writeAiLog({ profile, settings, action, payload, result: error.message || String(error), status: "failed" }).catch(() => {});
    throw error;
  }
}

function callable(action) {
  return onCall({ region, secrets: [openAiApiKey] }, (request) => runAiAction(action, request));
}

exports.improveText = callable("improveText");
exports.shortenText = callable("shortenText");
exports.extendText = callable("extendText");
exports.generateSeoMeta = callable("generateSeoMeta");
exports.generateEventDescription = callable("generateEventDescription");
exports.generateEventInvitation = callable("generateEventInvitation");
exports.generateEventAgenda = callable("generateEventAgenda");
exports.generateEventFaq = callable("generateEventFaq");
exports.generateTopicDescription = callable("generateTopicDescription");
exports.generateEventTopicDescription = callable("generateEventTopicDescription");
exports.generateSpeakerTalkText = callable("generateSpeakerTalkText");
exports.generateSponsorText = callable("generateSponsorText");
exports.generateRegistrationMailText = callable("generateRegistrationMailText");
exports.generateEventSummary = callable("generateEventSummary");
exports.generateArchiveText = callable("generateArchiveText");
exports.generateEventRetrospective = callable("generateEventRetrospective");
exports.generateGalleryIntro = callable("generateGalleryIntro");
exports.generateImageAltText = callable("generateImageAltText");
exports.generateDownloadDescription = callable("generateDownloadDescription");
exports.analyzeEventPipelineQuality = callable("analyzeEventPipelineQuality");

exports.generateCmsThumbCollage = onCall({ region, secrets: [openAiApiKey], timeoutSeconds: 120, memory: "512MiB" }, async (request) => {
  const payload = request.data || {};
  const { profile, settings } = await requireAiAccess(request);
  try {
    const result = await callOpenAiImage(payload, settings);
    await writeAiLog({ profile, settings, action: "generateCmsThumbCollage", payload, result: { prompt: result.prompt, fileName: result.fileName }, status: "success" });
    return result;
  } catch (error) {
    await writeAiLog({ profile, settings, action: "generateCmsThumbCollage", payload, result: error.message || String(error), status: "failed" }).catch(() => {});
    throw error;
  }
});

exports.saveAiSettings = onCall({ region }, async (request) => {
  const profile = await profileFor(request);
  if (profile.role !== "admin") throw new HttpsError("permission-denied", "Nur Admins duerfen ChatGPT-Einstellungen speichern.");
  const data = request.data || {};
  const settings = {
    enabled: Boolean(data.enabled),
    provider: "openai",
    model: data.model || "gpt-4.1-mini",
    temperature: Number(data.temperature ?? 0.3),
    maxTokens: Number(data.maxTokens ?? 900),
    defaultLanguage: "de",
    defaultTone: data.defaultTone || "serioes, professionell, B2B-orientiert",
    allowedRoles: Array.isArray(data.allowedRoles) ? data.allowedRoles.filter((role) => ["admin", "editor"].includes(role)) : ["admin", "editor"],
    loggingEnabled: data.loggingEnabled !== false,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: profile.uid
  };
  await db.collection("settings").doc("ai").set(settings, { merge: true });
  return { saved: true, settings, apiKeyStorage: "Firebase Secret OPENAI_API_KEY" };
});

exports.testOpenAiConnection = onCall({ region, secrets: [openAiApiKey] }, async (request) => {
  const { settings } = await requireAiAccess(request);
  const result = await callOpenAi("improveText", { originalText: "Verbindungstest PROdigitalTV", context: { purpose: "connection_test" } }, settings);
  return { ok: true, preview: preview(result.text) };
});
