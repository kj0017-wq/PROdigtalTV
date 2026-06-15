const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { createHash } = require("node:crypto");
const aiSourceCatalog = require("./aiSourceCatalog.generated.cjs");

const db = getFirestore();
const region = "europe-west3";
const openAiApiKey = defineSecret("OPENAI_API_KEY");

const SYSTEM_PROMPT = "Du schreibst fuer PROdigitalTV, ein professionelles Branchennetzwerk der digitalen Medienwirtschaft. Die Sprache ist deutsch, serioes, klar, hochwertig und B2B-orientiert. Texte sollen praezise, gut lesbar und nicht uebertrieben werblich sein. Erfinde keine Fakten. Schreibe sichtbare Texte wie normale redaktionelle Beitraege fuer Leserinnen und Leser. Keine Meta-Hinweise, keine Arbeitsanweisungen, keine Hinweise auf Pruefung, Freischaltung, CMS, Redaktion oder technische/organisatorische Aufgaben.";

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
  rewritePressRetrospective: { label: "Rueckblick aus Pressemitteilung", mode: "text", instruction: "" },
  generateGalleryIntro: { label: "Galerie-Einleitung erzeugen", mode: "text", instruction: "Erzeuge eine kurze Einleitung fuer eine Event-Fotogalerie." },
  generateImageAltText: { label: "Bildinhalt beschreiben", mode: "json", instruction: "Beschreibe den Bildinhalt und die visuelle Wirkung. Fuer Bilder darf die KI visuelle Motive, Stimmung, Stil und plausible Bildaussage redaktionell einordnen. Nutze die Bilddatei, sofern imageUrl uebergeben wurde. Antworte als JSON mit description, alt_text, thumbnail_alt, thumbnail_description und optional images[0].beschreibung." },
  generateDownloadDescription: { label: "Downloadbeschreibung erzeugen", mode: "text", instruction: "Erzeuge eine sachliche Beschreibung fuer einen Download." },
  analyzeEventPipelineQuality: { label: "Pipeline-KI-Pruefung", mode: "json", instruction: "Pruefe die Event-Pipeline als JSON mit blockers, warnings, recommendations, optionalNotes und summary. KI-Hinweise duerfen Statuswechsel nicht blockieren." }
};

function normalizeRole(role = "") {
  const normalized = String(role || "").trim().toLowerCase();
  const aliases = {
    administrator: "admin",
    admin: "admin",
    owner: "admin",
    redakteur: "editor",
    redaktion: "editor",
    editor: "editor",
    mitglied: "member",
    member: "member"
  };
  return aliases[normalized] || normalized;
}

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
  if (!profile || profile.status === "inactive") throw new HttpsError("permission-denied", "Benutzer ist nicht aktiv.");
  return { ...profile, role: normalizeRole(profile.role || request.auth.token.role || ""), uid: request.auth.uid, email: request.auth.token.email || profile.email || "" };
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
  const allowedRoles = Array.isArray(settings.allowedRoles) ? settings.allowedRoles.map(normalizeRole) : [];
  console.info("AI access check", {
    uid: profile.uid,
    role: profile.role,
    status: profile.status || "",
    allowedRoles
  });
  const roleAllowed = ["admin", "editor"].includes(profile.role) || allowedRoles.includes(profile.role);
  if (!roleAllowed) throw new HttpsError("permission-denied", "Keine ChatGPT-Berechtigung.");
  return { profile, settings };
}

function buildPrompt(action, payload) {
  const actionConfig = ACTIONS[action];
  if (!actionConfig) throw new HttpsError("invalid-argument", "Unbekannte ChatGPT-Aktion.");
  if (action === "rewritePressRetrospective") {
    const manualPrompt = String(payload.prompt || payload.context?.retrospectivePrompt || "").trim();
    const originalText = compactText(payload.originalText || "", 12000);
    return [
      manualPrompt,
      "",
      originalText ? `Pressemitteilung:\n${originalText}` : "Pressemitteilung:\n"
    ].filter(Boolean).join("\n\n");
  }
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
    "Der sichtbare Text muss die Sache selbst erklaeren: Was ist passiert, worum geht es, warum ist es relevant, welche Einordnung ergibt sich fuer die Medienbranche.",
    "Wenn ein Haupt- oder Beitragstext erzeugt wird, muss der neue Text mindestens 300 Woerter haben und soll idealerweise 300 bis 400 Woerter umfassen, sofern die gelieferten Informationen dafuer ausreichen.",
    "Den Haupttext immer neu formulieren. Keine langen Passagen aus dem Ausgangstext kopieren, keine Satz-fuer-Satz-Paraphrase. Inhalt, Reihenfolge und Einstieg eigenstaendig redaktionell strukturieren.",
    "Beim Neuformulieren den Kern der Aussagen bewahren: konkrete Akteure, Daten, Verfahren, Zahlen, Rechtsfragen, Marktfolgen und zentrale Ursache-Wirkung-Beziehungen nicht verwässern und nicht durch allgemeine Branchenfloskeln ersetzen.",
    "Verwende deutsche Umlaute und ß in sichtbaren deutschen Texten: ä, ö, ü, Ä, Ö, Ü, ß. Nicht ae, oe, ue oder ss schreiben, wenn ein deutscher Umlaut gemeint ist.",
    "Headline, Subline und Beitragstext duerfen sich nicht gegenseitig wiederholen: Headline nennt den Kern, Subline liefert einen neuen Zusatznutzen oder Kontext, der Beitragstext beginnt mit einer anderen Formulierung und entwickelt das Thema weiter.",
    "Headline und Subline duerfen im Wortlaut keine identischen Phrasen enthalten. Die Subline wiederholt die Headline nicht mit anderen Fuellwoertern, sondern ergaenzt einen neuen Aspekt: Zeitraum, Akteure, Folgen, Einordnung, Konflikt, Marktbezug oder Bedeutung fuer die Branche.",
    "Subline immer als vollstaendigen, sauber endenden Satz formulieren. Nicht mitten im Satz abbrechen, keine abgeschnittenen Nebensaetze.",
    "Keywords: genau 4 Keywords pro Beitrag. Jedes Keyword besteht aus genau einem fachlichen Wort, keine Satzteile, keine Mehrwort-Phrasen, keine Halbsätze, keine Wortfragmente wie gepr. Keine Funktionswoerter wie wird, werden, ist, sind, eine, der, die, das, mit, fuer, auf.",
    "Keine Wiederholung gleicher Satzanfänge, gleicher Aussagen oder gleicher Begriffe direkt hintereinander.",
    "Keine Meta-Sprache: keine Hinweise auf Pruefung, Freischaltung, CMS, Redakteure, Quellenarbeit, Arbeitsstand, technische oder organisatorische Aufgaben.",
    "Wenn Informationen fehlen, schreibe nicht ueber fehlende Angaben, sondern formuliere den Beitrag enger entlang der belegten Informationen.",
    actionConfig.mode === "json" ? "Antworte ausschliesslich als valides JSON." : "Antworte als direkt nutzbaren redaktionellen Fliesstext oder Feldtext ohne interne Hinweise.",
    `Eingaben: ${JSON.stringify(safePayload)}`
  ].join("\n\n");
}

function buildImageAltTextPrompt(payload) {
  const context = payload.context || {};
  return [
    "Erzeuge eine echte Bildinhaltsbeschreibung fuer die PROdigitalTV-Mediathek.",
    "Beschreibe Motiv, Bildtyp, Farben, Aufbau, Text im Bild, grafische Elemente, Stimmung, Stil und plausible redaktionelle Bildaussage.",
    "Fuer Bilder darfst du die visuelle Wirkung einordnen und einen passenden redaktionellen Kontext formulieren.",
    "Keine CMS-Verwendungsbeschreibung, keine Aussage wie 'fuer die Mediathek', keine Dateinamen-Erklaerung.",
    "Die Beschreibung soll ein bis zwei sachliche deutsche Saetze haben.",
    "Der Alt-Text soll kurz und konkret sein, maximal 160 Zeichen.",
    "Antworte ausschliesslich als valides JSON mit description, alt_text, thumbnail_alt, thumbnail_description und images[0].beschreibung.",
    `CMS-Kontext nur zur Orientierung, nicht als Ersatz fuer Bildanalyse: ${JSON.stringify({
      title: context.title || "",
      filename: context.filename || "",
      mediaType: context.mediaType || "",
      format: context.format || "",
      tags: context.tags || []
    })}`
  ].join("\n\n");
}

async function callOpenAi(action, payload, settings) {
  const key = openAiApiKey.value() || process.env.OPENAI_API_KEY;
  if (!key) throw new HttpsError("failed-precondition", "OPENAI_API_KEY ist nicht als Firebase Secret/Environment gesetzt.");
  const actionConfig = ACTIONS[action];
  const imageUrl = String(payload.imageUrl || payload.context?.imageUrl || "").trim();
  const isImageAltText = action === "generateImageAltText" && imageUrl;
  const input = [
    action === "rewritePressRetrospective" ? null : { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: isImageAltText
        ? [
            { type: "input_text", text: buildImageAltTextPrompt(payload) },
            { type: "input_image", image_url: imageUrl }
          ]
        : buildPrompt(action, payload)
    }
  ].filter(Boolean);
  const body = {
    model: settings.model || "gpt-4.1-mini",
    temperature: Number(settings.temperature ?? 0.3),
    max_output_tokens: Number(settings.maxTokens ?? 900),
    input
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

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeTopicSuggestion(item = {}, index = 0, context = {}) {
  const now = new Date().toISOString();
  const title = String(item.title || item.thema || item.topic || "").trim().slice(0, 180);
  const headline = String(item.headline || title || "").trim().slice(0, 180);
  const subline = String(item.subline || item.thubline || item.summary || "").trim().slice(0, 220);
  const rawKeywords = safeArray(item.keywords || item.tags).map((keyword) => String(keyword || "").trim()).filter(Boolean).slice(0, 10);
  const keyBase = title || headline || `KI-Thema ${index + 1}`;
  const topicKey = String(item.topic_key || keyBase)
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return {
    id: `ai-topic-suggestion-${Date.now()}-${index + 1}-${topicKey || "thema"}`,
    topic_key: topicKey || `thema-${index + 1}`,
    title: title || headline || `KI-Thema ${index + 1}`,
    headline: headline || title || `KI-Thema ${index + 1}`,
    subline,
    category: String(item.category || context.category || "Medienbranche").trim().slice(0, 120),
    keywords: rawKeywords,
    thumbnail_idea: String(item.thumbnail_idea || item.thumbnailIdea || "").trim().slice(0, 500),
    actuality_score: Math.max(0, Math.min(100, Number(item.actuality_score ?? item.aktualitaet ?? 70))),
    industry_score: Math.max(0, Math.min(100, Number(item.industry_score ?? item.branchenrelevanz ?? 75))),
    relevance_score: Math.max(0, Math.min(100, Number(item.relevance_score ?? item.relevanz ?? 75))),
    quality_status: String(item.quality_status || "empfohlen").slice(0, 80),
    quality_score: Math.max(0, Math.min(100, Number(item.quality_score ?? item.qualityScore ?? item.relevance_score ?? item.relevanz ?? 75))),
    duplicate_status: String(item.duplicate_status || "noch nicht geprueft").slice(0, 80),
    source_status: String(item.source_status || "Recherche erforderlich").slice(0, 100),
    status: "vorgeschlagen",
    queue_status: "nicht uebernommen",
    rank: index + 1,
    teaser: String(item.teaser || item.teaser_text || item.teaserText || item.short_text || item.shortText || item.summary || item.subline || "").trim().slice(0, 320),
    reason: String(item.reason || item.begruendung || "").trim().slice(0, 800),
    possible_sources: safeArray(item.possible_sources || item.quellenarten).map((source) => {
      if (source && typeof source === "object") return String(source.name || source.title || source.publisher || source.domain || source.url || "").trim();
      return String(source || "").trim();
    }).filter((source) => source && source !== "[object Object]").slice(0, 8),
    source_candidates: safeArray(item.source_candidates || item.quellen || item.sources).map((source) => {
      if (typeof source === "string") return { name: source.trim(), url: "" };
      return {
        id: String(source?.id || source?.source_id || source?.sourceId || "").trim(),
        name: String(source?.name || source?.title || source?.publisher || source?.domain || "").trim(),
        publisher: String(source?.publisher || source?.name || "").trim(),
        url: String(source?.url || "").trim(),
        note: String(source?.note || source?.relevance_note || "").trim()
      };
    }).filter((source) => source.name).slice(0, 5),
    primary_source_id: String(item.primary_source_id || item.source_id || item.sourceId || "").trim(),
    source_ids: safeArray(item.source_ids || item.sourceIds || item.primary_source_id || item.source_id).map((source) => String(source || "").trim()).filter(Boolean).slice(0, 5),
    source_names: safeArray(item.source_names || item.sourceNames).map((source) => String(source || "").trim()).filter(Boolean).slice(0, 5),
    source_publication_date: String(item.source_publication_date || item.published_at || item.publishedAt || "").trim().slice(0, 40),
    source_date_status: item.source_publication_date || item.published_at || item.publishedAt ? "Datum ermittelt" : "Datum nicht ermittelt",
    source_url: String(item.source_url || item.sourceUrl || item.url || "").trim().slice(0, 500),
    research_category: context.category || "",
    research_keywords: context.keywords || "",
    origin: "openai_topic_research",
    created_at: now,
    updated_at: now
  };
}

function normalizeForSearch(value = "") {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function sourceCategories(source = {}) {
  const categories = [];
  if (Array.isArray(source.default_for_categories)) categories.push(...source.default_for_categories);
  if (Array.isArray(source.defaultForCategories)) categories.push(...source.defaultForCategories);
  if (source.category) categories.push(source.category);
  return categories.map(normalizeForSearch).filter(Boolean);
}

function categoryTokens(value = "") {
  return normalizeForSearch(value)
    .split(/[^a-z0-9]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2 && !["in", "und", "oder", "der", "die", "das", "fuer", "fur"].includes(item));
}

function categoryPartsMatch(sourceCategory = "", requestedCategory = "") {
  const sourceTokens = categoryTokens(sourceCategory);
  const requestedTokens = categoryTokens(requestedCategory);
  if (!sourceTokens.length || !requestedTokens.length) return false;
  return requestedTokens.every((token) => sourceTokens.includes(token))
    || sourceTokens.every((token) => requestedTokens.includes(token));
}

function sourceMatchesCategoryValue(source = {}, category = "") {
  const categoryKey = normalizeForSearch(category);
  if (!categoryKey) return true;
  return sourceCategories(source).some((item) => (
    item.includes(categoryKey)
    || categoryKey.includes(item)
    || categoryPartsMatch(item, categoryKey)
  ));
}

function sourceMatchesResearch(source = {}, category = "", keywords = "") {
  const categoryKey = normalizeForSearch(category);
  const keywordParts = normalizeForSearch(keywords).split(/[,;\s/]+/).filter((part) => part.length > 3);
  const sourceText = [
    source.name,
    source.domain,
    source.source_type,
    source.sourceType,
    source.category,
    source.notes,
    ...sourceCategories(source)
  ].map(normalizeForSearch).join(" ");
  if (categoryKey && (sourceText.includes(categoryKey) || sourceMatchesCategoryValue(source, categoryKey))) return true;
  if (keywordParts.length && keywordParts.some((part) => sourceText.includes(part))) return true;
  return !categoryKey && !keywordParts.length;
}

function sourceMatchesCategory(source = {}, category = "") {
  const categoryKey = normalizeForSearch(category);
  if (!categoryKey) return true;
  const sourceText = [
    source.category,
    source.notes,
    source.source_type,
    source.sourceType,
    ...sourceCategories(source)
  ].map(normalizeForSearch).join(" ");
  return sourceText.includes(categoryKey) || sourceMatchesCategoryValue(source, categoryKey);
}

function sourceUsageKey(source = {}) {
  return String(source.id || source.domain || source.url || source.name || "").trim();
}

function sourceIsExcluded(source = {}) {
  const text = normalizeForSearch([source.id, source.name, source.domain, source.url].join(" "));
  return /\brtl\b|rtl deutschland|rtl\.com|rtl\.de/.test(text);
}

function uniqueSourceList(sources = []) {
  const seen = new Set();
  return sources.filter((source) => {
    const key = String(source.id || source.domain || source.url || source.name || "").trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function usedSourceKeysFromSuggestion(suggestion = {}) {
  return new Set([
    ...safeArray(suggestion.source_ids || suggestion.sourceIds),
    suggestion.primary_source_id,
    ...safeArray(suggestion.source_candidates || suggestion.sources).map((source) => typeof source === "string" ? source : source?.id || source?.source_id || source?.name || source?.domain)
  ].map((item) => String(item || "").trim()).filter(Boolean));
}

function sourceIsGerman(source = {}) {
  const language = normalizeForSearch(source.language || source.lang || "");
  const country = normalizeForSearch(source.country || "");
  const domain = normalizeForSearch(source.domain || source.url || "");
  const name = normalizeForSearch(source.name || source.title || "");
  const notes = normalizeForSearch(source.notes || "");
  if (/(c2pa\.org|w3\.org|smpte\.org|etsi\.org|iabtechlab\.com|tech\.ebu\.ch|access-board\.gov)/.test(domain)) return false;
  const germanDomain = /(^|[./-])(de|deutschland|germany)([./-]|$)/.test(domain)
    || domain.endsWith(".de")
    || domain.includes(".de/")
    || domain.includes("bundes")
    || domain.includes("deutschland")
    || domain.includes("gema.de")
    || domain.includes("vgwort.de");
  const germanCountry = ["de", "deutschland", "germany", "at", "oesterreich", "österreich", "austria", "ch", "schweiz", "switzerland"].includes(country);
  const languageTokens = language.split(/[,;\s]+/).map((item) => item.trim()).filter(Boolean);
  const germanLanguage = languageTokens.includes("de") || language.includes("deutsch");
  const bilingualGerman = language.includes("de/en")
    && (germanDomain || germanCountry || /deutsch|german|bundes|deutsche|deutscher|deutschland/.test(`${name} ${notes}`));
  const germanNamedSource = /(ard|zdf|deutschlandradio|prosiebensat|seven one|vaunet|bitkom|anga|agf|agma|gema|vg wort|fraunhofer|bsi|bmj|bundes|medienanstalten|ffa|medienboard)/.test(`${name} ${notes}`);
  if (language.includes("de/en") && !bilingualGerman && !germanNamedSource) return false;
  const clearlyForeign = /(franzoesisch|franzosisch|france|french|uk-medienmarkt|uk |usa|u\.s\.|international|europaeisch|europaeische|european|global|world|india|british)/.test(`${country} ${name} ${notes}`)
    && !germanLanguage
    && !bilingualGerman
    && !germanCountry
    && !germanDomain
    && !germanNamedSource;
  if (clearlyForeign) return false;
  return germanLanguage || bilingualGerman || germanCountry || germanDomain || germanNamedSource;
}

function selectResearchSources(sources = [], existingSuggestions = [], category = "", keywords = "", limit = 30) {
  const usage = new Map();
  existingSuggestions.forEach((suggestion) => {
    usedSourceKeysFromSuggestion(suggestion).forEach((key) => usage.set(key, (usage.get(key) || 0) + 1));
  });
  const allowed = sources
    .filter((source) => !sourceIsExcluded(source))
    .filter((source) => !String(source.source_status || source.sourceStatus || "").toLowerCase().includes("gesperrt"))
    .filter((source) => sourceIsGerman(source))
    .filter((source) => Number(source.trust_score || source.suggested_trust_score || 0) >= 70);
  const categoryPool = category ? allowed.filter((source) => sourceMatchesCategory(source, category)) : allowed;
  const minimumPoolSize = category ? Math.min(30, allowed.length) : 0;
  const sourcePool = category && categoryPool.length < minimumPoolSize
    ? uniqueSourceList([
      ...categoryPool,
      ...allowed.filter((source) => sourceMatchesResearch(source, category, keywords)),
      ...allowed
    ]).slice(0, minimumPoolSize)
    : categoryPool;
  const scored = allowed.map((source) => {
    if (!sourcePool.includes(source)) return null;
    const key = sourceUsageKey(source);
    const usagePenalty = usage.get(key) || usage.get(source.name) || usage.get(source.domain) || 0;
    const categoryBoost = sourceMatchesResearch(source, category, keywords) ? 80 : 0;
    const hubBoost = sourceSpecificHubPaths(source).length ? 120 : 0;
    return {
      source,
      score: hubBoost + categoryBoost + Number(source.trust_score || 0) - usagePenalty * 60 - Number(source.priority || 3)
    };
  }).filter(Boolean);
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ source }) => ({
      id: source.id || source.domain || source.name,
      name: source.name || source.title || source.domain,
      domain: source.domain || "",
      url: source.url || "",
      source_type: source.source_type || source.sourceType || "",
      trust_score: Number(source.trust_score || source.suggested_trust_score || 0),
      categories: source.default_for_categories || source.defaultForCategories || [source.category].filter(Boolean),
      rss_url: source.rss_url || source.rssUrl || "",
      api_url: source.api_url || source.apiUrl || ""
    }));
}

function absoluteUrl(base = "", path = "") {
  try {
    return new URL(path, base).toString();
  } catch {
    return "";
  }
}

function stripTags(value = "") {
  return String(value || "").replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeBasicEntities(value = "") {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function firstMatch(value = "", pattern) {
  return decodeBasicEntities(stripTags(String(value || "").match(pattern)?.[1] || ""));
}

function normalizeDate(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw.slice(0, 40);
  return date.toISOString().slice(0, 10);
}

async function fetchText(url = "", timeoutMs = 6000) {
  if (!url || !/^https?:\/\//i.test(url)) return "";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "PROdigitalTV-KI-Redaktion/1.0",
        Accept: "application/rss+xml, application/xml, text/xml, text/html, application/xhtml+xml"
      }
    });
    if (!response.ok) return "";
    return await response.text();
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

function parseFeedItems(xml = "", source = {}) {
  const chunks = [
    ...String(xml || "").matchAll(/<item\b[\s\S]*?<\/item>/gi),
    ...String(xml || "").matchAll(/<entry\b[\s\S]*?<\/entry>/gi)
  ].map((match) => match[0]);
  return chunks.map((item) => {
    const atomLink = item.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1] || "";
    const title = firstMatch(item, /<title[^>]*>([\s\S]*?)<\/title>/i);
    const url = firstMatch(item, /<link[^>]*>([\s\S]*?)<\/link>/i) || atomLink;
    const published = firstMatch(item, /<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)
      || firstMatch(item, /<published[^>]*>([\s\S]*?)<\/published>/i)
      || firstMatch(item, /<updated[^>]*>([\s\S]*?)<\/updated>/i)
      || firstMatch(item, /<dc:date[^>]*>([\s\S]*?)<\/dc:date>/i);
    const summary = firstMatch(item, /<description[^>]*>([\s\S]*?)<\/description>/i)
      || firstMatch(item, /<summary[^>]*>([\s\S]*?)<\/summary>/i)
      || firstMatch(item, /<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i);
    if (!title && !url) return null;
    return {
      source_id: source.id || source.domain || source.name || "",
      source_name: source.name || source.domain || "",
      source_domain: source.domain || "",
      title: title || url,
      url,
      published_at: normalizeDate(published),
      summary: summary.slice(0, 500)
    };
  }).filter(Boolean);
}

function parseSitemapUrls(xml = "", baseUrl = "") {
  return [...String(xml || "").matchAll(/<url\b[\s\S]*?<\/url>/gi)].map((match) => {
    const block = match[0];
    return {
      url: firstMatch(block, /<loc[^>]*>([\s\S]*?)<\/loc>/i),
      published_at: normalizeDate(firstMatch(block, /<lastmod[^>]*>([\s\S]*?)<\/lastmod>/i))
    };
  }).filter((item) => item.url && item.url.startsWith("http")).slice(0, 80);
}

function isEditorialPublicationCandidate(item = {}) {
  const url = String(item.url || "").toLowerCase();
  const thematicHub = isThematicHubUrl(item.url || "");
  const rawTitle = String(item.title || "").replace(/\s+/g, " ").trim();
  const cleanedTitle = cleanPublicationTitle(rawTitle);
  const title = normalizeForSearch(item.title || "");
  const combined = `${url} ${title}`;
  if (!item.url || !String(item.url).startsWith("http")) return false;
  if (!cleanedTitle || cleanedTitle.length < (thematicHub ? 4 : 12)) return false;
  if (cleanedTitle.split(/\s+/).filter(Boolean).length < (thematicHub ? 1 : 3)) return false;
  if (/(skip to (main )?content|zum inhalt springen|untermen|hauptmen|menue|menu|einstellungen|ausblenden|pfeil links|presseportal)/i.test(rawTitle)) return false;
  if (/^(presse|pressebereich|pressemitteilungen?|news|aktuelles?|meldungen?|medien|media)\s*[-|:]/i.test(rawTitle)) return false;
  if (/\s[-|:]\s*(presse|pressebereich|pressemitteilungen?|news|aktuelles?|meldungen?|medien|media|bitkom|bpb\.de)$/i.test(rawTitle)) return false;
  if (/sitemap|cHash=|skip-to-content|skip-to-main-content|\/persons?\b|\/person\b|\/team\b|\/mitarbeiter\b|\/kontakt\b|\/impressum\b|\/datenschutz\b|\/login\b|\/suche\b|\/search\b|\/tags?\b|\/category\b|\/author\b/.test(url)) return false;
  if (/\/(portal|presseportal|presse|pressebereich|pressemitteilungen?|news|aktuelles?|meldungen?|medien|media)\/?$/.test(url)) return false;
  if (/(sitemap|personen|persons|person|kontakt|impressum|datenschutz|suche|login|newsletter|pressebereich|presseportal|untermen|hauptmen|einstellungen|ausblenden|skip to content|skip to main content)/.test(title)) return false;
  if (/^(pressemitteilung|pressemitteilungen|news|neuigkeiten|aktuelles|aktuell|meldung|meldungen|artikel|beitrag|mehr erfahren|weiterlesen|lesen sie mehr|details|zur presse|presse|press|media|medien)$/i.test(rawTitle)) return false;
  return /(news|presse|press|aktuell|meldung|mitteilung|artikel|branche|medien|digital|tv|streaming|hbbtv|ott|fast|produktion|regulierung|recht|ki|künstliche|kuenstliche|werbung|vermarktung)/.test(combined);
}

function cleanPublicationTitle(value = "") {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/^(pressemitteilung|pressemeldung|meldung|news|aktuelles?)\s*[:|-]\s*/i, "")
    .replace(/^(pressemitteilung|pressemeldung)\s+/i, "")
    .replace(/\s+-\s+ARD und ZDF disk$/i, "")
    .trim();
}

function publicationTitleKey(value = "") {
  return normalizeForSearch(cleanPublicationTitle(value))
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function looksMostlyEnglish(value = "") {
  const text = normalizeForSearch(value);
  const englishHits = (text.match(/\b(the|and|for|now|available|download|producing|strengthening|sovereignty|resilience|public|software|environment|real time|winter olympics|stress tested|describes|edition|magazine|commission|fines|million|breaching|services|act|agrees|simplify|rules|boost|innovation|protect|citizens|paid|content|summit)\b/g) || []).length;
  const germanHits = (text.match(/\b(und|der|die|das|fuer|für|medien|branche|sender|plattform|produktion|vermarktung|recht|politik|digital|aktuell|meldet|zeigt)\b/g) || []).length;
  return englishHits >= 3 && englishHits > germanHits;
}

function hasMediaIndustrySignal(item = {}) {
  const text = normalizeForSearch([
    cleanPublicationTitle(item.title),
    item.summary,
    item.url,
    item.source_name,
    item.source_domain,
    item.publisher
  ].join(" "));
  return /(medien|media|broadcast|tv|fernsehen|streaming|ott|hbbtv|fast|plattform|distribution|produktion|postproduktion|audio|video|werbung|vermarktung|rechte|urheber|gema|vg wort|barrierefreiheit|untertitel|ki|kuenstliche|daten|standard|technologie|digital|redaktion|journalismus|sender|mediathek|pressefreiheit|regulierung|publizistisch|qualitaet|vaunet|meedia|dwdl|medienanstalten|bitkom|anga|agf|bsi|fraunhofer|screenondemand|adtech|prospekt|connected tv|smart tv|bewegtbild|konvergenz|plattformregulierung)/.test(text);
}

const EDITORIAL_KEYWORD_RULES = [
  ["KI", [" ki ", "kuenstliche intelligenz", "kunstliche intelligenz", "artificial intelligence"]],
  ["KI in Redaktion", ["ki in redaktion", "redaktionelle ki", "ki redaktion", "newsroom ai"]],
  ["Voice-Cloning", ["voice cloning", "voice-cloning", "ki stimmen", "ki-stimmen", "synthetische stimmen"]],
  ["Streaming", ["streaming", "streamingdienst", "streaming-angebot", "streaming angebot"]],
  ["OTT", [" ott ", "over the top", "over-the-top"]],
  ["FAST-Channels", ["fast channel", "fast-channel", "fast channels", "fast-channels"]],
  ["HbbTV", ["hbbtv"]],
  ["Smart-TV", ["smart tv", "smart-tv", "connected tv", "ctv"]],
  ["Addressable TV", ["addressable tv", "adressierbare werbung", "adressierbares tv"]],
  ["Mediathek", ["mediathek", "mediatheken"]],
  ["Distribution", ["distribution", "ausspielung", "verbreitung"]],
  ["CDN", [" cdn ", "content delivery network"]],
  ["Produktion", ["produktion", "produktionsprozess", "produktionsprozesse"]],
  ["Postproduktion", ["postproduktion", "post-production"]],
  ["Synchronbranche", ["synchron", "synchronbranche", "synchronisation"]],
  ["Vermarktung", ["vermarktung", "vermarkter"]],
  ["Werbung", ["werbung", "werbemarkt", "werbestrategie"]],
  ["Reichweite", ["reichweite", "reichweiten"]],
  ["Plattformregulierung", ["plattformregulierung", "plattformregeln", "digital services act", " dsa "]],
  ["Medienrecht", ["medienrecht", "rundfunkrecht"]],
  ["Urheberrecht", ["urheberrecht", "copyright"]],
  ["Verwertungsrecht", ["verwertungsrecht", "rechteklaerung", "rechteklarung"]],
  ["Musikrechte", ["musikrechte", "gema", "vg wort"]],
  ["Barrierefreiheit", ["barrierefreiheit", "accessibility", "accessible"]],
  ["Untertitel", ["untertitel", "subtitles", "captioning"]],
  ["Leichte Sprache", ["leichte sprache"]],
  ["Medienpolitik", ["medienpolitik", "medienaufsicht"]],
  ["Digitalmedien", ["digitalmedien", "digitale medien"]]
];

const KEYWORD_STOPWORDS = new Set([
  "quelle", "quellen", "quellenlage", "quellenfund", "redaktionell", "redaktionelle", "redaktioneller",
  "pruefen", "prufen", "veroeffentlichung", "veroeffentlichungen", "veroffentlichung", "veroffentlichungen",
  "gefunden", "thema", "themen", "vorschlag", "themenvorschlag", "nachricht", "nachrichten",
  "aktuell", "aktuelle", "aktuelles", "meldung", "meldungen", "presse", "pressemitteilung",
  "news", "artikel", "beitrag", "branche", "medienbranche", "digital", "digitale", "digitalen"
]);

function normalizedKeywordHaystack(...parts) {
  return ` ${normalizeForSearch(parts.filter(Boolean).join(" ")).replace(/[^a-z0-9+.-]+/g, " ")} `;
}

function cleanKeywordCandidate(value = "") {
  return String(value || "")
    .replace(/^themenvorschlag:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[-:]+|[-:]+$/g, "");
}

function keywordKey(value = "") {
  return normalizeForSearch(cleanKeywordCandidate(value)).replace(/[^a-z0-9+]+/g, " ").trim();
}

function isGoodKeywordCandidate(value = "") {
  const clean = cleanKeywordCandidate(value);
  const key = keywordKey(clean);
  if (!clean || clean.length < 2 || clean.length > 44) return false;
  if (KEYWORD_STOPWORDS.has(key)) return false;
  if (/^(bei|von|mit|fuer|fur|und|oder|aus|zur|zum|der|die|das)\b/i.test(clean)) return false;
  return /[a-zA-Z0-9]/.test(clean);
}

function addKeywordCandidate(map, keyword, score = 60) {
  const clean = cleanKeywordCandidate(keyword);
  if (!isGoodKeywordCandidate(clean)) return;
  const key = keywordKey(clean);
  const existing = map.get(key);
  if (!existing || existing.score < score) map.set(key, { keyword: clean, score });
}

function editorialKeywordsFromContext({ title = "", subline = "", summary = "", category = "", fallbackKeywords = [] } = {}, limit = 8) {
  const text = normalizedKeywordHaystack(title, subline, summary, category);
  const candidates = new Map();
  String(category || "").split(/\s*\/\s*/).forEach((item) => addKeywordCandidate(candidates, item, 86));
  safeArray(fallbackKeywords).forEach((item) => addKeywordCandidate(candidates, item, 82));
  EDITORIAL_KEYWORD_RULES.forEach(([label, terms]) => {
    if (terms.some((term) => text.includes(normalizedKeywordHaystack(term)))) {
      const titleBoost = normalizedKeywordHaystack(title, category).includes(normalizedKeywordHaystack(label)) ? 10 : 0;
      addKeywordCandidate(candidates, label, 90 + titleBoost);
    }
  });
  String(title || "").match(/\b[A-Z][A-Za-z0-9+]*(?:-[A-Z0-9][A-Za-z0-9+]*)+\b/g)?.forEach((item) => addKeywordCandidate(candidates, item, 74));
  const sorted = [...candidates.values()]
    .sort((a, b) => b.score - a.score || a.keyword.localeCompare(b.keyword, "de"))
    .map((item) => item.keyword);
  return sorted.slice(0, limit);
}

function hasTitleMediaIndustrySignal(item = {}) {
  const text = normalizeForSearch([
    cleanPublicationTitle(item.title),
    item.summary
  ].join(" "));
  return /(sender|sendermarke|mediengruppe|streaming|ott|fast|plattform|distribution|produktion|postproduktion|format|programmstrategie|content|vermarktung|werbung|reichweite|mediathek|branche|medien|digital|tv|fernsehen|audio|video|ki|technologie)/.test(text);
}

function isThematicHubUrl(value = "") {
  const url = normalizeForSearch(value);
  return /\/(themen|thema|forschung|fakten-impulse|positionen|positionspapiere|publikationen|studien|reports|gutachten|marktentwicklung|politik-recht|medien-gesellschaft|europa|vielfaltssicherung|plattformregulierung|technik-und-innovation|kuenstliche-intelligenz|bewegtbildforschung|methode|messung|konvergenzstandard|magazin|resource-library|specifications|forschungsthemen)\b/.test(url);
}

function isPressLandingUrl(value = "") {
  const url = normalizeForSearch(String(value || "").replace(/[?#].*$/, "").replace(/\/+$/, ""));
  return /\/(presse|press|newsroom|aktuelles|news|meldungen|mitteilungen|pressemitteilungen|pressemeldungen|presseinformationen|pressebereich|media|medien|service\/presse|unternehmen\/presse)$/.test(url)
    || /\/(presse|press|newsroom|aktuelles|news|meldungen|mitteilungen|pressemitteilungen|pressemeldungen|presseinformationen|pressebereich|media|medien)\/(alle|archiv|uebersicht|overview|index)?$/.test(url);
}

function editorialTeaserFromTitle(title = "", sourceName = "", category = "") {
  const cleanTitle = cleanPublicationTitle(title).replace(/\s+/g, " ").trim();
  const key = normalizeForSearch(cleanTitle);
  const source = String(sourceName || "").replace(/\s+/g, " ").trim();
  if (!cleanTitle) return "";
  if (key.includes("kompass") && key.includes("qualitat") && key.includes("zdf")) {
    return "Das ZDF stellt Orientierung fuer Qualitaet in seinen Angeboten in den Mittelpunkt.";
  }
  if (key.includes("medien fur vielfalt") || key.includes("diversitat")) {
    return "Medienanbieter diskutieren, wie Vielfalt, Teilhabe und Verantwortung in Redaktion und Programm sichtbarer werden.";
  }
  if (key.includes("re publica") || key.includes("gerechte ki")) {
    return "ARD und ZDF greifen die Debatte ueber gerechte KI und Vielfalt in digitalen Medien auf.";
  }
  if (key.includes("fakten impulse") || key.includes("forschungsportal")) {
    return "Die Medienanstalten buendeln Forschung und Einordnung zu aktuellen Fragen der Medienaufsicht.";
  }
  if (key.includes("streaming")) {
    return `${source || "Die Quelle"} rückt Streaming, Plattformstrategie und digitale Angebote in den Fokus.`;
  }
  if (key.includes("vermarktung") || key.includes("werbung")) {
    return `${source || "Die Quelle"} zeigt eine Entwicklung bei Vermarktung, Werbung oder Reichweiten im Bewegtbildmarkt.`;
  }
  return cleanTitle.endsWith(".") ? cleanTitle : `${cleanTitle}.`;
}

function isGeneralNewsOrLandingCandidate(item = {}) {
  const title = publicationTitleKey(item.title);
  const url = normalizeForSearch(item.url || "");
  const hasDate = Boolean(item.published_at);
  const thematicHub = isThematicHubUrl(item.url || "");
  if (!title) return true;
  if (!hasDate && title.split(/\s+/).length <= 3 && !thematicHub) return true;
  if (looksMostlyEnglish(item.title || "")) return true;
  if (/^(audio und medientechnologien|ard im presseportal|presseportal|skip to content|skip to main content)$/.test(title)) return true;
  if (/skip to .*content|main content/.test(title)) return true;
  if (/(ansprechpartner|redaktionelle fragen|direkt zum seiteninhalt|seiteninhalt springen|fabian aus|gerhard schroder|gerhard schroeder|moskau|exklusiv|drama|trauriger rekord|armutsgefahrdet|armutsgefaehrdet|so viele deutsche|winter olympics|olympics|svt|sport|koenig|koenigin|promi|stars|dschungel|bachelor|lets dance|gzsz|unter uns|alles was zaehlt|sensationspreis|ostertainment|testsieger|vergleichstest|sparen|deal|rabatt)/.test(title)) return true;
  if (/\/kontakt|\/ansprechpartner|\/press(?:e)?\/contact|\/programm\/|\/sendungen\/|\/videos?\/|\/sport\/|\/news\/politik\//.test(url)) return true;
  return false;
}

function parseHtmlCandidates(html = "", pageUrl = "", source = {}) {
  const title = firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const published = String(html || "").match(/(?:article:published_time|datePublished|pubdate|publishdate)["'\s:=]+([^"'<>\s]+)/i)?.[1] || "";
  const editorialLinkPattern = /(news|press|presse|pressemeldungen|positionen|publikationen|aktuelles|blog|media|medien|themen|politik-recht|marktentwicklung|gesellschaft|europa|standard|policy|regulation|release|meldung|unternehmen|spotlight|studie|manifesto|urheberrecht|werbung|jugendmedienschutz|datensouveraenitaet|netz-infrastruktur|medienordnung)/i;
  const links = [...String(html || "").matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({
      href: absoluteUrl(pageUrl, match[1]),
      label: decodeBasicEntities(stripTags(match[2]))
    }))
    .filter((link) => link.href && link.label && editorialLinkPattern.test(`${link.href} ${link.label}`))
    .slice(0, 45);
  const self = title && !isPressLandingUrl(pageUrl) ? [{
    source_id: source.id || source.domain || source.name || "",
    source_name: source.name || source.domain || "",
    source_domain: source.domain || "",
    title,
    url: pageUrl,
    published_at: normalizeDate(published),
    summary: ""
  }] : [];
  return self.concat(links.map((link) => ({
    source_id: source.id || source.domain || source.name || "",
    source_name: source.name || source.domain || "",
    source_domain: source.domain || "",
    title: link.label,
    url: link.href,
    published_at: "",
    summary: ""
  })));
}

function sourceSpecificHubPaths(source = {}) {
  const domain = normalizeForSearch(source.domain || source.url || source.name || "");
  if (/die-medienanstalten/.test(domain)) {
    return [
      "/aufgaben/vielfaltssicherung/plattformregulierung/",
      "/aufgaben/vielfaltssicherung/technik-und-innovation/",
      "/forschung/",
      "/fakten-impulse/",
      "/forschung/audio-trends/",
      "/forschung/video-trends/",
      "/forschung/kuenstliche-intelligenz/",
      "/service/positionspapiere/",
      "/service/gutachten/",
      "/pressemitteilungen/"
    ];
  }
  if (/bitkom/.test(domain)) {
    return [
      "/Bitkom/Ueber-uns/A-Z.html",
      "/Themen/KI-Daten",
      "/Themen/Recht",
      "/Themen/Recht-Regulierung",
      "/Themen/Maerkte-Technologien",
      "/Themen/Digitale-Souveraenitaet-Infrastruktur-Regulierung",
      "/Themen/Digitale-Transformation",
      "/Studienberichte",
      "/mediathek#publikationen",
      "/Presse/Presseinformation"
    ];
  }
  if (/anga/.test(domain)) {
    return [
      "/technik/",
      "/stellungnahmen-positionen/",
      "/blog/",
      "/stellungnahmen/",
      "/presse/"
    ];
  }
  if (/agf/.test(domain)) {
    return [
      "/bewegtbildforschung",
      "/bewegtbildforschung/methode",
      "/bewegtbildforschung/messung",
      "/bewegtbildforschung/konvergenzstandard",
      "/bewegtbildforschung/studien",
      "/service/presse",
      "/service/pressemitteilung"
    ];
  }
  if (/gema/.test(domain)) {
    return [
      "/de/aktuelles",
      "/de/aktuelles/gema-news",
      "/de/aktuelles/ki-und-musik",
      "/de/aktuelles/song-economy",
      "/de/aktuelles/presse",
      "/de/aktuelles/presse/alle-pressemitteilungen",
      "/de/die-gema/publikationen"
    ];
  }
  if (/bsi\.bund/.test(domain)) {
    return [
      "/DE/Home/DE/Themen/themen_node.html",
      "/DE/Home/DE/Themen/Unternehmen-und-Organisationen/unternehmen-und-organisationen_node.html",
      "/DE/Home/DE/Themen/Unternehmen-und-Organisationen/Standards-und-Zertifizierung/Grundschutz-in-der-Informationssicherheit/isms_node.html",
      "/DE/Home/DE/Themen/Unternehmen-und-Organisationen/Cyber-Sicherheitslage/Analysen-und-Prognosen/Threat-Intelligence/threat-intelligence_node.html",
      "/DE/Home/DE/Themen/Regulierte-Wirtschaft/regulierte-wirtschaft_node.html",
      "/DE/Home/DE/Service-Navi/Presse/Pressemitteilungen/pressemitteilungen_node.html"
    ];
  }
  if (/hbbtv/.test(domain)) {
    return [
      "/news-events/",
      "/news-events/#news",
      "/resource-library/",
      "/specifications/"
    ];
  }
  if (/fokus\.fraunhofer/.test(domain)) {
    return [
      "/de/forschungsthemen.html",
      "/de/forschungsthemen/ki.html",
      "/de/forschungsthemen/digitale-vernetzung.html",
      "/de/forschungsthemen/digitales-leben.html",
      "/de/publikationen.html",
      "/de/newsroom.html",
      "/de/newsroom/news.html",
      "/de/newsroom/presse.html"
    ];
  }
  if (/iis\.fraunhofer/.test(domain)) {
    return [
      "/de/pr.html",
      "/de/ff.html",
      "/de/magazin.html",
      "/de/magazin/bereiche.html",
      "/de/magazin/bereiche/audio-und-medientechnologien.html",
      "/de/magazin/serien/kuenstliche-intelligenz-ki-serie.html"
    ];
  }
  if (/ard\.de/.test(domain)) {
    return [
      "/presse",
      "/die-ard",
      "/die-ard/presse-kontakt/ard-pressemeldungen"
    ];
  }
  if (/zdf\.de/.test(domain)) {
    return [
      "/unternehmen/presse",
      "/presse",
      "/zdfunternehmen"
    ];
  }
  return [];
}

function sourceSeedUrls(source = {}) {
  const base = source.url || (source.domain ? `https://${source.domain}` : "");
  const domain = normalizeForSearch(source.domain || source.url || source.name || "");
  const sourceHubUrls = sourceSpecificHubPaths(source).map((path) => absoluteUrl(base, path));
  const topicHubUrls = [
    absoluteUrl(base, "/themen"),
    absoluteUrl(base, "/themen/politik-recht"),
    absoluteUrl(base, "/themen/marktentwicklung"),
    absoluteUrl(base, "/themen/medien-gesellschaft"),
    absoluteUrl(base, "/themen/europa"),
    absoluteUrl(base, "/pressemeldungen"),
    absoluteUrl(base, "/presse/positionen"),
    absoluteUrl(base, "/presse/publikationen"),
    absoluteUrl(base, "/presse/aktuelles"),
    absoluteUrl(base, "/spotlight")
  ];
  const prioritizedTopicHubs = /vau\.net|vaunet/.test(domain) ? topicHubUrls : [];
  return [
    source.rss_url,
    source.rssUrl,
    source.api_url,
    source.apiUrl,
    ...sourceHubUrls,
    ...prioritizedTopicHubs,
    absoluteUrl(base, "/news"),
    absoluteUrl(base, "/aktuelles"),
    absoluteUrl(base, "/presse"),
    absoluteUrl(base, "/pressemitteilungen"),
    ...topicHubUrls,
    absoluteUrl(base, "/service/presse"),
    absoluteUrl(base, "/unternehmen/presse"),
    absoluteUrl(base, "/medien"),
    absoluteUrl(base, "/feed"),
    absoluteUrl(base, "/rss"),
    absoluteUrl(base, "/sitemap.xml")
  ].filter(Boolean);
}

function uniquePublicationCandidates(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    const key = String(item.url || item.title || "").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function rawTopicDocId(runId = "", item = {}, index = 0) {
  const raw = `${runId}-${item.source_id || item.source_name || "source"}-${item.url || item.title || index}`;
  return Buffer.from(raw).toString("base64url").slice(0, 80);
}

function suggestionMatchesPublication(suggestion = {}, publication = {}) {
  const sourceId = String(publication.source_id || "").trim();
  const sourceName = String(publication.source_name || "").trim().toLowerCase();
  const sourceIds = safeArray(suggestion.source_ids || suggestion.sourceIds).map((item) => String(item || "").trim());
  const candidates = safeArray(suggestion.source_candidates || suggestion.sourceCandidates).map((item) => typeof item === "string" ? { name: item } : item || {});
  if (sourceId && (suggestion.primary_source_id === sourceId || sourceIds.includes(sourceId))) return true;
  if (sourceName && safeArray(suggestion.source_names || suggestion.sourceNames).some((name) => String(name || "").trim().toLowerCase() === sourceName)) return true;
  return candidates.some((candidate) => {
    const candidateId = String(candidate.id || candidate.source_id || "").trim();
    const candidateName = String(candidate.name || candidate.publisher || candidate.domain || "").trim().toLowerCase();
    return (sourceId && candidateId === sourceId) || (sourceName && candidateName === sourceName);
  });
}

async function writeRawTopicPublications({ runId, publications = [], category = "", keywords = "", profile, suggestions = [] }) {
  if (!publications.length) return;
  const batch = db.batch();
  publications.forEach((publication, index) => {
    const matchedSuggestions = suggestions.filter((suggestion) => suggestionMatchesPublication(suggestion, publication));
    const ref = db.collection("ai_topic_raw_data").doc(rawTopicDocId(runId, publication, index));
    batch.set(ref, {
      research_run_id: runId,
      raw_type: "source_publication",
      source_id: publication.source_id || "",
      source_name: publication.source_name || "",
      source_domain: publication.source_domain || "",
      title: publication.title || "",
      url: publication.url || "",
      published_at: publication.published_at || "",
      summary: publication.summary || "",
      category_filter: category,
      keyword_filter: keywords,
      suggested_topic_ids: matchedSuggestions.map((suggestion) => suggestion.id),
      suggested_topic_titles: matchedSuggestions.map((suggestion) => suggestion.title || suggestion.headline || "").filter(Boolean),
      assignment_status: matchedSuggestions.length ? "Themenvorschlag zugeordnet" : "Rawfund gespeichert",
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      createdAt: FieldValue.serverTimestamp(),
      createdBy: profile.uid
    }, { merge: true });
  });
  await batch.commit();
}

async function writeRawSourceScans({ runId, scans = [], category = "", keywords = "", profile, suggestions = [] }) {
  if (!scans.length) return;
  const batch = db.batch();
  scans.forEach((scan, index) => {
    const source = scan.source || {};
    const matchedSuggestions = suggestions.filter((suggestion) => {
      const sourceIds = safeArray(suggestion.source_ids);
      const sourceNames = safeArray(suggestion.source_names).map((name) => String(name || "").toLowerCase());
      const primarySourceId = suggestion.primary_source_id || "";
      const sourceId = source.id || source.domain || source.name || "";
      const sourceName = String(source.name || source.domain || "").toLowerCase();
      return (sourceId && (sourceIds.includes(sourceId) || primarySourceId === sourceId)) || (sourceName && sourceNames.includes(sourceName));
    });
    const ref = db.collection("ai_topic_raw_data").doc(rawTopicDocId(runId, { source_id: source.id, source_name: source.name, url: source.url || source.domain || `scan-${index}` }, `scan-${index}`));
    batch.set(ref, {
      research_run_id: runId,
      raw_type: "source_scan",
      source_id: source.id || "",
      source_name: source.name || source.domain || "",
      source_domain: source.domain || "",
      title: scan.publication_count ? `${scan.publication_count} Veroeffentlichungen gefunden` : "Quelle geparst - kein verwertbarer Themenfund",
      url: source.url || "",
      published_at: "",
      summary: scan.publication_count
        ? `Quelle wurde in der Themenrecherche geparst. ${scan.publication_count} moegliche Veroeffentlichungen gefunden.`
        : "Quelle wurde in der Themenrecherche geparst, aber es wurde kein verwertbarer Feed-/News-Fund erkannt.",
      category_filter: category,
      keyword_filter: keywords,
      suggested_topic_ids: matchedSuggestions.map((suggestion) => suggestion.id),
      suggested_topic_titles: matchedSuggestions.map((suggestion) => suggestion.title || suggestion.headline || "").filter(Boolean),
      assignment_status: matchedSuggestions.length ? "Themenvorschlag zugeordnet" : (scan.publication_count ? "Quelle geparst" : "Kein Themenfund"),
      publication_count: scan.publication_count || 0,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      createdAt: FieldValue.serverTimestamp(),
      createdBy: profile.uid
    }, { merge: true });
  });
  await batch.commit();
}

function topicCandidateUrl(item = {}) {
  const direct = String(item.source_url || item.sourceUrl || item.url || "").trim();
  if (/^https?:\/\//i.test(direct)) return direct;
  const candidates = safeArray(item.source_candidates || item.sourceCandidates || item.sources || item.quellen);
  const match = candidates.find((source) => source && typeof source === "object" && /^https?:\/\//i.test(source.url || ""));
  return match?.url || "";
}

function topicSourceKey(item = {}) {
  return String(
    item.primary_source_id
      || item.source_id
      || safeArray(item.source_ids || item.sourceIds)[0]
      || safeArray(item.source_names || item.sourceNames)[0]
      || safeArray(item.source_candidates || item.sourceCandidates).find((source) => source && typeof source === "object")?.name
      || topicCandidateUrl(item)
      || ""
  ).trim().toLowerCase();
}

function topicQualityAssessment(item = {}, context = {}) {
  const title = cleanPublicationTitle(item.title || item.headline || "");
  const text = [title, item.headline, item.subline, item.teaser, item.reason, item.category, safeArray(item.keywords).join(" ")].join(" ");
  const visibleText = [title, item.headline, item.subline, item.teaser].join(" ");
  const normalized = normalizeForSearch(text);
  const sourceUrl = topicCandidateUrl(item);
  const thematicHub = isThematicHubUrl(sourceUrl);
  const publicationLike = {
    title,
    summary: text,
    url: sourceUrl,
    published_at: item.source_publication_date || item.published_at || item.publishedAt || ""
  };
  const reasons = [];
  const minimumTitleWords = thematicHub ? 2 : 4;
  if (!title || title.split(/\s+/).filter(Boolean).length < minimumTitleWords) reasons.push("Titel ist zu allgemein");
  if (/(themenkandidat|themenvorschlag|quellenfund|quellenlage|redaktionell pruefen|quelle geparst|crawler|rawfund|platzhalter)/i.test(visibleText)) reasons.push("Meta- oder Platzhaltertext statt Nachricht");
  if (!hasMediaIndustrySignal(publicationLike)) reasons.push("Kein klarer Medienbranchen-Bezug");
  if (isGeneralNewsOrLandingCandidate(publicationLike)) reasons.push("Allgemeinnews, Landingpage oder Navigationsfund");
  if (!sourceUrl && !topicSourceKey(item)) reasons.push("Keine belastbare Hauptquelle");
  if (String(item.source_status || "").toLowerCase().includes("unzureichend")) reasons.push("Quellenlage unzureichend");
  if (Number(item.industry_score || item.branchenrelevanz || 0) < 68) reasons.push("Branchenrelevanz zu niedrig");
  if (Number(item.relevance_score || item.relevanz || 0) < 68) reasons.push("Gesamtrelevanz zu niedrig");
  if (Number(item.actuality_score || item.aktualitaet || 0) < 55) reasons.push("Aktualitaet zu niedrig");
  if (context.category) {
    const requested = categoryTokens(context.category);
    const hits = requested.filter((token) => normalized.includes(token)).length;
    if (requested.length && hits === 0) reasons.push("Passt nicht zur gewaehlten Kategorie");
  }
  return {
    ok: reasons.length === 0,
    reasons,
    sourceUrl,
    sourceKey: topicSourceKey(item),
    qualityScore: Math.round((
      Number(item.actuality_score || item.aktualitaet || 0)
      + Number(item.industry_score || item.branchenrelevanz || 0)
      + Number(item.relevance_score || item.relevanz || 0)
    ) / 3)
  };
}

function qualityFilterTopicSuggestions(items = [], context = {}, limit = 10) {
  const seenSources = new Set();
  const rejected = [];
  const accepted = [];
  safeArray(items).forEach((item) => {
    const assessment = topicQualityAssessment(item, context);
    const sourceKey = assessment.sourceKey || assessment.sourceUrl;
    if (sourceKey && seenSources.has(sourceKey)) {
      rejected.push({ title: item.title || item.headline || "", reason: "Quelle bereits in dieser Themenauswahl vertreten", quality_reasons: ["Quelle bereits in dieser Themenauswahl vertreten"] });
      return;
    }
    if (!assessment.ok) {
      rejected.push({ title: item.title || item.headline || "", reason: assessment.reasons.join("; "), quality_reasons: assessment.reasons });
      return;
    }
    if (sourceKey) seenSources.add(sourceKey);
    accepted.push({
      ...item,
      quality_status: "empfohlen",
      quality_score: assessment.qualityScore,
      review_status: "Kandidat",
      editorial_decision: "ok",
      source_url: item.source_url || item.sourceUrl || assessment.sourceUrl
    });
  });
  return { accepted: accepted.slice(0, limit), rejected };
}

function fallbackTopicSuggestionsFromPublications(publications = [], context = {}, limit = 10) {
  const seenTitles = new Set();
  const seenSources = new Map();
  return publications
    .filter(isEditorialPublicationCandidate)
    .filter((publication) => hasMediaIndustrySignal(publication))
    .filter((publication) => !isGeneralNewsOrLandingCandidate(publication))
    .filter((publication) => {
      const titleKey = publicationTitleKey(publication.title);
      const sourceKey = String(publication.source_id || publication.source_name || publication.source_domain || "").trim();
      const sourceCount = seenSources.get(sourceKey) || 0;
      if (!titleKey || seenTitles.has(titleKey)) return false;
      if (sourceKey && sourceCount >= 2) return false;
      seenTitles.add(titleKey);
      if (sourceKey) seenSources.set(sourceKey, sourceCount + 1);
      return true;
    })
    .slice(0, limit)
    .map((publication, index) => {
      const sourceName = publication.source_name || publication.source_domain || "Quelle";
      const sourceLabel = publication.published_at ? `${sourceName}, ${publication.published_at}` : sourceName;
      const title = cleanPublicationTitle(publication.title).slice(0, 160);
      const thematicHub = isThematicHubUrl(publication.url || "");
      const teaser = editorialTeaserFromTitle(title, sourceName, context.category).slice(0, 320);
      return normalizeTopicSuggestion({
        title,
        headline: title,
        subline: [sourceName, publication.published_at ? `veroeffentlicht am ${publication.published_at}` : thematicHub ? "Themenhub als Recherchespur" : "redaktionelle Einordnung offen"].filter(Boolean).join(" - "),
        teaser,
        category: context.category || "Medienbranche",
        keywords: editorialKeywordsFromContext({
          title,
          summary: publication.summary,
          category: context.category,
          fallbackKeywords: String(context.keywords || "").split(/[,;\s/]+/)
        }),
        actuality_score: publication.published_at ? 75 : thematicHub ? 66 : 55,
        industry_score: thematicHub ? 74 : 70,
        relevance_score: publication.published_at ? 74 : thematicHub ? 72 : 60,
        duplicate_status: "noch nicht geprueft",
        source_status: publication.published_at ? "Quellenfund vorhanden - redaktionell pruefen" : thematicHub ? "Themenhub gefunden - Relevanz redaktionell konkretisieren" : "Quellenfund vorhanden - redaktionell pruefen",
        reason: `Echter Quellenfund aus ${sourceLabel}. Der Vorschlag basiert auf einer gefundenen Veroeffentlichung und muss vor Artikel-Erstellung redaktionell geprueft und bei Bedarf ins Deutsche uebertragen werden.`,
        source_candidates: [{
          id: publication.source_id || "",
          name: publication.source_name || publication.source_domain || "Quelle",
          publisher: publication.source_name || "",
          url: publication.url || "",
          note: `Direkter Quellenfund der Themenrecherche. Originaltitel: ${publication.title || ""}`.trim()
        }],
        primary_source_id: publication.source_id || "",
        source_ids: [publication.source_id].filter(Boolean),
        source_names: [publication.source_name].filter(Boolean),
        source_publication_date: publication.published_at || "",
        source_date_status: publication.published_at ? "Datum ermittelt" : "Datum nicht ermittelt"
      }, index, context);
    });
}

function uniqueRawTopicSuggestions(items = [], limit = 10) {
  const seenTitles = new Set();
  const seenSources = new Map();
  return safeArray(items).filter((item) => {
    const title = item.title || item.headline || "";
    const titleKey = publicationTitleKey(title);
    const sourceId = item.primary_source_id || item.source_id || safeArray(item.source_ids || item.sourceIds)[0] || "";
    const sourceName = safeArray(item.source_names || item.sourceNames)[0] || "";
    const sourceKey = String(sourceId || sourceName).trim();
    const sourceCount = seenSources.get(sourceKey) || 0;
    const publicationLike = {
      title,
      summary: [item.subline, item.reason, item.category, safeArray(item.keywords).join(" ")].join(" "),
      url: safeArray(item.source_candidates || item.sources).find((source) => source && typeof source === "object" && source.url)?.url || "",
      published_at: item.source_publication_date || item.published_at || ""
    };
    if (!titleKey || seenTitles.has(titleKey)) return false;
    if (!hasMediaIndustrySignal(publicationLike)) return false;
    if (isGeneralNewsOrLandingCandidate(publicationLike)) return false;
    if (sourceKey && sourceCount >= 2) return false;
    seenTitles.add(titleKey);
    if (sourceKey) seenSources.set(sourceKey, sourceCount + 1);
    return true;
  }).slice(0, limit);
}

function fallbackSourceTeaser(sourceName = "", category = "") {
  return `${sourceName} wird als Quelle fuer aktuelle Entwicklungen in ${category || "der Medienbranche"} ausgewertet.`;
}

function fallbackTopicSuggestionsFromScans(scans = [], context = {}, limit = 10) {
  return scans.slice(0, limit).map((scan, index) => {
    const source = scan.source || {};
    const sourceName = source.name || source.domain || `Quelle ${index + 1}`;
    return normalizeTopicSuggestion({
      title: `Quellenlage bei ${sourceName} pruefen`,
      headline: `Quellenlage bei ${sourceName} pruefen`,
      subline: "Quelle wurde geparst, aber noch ohne verwertbaren Themenfund.",
      teaser: fallbackSourceTeaser(sourceName, context.category),
      category: context.category || safeArray(source.categories)[0] || "Medienbranche",
      keywords: editorialKeywordsFromContext({
        title: scan.publication_count ? `${sourceName} Veroeffentlichungen` : sourceName,
        category: context.category || safeArray(source.categories)[0] || "Medienbranche",
        fallbackKeywords: [
          ...String(context.keywords || "").split(/[,;\s/]+/),
          ...safeArray(source.categories)
        ]
      }),
      thumbnail_idea: "Redaktioneller Quellencheck mit Medienbranche-Bezug.",
      actuality_score: scan.publication_count ? 50 : 30,
      industry_score: Number(source.trust_score || 60) >= 70 ? 62 : 45,
      relevance_score: scan.publication_count ? 55 : 35,
      duplicate_status: "noch nicht geprueft",
      source_status: scan.publication_count ? "Recherche erforderlich" : "Quellenlage unzureichend",
      reason: scan.publication_count
        ? "Quelle wurde geparst und muss redaktionell auf konkrete Belege ausgewertet werden."
        : "Quelle wurde geparst, aber es wurde kein verwertbarer Feed-/News-Fund erkannt. Nicht fuer automatische Artikelerstellung empfohlen.",
      source_candidates: [{
        id: source.id || source.domain || source.name || "",
        name: sourceName,
        publisher: sourceName,
        url: source.url || "",
        note: scan.publication_count ? "Quelle wurde in der Themenrecherche geparst." : "Quelle ohne verwertbaren Themenfund in diesem Lauf."
      }],
      primary_source_id: source.id || source.domain || source.name || "",
      source_ids: [source.id || source.domain || source.name || ""].filter(Boolean),
      source_names: [sourceName],
      source_publication_date: "",
      source_date_status: "Kein Veroeffentlichungsdatum ermittelt"
    }, index, context);
  });
}

async function crawlSourcePublications(source = {}) {
  const seedUrls = sourceSeedUrls(source).slice(0, 6);
  const candidates = [];
  for (const url of seedUrls) {
    const text = await fetchText(url);
    if (!text) continue;
    if (/<(rss|feed|item|entry|urlset|sitemapindex)\b/i.test(text)) {
      candidates.push(...parseFeedItems(text, source));
      const sitemapUrls = parseSitemapUrls(text, source.url || url)
        .filter((item) => /(news|press|presse|pressemeldungen|positionen|publikationen|aktuelles|blog|media|medien|themen|politik-recht|marktentwicklung|gesellschaft|europa|standard|policy|regulation|release|meldung|unternehmen|spotlight|studie|urheberrecht|werbung|jugendmedienschutz|datensouveraenitaet|netz-infrastruktur|medienordnung)/i.test(item.url))
        .slice(0, 12);
      candidates.push(...sitemapUrls.map((item) => ({
        source_id: source.id || source.domain || source.name || "",
        source_name: source.name || source.domain || "",
        source_domain: source.domain || "",
        title: item.url.split("/").filter(Boolean).pop()?.replace(/[-_]/g, " ") || item.url,
        url: item.url,
        published_at: item.published_at,
        summary: ""
      })));
    } else {
      candidates.push(...parseHtmlCandidates(text, url, source));
    }
    if (candidates.length >= 10) break;
  }
  return uniquePublicationCandidates(candidates)
    .filter(isEditorialPublicationCandidate)
    .sort((a, b) => String(b.published_at || "").localeCompare(String(a.published_at || "")))
    .slice(0, 5);
}

async function crawlSourcePublicationsWithTimeout(source = {}, timeoutMs = 45000) {
  let timeout;
  try {
    return await Promise.race([
      crawlSourcePublications(source),
      new Promise((resolve) => {
        timeout = setTimeout(() => resolve([]), timeoutMs);
      })
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

async function crawlResearchPublications(sources = [], options = {}) {
  const batchSize = 6;
  const results = [];
  const sourceScans = [];
  const startedAt = Date.now();
  const maxCrawlerMs = 570000;
  let researchedSources = 0;
  let stoppedByTimeBudget = false;
  for (let index = 0; index < sources.length; index += batchSize) {
    if (Date.now() - startedAt > maxCrawlerMs) {
      stoppedByTimeBudget = true;
      break;
    }
    const batch = sources.slice(index, index + batchSize);
    const sourceResults = await Promise.all(batch.map((source) => crawlSourcePublicationsWithTimeout(source, options.sourceTimeoutMs || 45000)));
    researchedSources += batch.length;
    const batchScans = [];
    batch.forEach((source, sourceIndex) => {
      const scan = {
        source,
        publication_count: (sourceResults[sourceIndex] || []).length
      };
      batchScans.push(scan);
      sourceScans.push(scan);
    });
    const batchPublications = sourceResults.flatMap((publications) => publications.slice(0, 4));
    results.push(...batchPublications);
    if (typeof options.onBatch === "function") {
      await options.onBatch({
        scans: batchScans,
        publications: batchPublications,
        researchedSources,
        totalSources: sources.length
      });
    }
  }
  const publications = uniquePublicationCandidates(results)
    .filter(isEditorialPublicationCandidate)
    .sort((a, b) => String(b.published_at || "").localeCompare(String(a.published_at || "")))
    .slice(0, 80);
  return {
    publications,
    sourceScans,
    researchedSources,
    totalSources: sources.length,
    stoppedByTimeBudget
  };
}

function pressReleaseDocId(url = "", title = "") {
  return `press-${createHash("sha1").update(String(url || title || Date.now())).digest("hex").slice(0, 24)}`;
}

function pressSourceStatusDocId(source = {}) {
  const key = source.id || source.domain || source.url || source.name || Date.now();
  return `press-source-${createHash("sha1").update(String(key)).digest("hex").slice(0, 24)}`;
}

function pressSourceKey(source = {}) {
  return String(source.id || source.domain || source.url || source.name || "").trim().toLowerCase();
}

function pressDuplicateTitleKey(value = "") {
  return normalizeForSearch(value)
    .replace(/\b(pressemitteilung|pressemittelung|pressemiteilung|pressemeldung|pressekontakt|anmeldung|meldung|news|aktuell|aktuelles)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isMeaningfulPressHeadline(value = "") {
  const title = cleanPublicationTitle(value);
  const key = normalizeForSearch(title);
  const words = key.split(/\s+/).filter((word) => word.length > 2);
  if (words.length < 4) return false;
  if (/^(pressemitteilung|pressemittelung|pressemiteilung|pressemeldung|presseinformation|presse info)\s*(vom|zu|am)?\b/.test(key)) return false;
  if (/^(pressemitteilung|pressemittelung|pressemiteilung|pressemeldung|presseinformation|presseinformationen|pressekontakt|press release|aktuelles|kurzmeldung|veranstaltung|termin|einladung|anmeldung)\b/.test(key)) return false;
  if (/\b(vom|am)\s+\d{1,2}\s+(januar|februar|maerz|marz|april|mai|juni|juli|august|september|oktober|november|dezember)\s+20\d{2}$/.test(key)) return false;
  return true;
}

function isEventPressRelease(item = {}) {
  const text = normalizeForSearch([item.title, item.url, item.summary, item.full_text].join(" "));
  if (/\/(veranstaltung|veranstaltungen|events?|termine|kalender|messe|webinar)\b/.test(text)) return true;
  return /\b(veranstaltung|veranstaltungen|event|termin|termine|messe|webinar|konferenz|fachtagung|kongress|save the date|presseeinladung|einladung|livestream|stand [a-z0-9]|\bbesuchen sie uns\b|findet am|findet vom|diskutieren auf der|auf der re publica|re publica 20\d{2})\b/.test(text);
}

function pressUrlKey(value = "") {
  return String(value || "").trim().replace(/#.*$/, "").replace(/[?&]utm_[^=]+=[^&]+/gi, "").replace(/[?&]$/, "").toLowerCase();
}

function futureIsoDate(days = 14) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function shouldSkipPressSource(status = {}, now = new Date()) {
  const skipUntil = status.skip_until || status.skipUntil || "";
  return Number(status.consecutive_empty_scans || 0) >= 3
    && skipUntil
    && new Date(skipUntil).getTime() > now.getTime();
}

function slugifyPressValue(value = "") {
  return normalizeForSearch(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || `presse-${Date.now()}`;
}

function isPressReleaseCandidate(item = {}) {
  const text = normalizeForSearch([item.title, item.url, item.summary].join(" "));
  const title = publicationTitleKey(item.title || "");
  if (!item.url || !/^https?:\/\//i.test(item.url)) return false;
  if (isPressLandingUrl(item.url || "")) return false;
  if (/\/(kontakt|contact|ansprechpartner|impressum|datenschutz|newsletter|abo|login|suche|search|tag|author)\b/.test(text)) return false;
  if (/^(presse|pressekontakt|presseinformationen|pressemitteilungen?|pressemittelungen?|pressemiteilungen?|pressemitteilungen und publikationen|pressemeldungen positionen und publikationen|newsroom|unser newsroom|aktuelles|veranstaltung|termin|event|filme und animationen|anmeldung|anmeldung zum newsletter|newsletter|pressetexte 2024|pressetexte 2025|pressetexte 2026)\b/.test(title)) return false;
  if (isEventPressRelease(item)) return false;
  return /(pressemitteilung|pressemeldung|press release|press-release|presseinformation|presse-info|\/pressemitteilung|\/pressemeldung|\/press-release|\/meldung|\/mitteilung)/.test(text);
}

function stripHtmlForFullText(html = "") {
  const withoutNoise = String(html || "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<nav\b[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, " ");
  const article = withoutNoise.match(/<article\b[\s\S]*?<\/article>/i)?.[0]
    || withoutNoise.match(/<main\b[\s\S]*?<\/main>/i)?.[0]
    || withoutNoise;
  return cleanImportedPressText(decodeBasicEntities(stripTags(article)));
}

function cleanImportedPressText(value = "") {
  return String(value || "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/â€ž|â€œ|â€�/g, "\"")
    .replace(/â€˜|â€™/g, "'")
    .replace(/â€“|â€”/g, "-")
    .replace(/&[a-z0-9#]+;/gi, " ")
    .replace(/\bpressrelease\b/gi, " ")
    .replace(/\b(Cookie|Cookies|Datenschutz|Impressum|Newsletter abonnieren|Social Media|Zum Inhalt springen|Menue|Menü|Suche|Teilen|Drucken)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleLooksLikePressLanding(value = "") {
  const key = publicationTitleKey(value);
  return !key
    || /^(der|die|das)\s+.+verlagsgruppe$/.test(key)
    || /^(presse|pressekontakt|presseinformationen|pressemitteilungen?|pressemittelungen?|pressemiteilungen?|pressemitteilungen und publikationen|pressemeldungen positionen und publikationen|newsroom|unser newsroom|aktuelles|veranstaltung|filme und animationen|anmeldung|anmeldung zum newsletter|newsletter|pressetexte 2024|pressetexte 2025|pressetexte 2026)\b/.test(key);
}

function importedPressTitle(detailHtml = "", candidate = {}) {
  const candidates = [
    firstMatch(detailHtml, /<h1[^>]*>([\s\S]*?)<\/h1>/i),
    firstMatch(detailHtml, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i),
    firstMatch(detailHtml, /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i),
    candidate.title || ""
  ].map((value) => cleanImportedPressText(cleanPublicationTitle(value || "")))
    .filter(Boolean);
  return candidates.find((title) => !titleLooksLikePressLanding(title)) || candidates[0] || "";
}

function pressSummaryFromText(title = "", fullText = "") {
  const cleanTitle = cleanImportedPressText(title);
  const text = cleanImportedPressText(fullText)
    .replace(cleanTitle, " ")
    .replace(/\s+/g, " ")
    .trim();
  const sentences = text
    .split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ0-9])/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 50 && !/(cookie|datenschutz|impressum|newsletter|zum inhalt springen)/i.test(sentence));
  return sentences.slice(0, 3).join(" ").slice(0, 900) || text.slice(0, 700);
}

function hasEditorialPressText(title = "", fullText = "") {
  const cleanTitle = normalizeForSearch(title);
  const text = cleanImportedPressText(fullText);
  const normalized = normalizeForSearch(text);
  const sentences = text
    .split(/(?<=[.!?])\s+(?=[A-ZÃ„Ã–Ãœ0-9])/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 60)
    .filter((sentence) => !/(cookie|datenschutz|impressum|newsletter|pressekontakt|ansprechpartner|kontakt|anmeldung|registrierung|ticket|teilnahme|zum inhalt springen)/i.test(sentence));
  const editorialSignals = (normalized.match(/\b(erklaert|kuendigt|kundigt|veroeffentlicht|veroffentlicht|startet|entwickelt|erweitert|setzt|fordert|zeigt|berichtet|kritisiert|betont|vereinbart|beschliesst|beschliest|investiert|praesentiert|prasentiert|kooperiert|arbeitet|plant|nutzt|stellt|bringt|reagiert)\b/g) || []).length;
  const serviceSignals = (normalized.match(/\b(pressekontakt|ansprechpartner|anmeldung|registrierung|ticket|teilnahme|veranstaltung|termin|event|webinar|konferenz|messe|einladung|save the date|newsletter|download|kontaktformular)\b/g) || []).length;
  if (!cleanTitle || cleanTitle.split(/\s+/).filter((word) => word.length > 2).length < 4) return false;
  if (text.length < 700) return false;
  if (sentences.length < 3) return false;
  if (serviceSignals >= editorialSignals + 2) return false;
  return editorialSignals >= 1 || sentences.length >= 5;
}

function hasGermanLanguageSignal(value = "") {
  const text = normalizeForSearch(value);
  const germanHits = (text.match(/\b(der|die|das|und|oder|fuer|fur|mit|von|zur|zum|eine|einer|unternehmen|medien|pressemitteilung|veroeffentlicht|kuenftig|deutschland|branche)\b/g) || []).length;
  const englishHits = (text.match(/\b(the|and|for|with|from|about|company|announces|published|available|download|media industry|press release)\b/g) || []).length;
  return germanHits >= 5 && germanHits >= englishHits;
}

function detectPressDate(html = "", fallback = "") {
  const direct = fallback || "";
  const candidates = [
    direct,
    String(html || "").match(/(?:article:published_time|datePublished|pubdate|publishdate|dc:date|date)["'\s:=]+([^"'<>\s]+)/i)?.[1] || "",
    String(html || "").match(/<time[^>]+datetime=["']([^"']+)["']/i)?.[1] || "",
    String(html || "").match(/\b(\d{1,2})\.(\d{1,2})\.(20\d{2})\b/)?.[0] || "",
    String(html || "").match(/\b(20\d{2})-(\d{2})-(\d{2})\b/)?.[0] || ""
  ].filter(Boolean);
  for (const candidate of candidates) {
    const dotted = String(candidate).match(/\b(\d{1,2})\.(\d{1,2})\.(20\d{2})\b/);
    if (dotted) return `${dotted[3]}-${String(dotted[2]).padStart(2, "0")}-${String(dotted[1]).padStart(2, "0")}`;
    const normalized = normalizeDate(candidate);
    if (/^20\d{2}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  }
  return "";
}

function dateWithinMonths(dateValue = "", months = 2) {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(String(dateValue || ""))) return false;
  const date = new Date(`${dateValue}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (date > today) return false;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - Math.max(1, Number(months || 2)));
  cutoff.setHours(0, 0, 0, 0);
  return date >= cutoff;
}

async function crawlPressReleasesForSource(source = {}, options = {}) {
  const months = Math.max(1, Math.min(12, Number(options.months || 2)));
  const seedUrls = sourceSeedUrls(source)
    .filter((url) => /(presse|press|newsroom|aktuelles|meldung|mitteilung|rss|feed|sitemap)/i.test(url))
    .slice(0, 8);
  const candidates = [];
  for (const url of seedUrls) {
    const text = await fetchText(url, 2200);
    if (!text) continue;
    if (/<(rss|feed|item|entry|urlset|sitemapindex)\b/i.test(text)) {
      candidates.push(...parseFeedItems(text, source));
      candidates.push(...parseSitemapUrls(text, source.url || url).map((item) => ({
        source_id: source.id || source.domain || source.name || "",
        source_name: source.name || source.domain || "",
        source_domain: source.domain || "",
        title: item.url.split("/").filter(Boolean).pop()?.replace(/[-_]/g, " ") || item.url,
        url: item.url,
        published_at: item.published_at,
        summary: ""
      })));
    } else {
      candidates.push(...parseHtmlCandidates(text, url, source));
    }
  }
  const seen = new Set();
  const releases = [];
  for (const candidate of candidates.filter(isPressReleaseCandidate).slice(0, 24)) {
    const key = String(candidate.url || "").toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const detailHtml = await fetchText(candidate.url, 2600);
    if (!detailHtml) continue;
    const title = importedPressTitle(detailHtml, candidate);
    const publishedAt = detectPressDate(detailHtml, candidate.published_at);
    if (!dateWithinMonths(publishedAt, months)) continue;
    const fullText = stripHtmlForFullText(detailHtml);
    if (!title || fullText.length < 450) continue;
    if (!isMeaningfulPressHeadline(title)) continue;
    if (!hasEditorialPressText(title, fullText)) continue;
    if (isEventPressRelease({ ...candidate, title, summary: fullText.slice(0, 1800), full_text: fullText.slice(0, 2500) })) continue;
    if (!isPressReleaseCandidate({ ...candidate, title, summary: fullText.slice(0, 1200) })) continue;
    if (looksMostlyEnglish(`${title} ${fullText.slice(0, 1200)}`) || !hasGermanLanguageSignal(fullText.slice(0, 2500))) continue;
    const cleanedFullText = cleanImportedPressText(fullText);
    releases.push({
      id: pressReleaseDocId(candidate.url, title),
      source_id: source.id || source.domain || source.name || "",
      source_name: source.name || source.domain || "",
      source_domain: source.domain || "",
      source_url: source.url || "",
      title: title.slice(0, 240),
      url: candidate.url,
      published_at: publishedAt,
      imported_at: new Date().toISOString(),
      import_status: "importiert",
      language: "de",
      full_text: cleanedFullText.slice(0, 30000),
      text_length: cleanedFullText.length,
      summary: pressSummaryFromText(title, cleanedFullText)
    });
    if (releases.length >= Number(options.perSourceLimit || 4)) break;
  }
  return releases;
}

exports.importGermanPressReleases = onCall({ region, timeoutSeconds: 600, memory: "1GiB" }, async (request) => {
  const { profile } = await requireAiAccess(request);
  const months = Math.max(1, Math.min(12, Number(request.data?.months || 2)));
  const perSourceLimit = Math.max(1, Math.min(10, Number(request.data?.perSourceLimit || 4)));
  const runId = String(request.data?.runId || db.collection("ai_press_import_runs").doc().id).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || db.collection("ai_press_import_runs").doc().id;
  const now = new Date();
  const [sourceSnapshot, statusSnapshot] = await Promise.all([
    db.collection("verified_sources").get(),
    db.collection("ai_press_source_status").get()
  ]);
  const sourceStatuses = new Map(statusSnapshot.docs.map((doc) => [pressSourceKey(doc.data()), { id: doc.id, ...(doc.data() || {}) }]));
  const allSources = uniqueSourceList([
    ...sourceSnapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) })),
    ...aiSourceCatalog
  ])
    .filter((source) => !sourceIsExcluded(source))
    .filter((source) => sourceIsGerman(source))
    .filter((source) => !String(source.source_status || source.sourceStatus || "").toLowerCase().includes("gesperrt"))
    .filter((source) => Number(source.trust_score || source.suggested_trust_score || 0) >= 70);
  const skippedSources = [];
  const sources = allSources.filter((source) => {
    const status = sourceStatuses.get(pressSourceKey(source));
    if (!shouldSkipPressSource(status, now)) return true;
    skippedSources.push({
      source_id: source.id || source.domain || source.name || "",
      source_name: source.name || source.domain || "",
      source_domain: source.domain || "",
      count: 0,
      status: "ausgelassen",
      reason: `Nach ${Number(status.consecutive_empty_scans || 0)} erfolglosen Scans bis ${String(status.skip_until || "").slice(0, 10)} pausiert.`
    });
    return false;
  });
  const runRef = db.collection("ai_press_import_runs").doc(runId);
  await runRef.set({
    id: runId,
    status: "running",
    message: "Presseimport gestartet.",
    total_sources: allSources.length,
    planned_sources: sources.length,
    skipped_sources: skippedSources.length,
    scanned_sources: 0,
    imported: 0,
    months,
    per_source_limit: perSourceLimit,
    scans: skippedSources,
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    createdBy: profile.uid
  }, { merge: true });
  const imported = [];
  const scans = [...skippedSources];
  const duplicateReleases = [];
  const batchSize = 5;
  for (let index = 0; index < sources.length; index += batchSize) {
    const batch = sources.slice(index, index + batchSize);
    const results = await Promise.all(batch.map((source) => crawlPressReleasesForSource(source, { months, perSourceLimit })));
    const statusBatch = db.batch();
    batch.forEach((source, sourceIndex) => {
      const releases = results[sourceIndex] || [];
      const sourceKey = pressSourceKey(source);
      const previousStatus = sourceStatuses.get(sourceKey) || {};
      const emptyScans = releases.length ? 0 : Number(previousStatus.consecutive_empty_scans || 0) + 1;
      const statusRef = db.collection("ai_press_source_status").doc(previousStatus.id || pressSourceStatusDocId(source));
      const scan = {
        source_id: source.id || source.domain || source.name || "",
        source_name: source.name || source.domain || "",
        source_domain: source.domain || "",
        count: releases.length,
        status: releases.length ? "gefunden" : emptyScans >= 3 ? "pausiert" : "keine aktuellen Treffer",
        reason: releases.length
          ? `${releases.length} aktuelle Pressemitteilung${releases.length === 1 ? "" : "en"} gefunden.`
          : emptyScans >= 3
            ? "Drei Scans ohne aktuelle deutsche Pressemitteilung; Quelle wird zeitweise ausgespart."
            : "Keine aktuelle deutsche Pressemitteilung in diesem Lauf."
      };
      scans.push(scan);
      statusBatch.set(statusRef, {
        id: statusRef.id,
        source_id: source.id || "",
        source_name: source.name || source.domain || "",
        source_domain: source.domain || "",
        source_url: source.url || "",
        source_key: sourceKey,
        last_scan_at: new Date().toISOString(),
        last_success_at: releases.length ? new Date().toISOString() : previousStatus.last_success_at || "",
        last_result_count: releases.length,
        consecutive_empty_scans: emptyScans,
        skip_until: emptyScans >= 3 ? futureIsoDate(14) : "",
        status: releases.length ? "aktiv" : emptyScans >= 3 ? "pausiert" : "beobachten",
        reason: scan.reason,
        updated_at: new Date().toISOString()
      }, { merge: true });
      imported.push(...releases);
    });
    await statusBatch.commit();
    await runRef.set({
      status: "running",
      message: `${Math.min(index + batch.length, sources.length)} von ${sources.length} Portalen geprueft.`,
      scanned_sources: Math.min(index + batch.length, sources.length),
      imported: imported.length,
      scans: scans.slice(-120),
      updated_at: new Date().toISOString()
    }, { merge: true });
  }
  const existingPressSnapshot = await db.collection("ai_press_releases").get();
  const existingUrlKeys = new Map();
  const existingTitleKeys = new Map();
  existingPressSnapshot.docs.forEach((doc) => {
    const data = doc.data() || {};
    const urlKey = pressUrlKey(data.url);
    const titleKey = pressDuplicateTitleKey(data.title);
    if (urlKey) existingUrlKeys.set(urlKey, doc.id);
    if (titleKey) existingTitleKeys.set(titleKey, doc.id);
  });
  const unique = [];
  const seenUrls = new Set();
  const seenTitles = new Set();
  imported.sort((a, b) => String(b.published_at || "").localeCompare(String(a.published_at || ""))).forEach((release) => {
    const urlKey = pressUrlKey(release.url);
    const titleKey = pressDuplicateTitleKey(release.title);
    const duplicateOf = existingUrlKeys.get(urlKey) || existingTitleKeys.get(titleKey) || "";
    if ((urlKey && seenUrls.has(urlKey)) || (titleKey && seenTitles.has(titleKey)) || duplicateOf) {
      duplicateReleases.push({
        ...release,
        duplicate_status: duplicateOf ? "Dublette zu bestehender Pressemitteilung" : "Dublette im aktuellen Lauf",
        duplicate_of: duplicateOf
      });
      return;
    }
    if (urlKey) seenUrls.add(urlKey);
    if (titleKey) seenTitles.add(titleKey);
    unique.push(release);
  });
  const writeBatchSize = 400;
  for (let index = 0; index < unique.length; index += writeBatchSize) {
    const batch = db.batch();
    unique.slice(index, index + writeBatchSize).forEach((release) => {
      batch.set(db.collection("ai_press_releases").doc(release.id), {
        ...release,
        editorial_status: "neu",
        review_status: "nicht geprueft",
        duplicate_status: "keine Dublette",
        duplicate_checked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        imported_by: profile.email || profile.uid || "system"
      }, { merge: true });
    });
    await batch.commit();
  }
  await runRef.set({
    status: unique.length ? "imported" : "blocked",
    message: unique.length
      ? `${unique.length} Pressemitteilungen in eigener Presseliste importiert.`
      : "Keine passenden aktuellen Pressemitteilungen gefunden.",
    scanned_sources: sources.length,
    imported: unique.length,
    duplicates: duplicateReleases.length,
    scans: scans.slice(-120),
    finished_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }, { merge: true });
  await db.collection("ai_editorial_logs").add({
    article_id: "",
    task_name: "KI_Redaktion_Presseimport",
    status: unique.length ? "imported" : "blocked",
    message: unique.length
      ? `${unique.length} Pressemitteilungen aus deutschen Quellen importiert, nicht aelter als ${months} Monate.`
      : `Keine Pressemitteilungen gefunden, die nicht aelter als ${months} Monate sind.`,
    found_topics_json: [],
    rejected_topics_json: [],
    used_sources_json: scans,
    source_check_json: { sources: sources.length, skipped_sources: skippedSources.length, months, perSourceLimit, run_id: runId },
    duplicate_check_json: { duplicates: duplicateReleases.length, duplicate_releases: duplicateReleases.slice(0, 50) },
    keyword_result_json: {},
    ai_check_json: { status: "Presseimport", publication_status: "nicht freigegeben" },
    error_json: {},
    created_at: FieldValue.serverTimestamp()
  });
  return {
    ok: unique.length > 0,
    imported: unique.length,
    duplicates: duplicateReleases.length,
    articles: 0,
    sources: sources.length,
    skippedSources: skippedSources.length,
    runId,
    scans,
    releases: unique.slice(0, 50),
    duplicateReleases: duplicateReleases.slice(0, 50),
    message: unique.length
      ? `${unique.length} Pressemitteilungen wurden einzeln und mit Volltext in die Presseliste importiert.${duplicateReleases.length ? ` ${duplicateReleases.length} Dublette${duplicateReleases.length === 1 ? "" : "n"} ausgelassen.` : ""}`
      : "Keine passenden aktuellen Pressemitteilungen gefunden."
  };
});

exports.generateAiEditorialTopicSuggestions = onCall({ region, secrets: [openAiApiKey], timeoutSeconds: 600, memory: "1GiB" }, async (request) => {
  const payload = request.data || {};
  const { profile, settings } = await requireAiAccess(request);
  const key = openAiApiKey.value() || process.env.OPENAI_API_KEY;
  const limit = Math.max(1, Math.min(10, Number(payload.limit || 10)));
  const category = String(payload.category || "").trim();
  const keywords = String(payload.keywords || "").trim();
  const sourceFilter = String(payload.sourceId || payload.source_id || "").trim().toLowerCase();
  const [sourceSnapshot, existingSuggestionsSnapshot] = await Promise.all([
    db.collection("verified_sources").get(),
    db.collection("ai_topic_suggestions").get()
  ]);
  const verifiedSources = uniqueSourceList([
    ...sourceSnapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) })),
    ...aiSourceCatalog
  ]);
  const filteredSources = sourceFilter
    ? verifiedSources.filter((source) => [source.id, source.domain, source.url, source.name, source.title].some((value) => String(value || "").trim().toLowerCase() === sourceFilter))
    : verifiedSources;
  const existingSuggestionRecords = existingSuggestionsSnapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
  const maxLiveSources = sourceFilter ? 1 : category ? filteredSources.length : 60;
  const researchSources = selectResearchSources(filteredSources, existingSuggestionRecords, category, keywords, Math.min(filteredSources.length || maxLiveSources, maxLiveSources));
  if ((category || sourceFilter) && !researchSources.length) {
    throw new HttpsError("failed-precondition", `Keine verifizierten Quellen fuer diese Auswahl gefunden. Bitte Quellenliste oder Filter pruefen.`);
  }
  const logRef = db.collection("ai_editorial_logs").doc();
  const crawlResult = await crawlResearchPublications(researchSources, {
    sourceTimeoutMs: 45000,
    onBatch: async ({ scans, publications }) => {
      await Promise.all([
        writeRawSourceScans({ runId: logRef.id, scans, category, keywords, profile }),
        writeRawTopicPublications({ runId: logRef.id, publications, category, keywords, profile })
      ]);
    }
  });
  const sourcePublications = crawlResult.publications;
  const researchSourceSummary = researchSources.map((source) => ({
    id: source.id,
    name: source.name,
    domain: source.domain,
    source_type: source.source_type,
    trust_score: source.trust_score,
    categories: source.categories
  }));
  await writeRawSourceScans({ runId: logRef.id, scans: crawlResult.sourceScans, category, keywords, profile });
  await writeRawTopicPublications({ runId: logRef.id, publications: sourcePublications, category, keywords, profile });
  const prompt = [
    `Erzeuge fuer die PROdigitalTV KI-Redaktion bis zu ${limit} redaktionelle Nachrichtenthemen fuer die Themenliste, aber nur wenn sie belastbar sind.`,
    "Strategie: Dies ist Stufe 1. Es entstehen keine fertigen Artikel. Die Ausgabe ist eine redaktionelle Auswahl echter aktueller Nachrichtenfunde. Der vollstaendige Beitrag wird erst in Stufe 2 nach manueller Auswahl im Editor erzeugt.",
    "Wenn aus den Quellen nur wenige ausreichend belegbare aktuelle Nachrichtenthemen ableitbar sind, liefere wenige. Keine Luecken mit schwachen, generischen oder technischen Crawler-Funden auffuellen.",
    "Nutze ausschliesslich deutsche oder deutschsprachige Quellen. Keine franzoesischen, britischen, US-amerikanischen oder rein internationalen Quellen als Themenbasis verwenden.",
    "Alle sichtbaren redaktionellen Felder muessen deutsch sein: title, headline, subline, teaser, category, keywords, thumbnail_idea, reason und source_status. Wenn eine Quelle englisch ist, uebersetze die Themenformulierung sinngemaess ins Deutsche. Der Originaltitel darf nur als Quellenhinweis oder note erhalten bleiben.",
    "Headline: kurze journalistische Ueberschrift zur Nachricht. Subline: ein kurzer erklaerender Satz. Teaser: 1 bis 2 Saetze zum Nachrichteninhalt selbst: Was ist passiert und warum ist es fuer die Medienbranche relevant?",
    "Keine Meta-Sprache in title, headline, subline oder teaser: nicht 'Themenkandidat', nicht 'Vorschlag', nicht 'redaktionell pruefen', nicht 'Quellenfund', nicht erklaeren wie der Fund entstanden ist.",
    "Die Nachrichtenthemen muessen aus den unten gelieferten Quellenveroeffentlichungen abgeleitet werden. Wenn keine passende Veroeffentlichung vorhanden ist, markiere source_status als 'Quellenlage unzureichend' und erzeuge keinen scheinbar aktuellen Listeneintrag.",
    "Wenn eine Quelle in der bisherigen Themenliste bereits ein Thema geliefert hat, soll der naechste Vorschlag bevorzugt aus einer anderen Quelle kommen. Maximal ein Vorschlag pro primary_source_id.",
    "Die Vorschlaege sollen fuer TV, Streaming, Digitalmedien, Medienrecht, Produktion, KI, Distribution, Vermarktung, HbbTV, OTT, FAST-Channels, Barrierefreiheit oder Plattformregulierung geeignet sein.",
    "Keine Boulevardmeldungen, keine reinen Personenmeldungen, keine Programmhinweise, keine Navigationstexte, keine Sitemaps, keine Presseportal-Startseiten, keine generischen Quellenbeschreibungen.",
    category ? `Lenke die Recherche auf die Kategorie: ${category}` : "Nutze eine ausgewogene Rotation ueber die relevanten Themenbereiche.",
    keywords ? `Beruecksichtige diese Stichworte: ${keywords}` : "",
    `Quellen fuer diese Recherche (${researchSources.length} geplant, ${crawlResult.researchedSources} abgearbeitet): ${JSON.stringify(researchSourceSummary)}`,
    `Gefundene Quellenveroeffentlichungen mit Datum: ${JSON.stringify(sourcePublications)}`,
    "Keine konkreten Zahlen, Studien, URLs, Zitate oder tagesaktuellen Fakten erfinden. Wenn ein Thema Quellenrecherche braucht, markiere source_status als 'Recherche erforderlich'.",
    "Nenne pro Thema mindestens eine Hauptquelle als primary_source_id und bis zu 4 plausible Quellenkandidaten als source_candidates mit id, name, publisher, url falls sicher bekannt, und kurzer note. Eine valide Quelle reicht fuer die Themenliste. Erfinde keine URLs. Wenn keine sichere URL bekannt ist, lasse url leer.",
    "Wenn ein Vorschlag auf einer konkreten Veroeffentlichung der Quelle basiert, gib source_publication_date an. Wenn das Datum unbekannt ist, lasse source_publication_date leer und setze source_date_status auf 'Datum nicht ermittelt'.",
    "Bewerte Aktualitaet, Branchenrelevanz und Gesamt-Relevanz jeweils von 0 bis 100.",
    `Antworte ausschliesslich als valides JSON-Objekt mit dem Feld suggestions. suggestions ist ein Array mit maximal ${limit} Objekten mit: title, headline, subline, teaser, category, keywords, thumbnail_idea, actuality_score, industry_score, relevance_score, source_status, reason, possible_sources, source_candidates, primary_source_id, source_ids, source_names, source_publication_date, source_date_status.`
  ].filter(Boolean).join("\n\n");
  let rawSuggestions = [];
  let fallbackReason = "";
  if (key) {
    const aiController = new AbortController();
    const aiTimeout = setTimeout(() => aiController.abort(), 120000);
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        signal: aiController.signal,
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: settings.model || "gpt-4.1-mini",
          temperature: Number(settings.temperature ?? 0.3),
          max_output_tokens: 3600,
          text: { format: { type: "json_object" } },
          input: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt }
          ]
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "OpenAI API Fehler bei der Themenrecherche.");
      const text = data.output_text || data.output?.flatMap((item) => item.content || []).map((item) => item.text).filter(Boolean).join("\n") || "";
      const parsed = JSON.parse(text);
      rawSuggestions = safeArray(parsed.suggestions).slice(0, limit);
      if (!rawSuggestions.length) throw new Error("OpenAI hat keine Themenvorschlaege geliefert.");
    } catch (error) {
      fallbackReason = error.message || String(error);
    } finally {
      clearTimeout(aiTimeout);
    }
  } else {
    fallbackReason = "OPENAI_API_KEY ist nicht gesetzt.";
  }
  let rejectedQualitySuggestions = [];
  rawSuggestions = uniqueRawTopicSuggestions(rawSuggestions, limit);
  if (rawSuggestions.length) {
    const quality = qualityFilterTopicSuggestions(rawSuggestions, { category, keywords }, limit);
    rawSuggestions = quality.accepted;
    rejectedQualitySuggestions = rejectedQualitySuggestions.concat(quality.rejected);
  }
  if (!rawSuggestions.length) {
    const fallbackSuggestions = uniqueRawTopicSuggestions(fallbackTopicSuggestionsFromPublications(sourcePublications, { category, keywords }, limit), limit);
    const quality = qualityFilterTopicSuggestions(fallbackSuggestions, { category, keywords }, limit);
    rawSuggestions = quality.accepted;
    rejectedQualitySuggestions = rejectedQualitySuggestions.concat(quality.rejected);
    if (rawSuggestions.length) fallbackReason = fallbackReason || "KI-Auswertung ohne Ergebnis; Themenliste aus echten Quellenfunden erzeugt.";
  }
  if (!rawSuggestions.length) {
    const emptyBatch = db.batch();
    emptyBatch.set(logRef, {
      article_id: "",
      task_name: "KI_Redaktion_Themenrecherche",
      status: "blocked",
      message: `Keine belastbaren Themenvorschlaege erstellt. ${crawlResult.researchedSources} von ${crawlResult.totalSources} Quellen abgearbeitet, ${sourcePublications.length} Raw-Funde gespeichert. ${fallbackReason ? `Grund: ${fallbackReason}` : "Die Quellenfunde reichen nicht fuer eine echte Nachricht."}`,
      found_topics_json: [],
      rejected_topics_json: rejectedQualitySuggestions.length ? rejectedQualitySuggestions : [{ reason: "Keine echte Nachricht aus Quellenfunden ableitbar" }],
      used_sources_json: researchSourceSummary,
      source_check_json: { source_status: "Rawdaten gespeichert, aber kein Themenvorschlag", researched_sources: crawlResult.researchedSources, total_sources: crawlResult.totalSources, found_publications: sourcePublications.length, stopped_by_time_budget: crawlResult.stoppedByTimeBudget },
      duplicate_check_json: {},
      keyword_result_json: {},
      ai_check_json: { status: "nicht bestanden", publication_status: "nicht freigegeben" },
      error_json: fallbackReason ? { message: fallbackReason } : {},
      created_at: new Date().toISOString(),
      createdAt: FieldValue.serverTimestamp(),
      createdBy: profile.uid
    }, { merge: true });
    await emptyBatch.commit();
    await writeAiLog({ profile, settings, action: "generateAiEditorialTopicSuggestions", payload, result: { suggestions: [], researchedSources: crawlResult.researchedSources, totalSources: crawlResult.totalSources, sourcePublications: sourcePublications.length, stoppedByTimeBudget: crawlResult.stoppedByTimeBudget, fallbackReason }, status: "blocked" }).catch(() => {});
    return {
      ok: false,
      suggestions: [],
      researchedSources: crawlResult.researchedSources,
      totalSources: crawlResult.totalSources,
      sourcePublications: sourcePublications.length,
      stoppedByTimeBudget: crawlResult.stoppedByTimeBudget,
      fallbackReason,
      message: `Rawdaten wurden gespeichert, aber es wurde kein echter Nachrichten-Themenvorschlag erzeugt. ${crawlResult.researchedSources} von ${crawlResult.totalSources} Quellen abgearbeitet.`
    };
  }
  const suggestions = rawSuggestions.map((item, index) => normalizeTopicSuggestion(item, index, { category, keywords }));
  const batch = db.batch();
  suggestions.forEach((suggestion, index) => {
    const ref = db.collection("ai_topic_suggestions").doc(suggestion.id);
    batch.set(ref, { ...suggestion, rank: index + 1, createdBy: profile.uid, updatedBy: profile.uid }, { merge: true });
  });
  await writeRawSourceScans({ runId: logRef.id, scans: crawlResult.sourceScans, category, keywords, profile, suggestions });
  await writeRawTopicPublications({ runId: logRef.id, publications: sourcePublications, category, keywords, profile, suggestions });
  batch.set(logRef, {
    article_id: "",
    task_name: "KI_Redaktion_Themenrecherche",
    status: fallbackReason ? "warning" : "suggested",
    message: `${suggestions.length} qualitaetsgepruefte KI-Themenvorschlaege erstellt${category || keywords || sourceFilter ? ` fuer ${[category, sourceFilter, keywords].filter(Boolean).join(" / ")}` : ""}. ${crawlResult.researchedSources} von ${crawlResult.totalSources} Quellen abgearbeitet.${rejectedQualitySuggestions.length ? ` ${rejectedQualitySuggestions.length} Rohfunde verworfen.` : ""}${fallbackReason ? ` Fallback genutzt: ${fallbackReason}` : ""}`,
    found_topics_json: suggestions,
    rejected_topics_json: rejectedQualitySuggestions,
    used_sources_json: researchSourceSummary,
    source_check_json: { source_status: "Recherche nach Auswahl erforderlich", researched_sources: crawlResult.researchedSources, total_sources: crawlResult.totalSources, found_publications: sourcePublications.length, stopped_by_time_budget: crawlResult.stoppedByTimeBudget },
    duplicate_check_json: {},
    keyword_result_json: {},
    ai_check_json: { status: "Vorschlag", publication_status: "nicht freigegeben" },
    error_json: {},
    created_at: new Date().toISOString(),
    createdAt: FieldValue.serverTimestamp(),
    createdBy: profile.uid
  });
  await batch.commit();
  await writeAiLog({ profile, settings, action: "generateAiEditorialTopicSuggestions", payload, result: { suggestions, rejectedQualitySuggestions, researchedSources: crawlResult.researchedSources, totalSources: crawlResult.totalSources, sourcePublications: sourcePublications.length, stoppedByTimeBudget: crawlResult.stoppedByTimeBudget, fallbackReason }, status: fallbackReason ? "warning" : "success" }).catch(() => {});
  return { ok: true, suggestions, rejectedQualitySuggestions, researchedSources: crawlResult.researchedSources, totalSources: crawlResult.totalSources, sourcePublications: sourcePublications.length, stoppedByTimeBudget: crawlResult.stoppedByTimeBudget, fallbackReason, message: `${suggestions.length} Themenvorschlag${suggestions.length === 1 ? "" : "e"} wurden qualitaetsgeprueft erstellt. ${crawlResult.researchedSources} von ${crawlResult.totalSources} Quellen wurden abgearbeitet, ${sourcePublications.length} Veroeffentlichungen als Rawdaten gespeichert.${rejectedQualitySuggestions.length ? ` ${rejectedQualitySuggestions.length} Rohfund${rejectedQualitySuggestions.length === 1 ? "" : "e"} wegen Qualitaet verworfen.` : ""}${fallbackReason ? " KI-Auswertung abgebrochen; sichere Fallback-Themen aus Rawdaten genutzt." : ""}${crawlResult.stoppedByTimeBudget ? " Zeitbudget erreicht; weitere Quellen folgen im naechsten Lauf." : ""}` };
});

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
exports.rewritePressRetrospective = callable("rewritePressRetrospective");
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
