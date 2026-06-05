import { route, onRouteChange, go } from "./utils/router.js";
import {
  homePage, eventsPage, eventDetailPage, registrationPage, topicsPage, topicDetailPage,
  newsPage, newsDetailPage, aboutPage, membersPage, boardPage, archivePage, downloadsPage, joinPage, loginPage, portalPage, legalPage, notFoundPage
} from "./pages/publicPages.js";
import {
  dashboardPage, eventsAdminPage, eventFollowUpPage, eventEditPage, registrationsPage, moduleListPage, contentEditPage, setupPage, chatGptPage, aiSettingsPage
} from "./cms/cmsPages.js?v=253";
import { aiEditorialPage } from "./cms/aiEditorialPages.js?v=253";
import { createRegistration } from "./firebase/registrationService.js";
import { currentUser, login, loginWithGoogle, logout, refreshAuthToken, waitForAuthReady } from "./firebase/authService.js?v=253";
import { getOne, list, upsert, remove } from "./firebase/dataService.js?v=253";
import { deleteStoredAsset, uploadEntityImage, uploadEventMedia, uploadGalleryImages } from "./firebase/storageService.js";
import { checkFirebaseConnection, checkFirestoreStructure, initializeDatabase, createDemoData, removeDemoData } from "./firebase/setupService.js";
import { downloadRegistrationsCsv } from "./utils/csv.js";
import { escapeHtml } from "./utils/format.js";
import { callChatGptAction, generateCmsThumbCollage, saveAiDraft, runAiEditorialTask, saveAiEditorialSettings, generateAiEditorialThumbnail, generateAiTopicSuggestions } from "./ai/openaiService.js?v=253";
import { generateArticleSpeechAsset } from "./ai/ttsService.js";

const root = document.querySelector("#app");
const mobilePublicOrigin = "https://prodigitaltv-da47b.web.app";
const defaultAiEditorialThumbnailPrompt = "Fotorealistisches redaktionelles 16:9-Vorschaubild fuer PROdigitalTV: serioeser moderner Business-Look, TV-, Streaming- und digitale Medienbranche, klare Komposition, natuerliches Licht, keine echten Logos, keine realen Personen, keine Comic-Optik, keine irrefuehrenden Bildinhalte.";

async function viewForRoute(current) {
  if (current.path === "home") return homePage();
  if (current.path === "events") return eventsPage();
  if (current.path === "event") return eventDetailPage(current.id);
  if (current.path === "register") return registrationPage(current.id);
  if (current.path === "topics") return topicsPage();
  if (current.path === "topic") return topicDetailPage(current.id);
  if (current.path === "news" && current.id) return newsDetailPage(current.id);
  if (current.path === "news") return newsPage();
  if (current.path === "retrospective" && current.id) return newsDetailPage(current.id);
  if (current.path === "about") return aboutPage();
  if (current.path === "board") return boardPage();
  if (current.path === "members") return membersPage();
  if (current.path === "join") return joinPage();
  if (current.path === "downloads") return downloadsPage();
  if (current.path === "archive") return archivePage();
  if (current.path === "login") return loginPage();
  if (current.path === "portal") return portalPage();
  if (current.path === "imprint") return legalPage("imprint");
  if (current.path === "privacy") return legalPage("privacy");
  if (current.path === "cms" && !current.id) return dashboardPage();
  if (current.path === "cms" && current.id === "events") return eventsAdminPage();
  if (current.path === "cms" && current.id === "event") return eventEditPage(current.section, current.query.get("tab") || "base", current.query);
  if (current.path === "cms" && current.id === "registrations") return registrationsPage();
  if (current.path === "cms" && ["followup", "media"].includes(current.id)) return eventFollowUpPage();
  if (current.path === "cms" && current.id === "topics") return moduleListPage("topics");
  if (current.path === "cms" && current.id === "galleries") return moduleListPage("galleries");
  if (current.path === "cms" && current.id === "speakers") return moduleListPage("speakers");
  if (current.path === "cms" && current.id === "sponsors") return moduleListPage("sponsors");
  if (current.path === "cms" && current.id === "members") return moduleListPage("members");
  if (current.path === "cms" && current.id === "membership-applications") return moduleListPage("membershipApplications");
  if (current.path === "cms" && current.id === "board") return moduleListPage("boardMembers");
  if (current.path === "cms" && current.id === "editorial") return moduleListPage("editorialContent", current.section || "press");
  if (current.path === "cms" && current.id === "ai-editorial") return aiEditorialPage(current.section || "dashboard", current.query);
  if (current.path === "cms" && current.id === "mail") return moduleListPage("mailQueue");
  if (current.path === "cms" && current.id === "chatgpt") return chatGptPage();
  if (current.path === "cms" && current.id === "ai-settings") return aiSettingsPage();
  if (current.path === "cms" && current.id === "edit") return contentEditPage(current.query.get("module"), current.query.get("id"), current.query);
  if (current.path === "cms" && current.id === "setup") return setupPage();
  return notFoundPage();
}

async function render() {
  try {
    if (root && !root.innerHTML) {
      root.innerHTML = `<section class="login-wrap"><div class="form-card login-card"><p class="eyebrow">CMS</p><h1>Lade Inhalte ...</h1></div></section>`;
    }
    root.innerHTML = await viewForRoute(route());
    wireActions();
    updateMobileQrCode();
    window.scrollTo({ top: 0 });
  } catch (error) {
    console.error(error);
    root.innerHTML = `<section class="login-wrap"><div class="form-card login-card"><p class="eyebrow">Seite konnte nicht geladen werden</p><h1>Bitte neu laden</h1><p style="margin:14px 0 24px">${escapeHtml(error.message || String(error))}</p><a class="button button--primary" href="#/login">Zum Login</a></div></section>`;
  }
}

function mobileUrlForCurrentRoute() {
  const current = route();
  const query = current.query;
  let hash = location.hash || "#/home";
  let path = location.pathname || "/";
  if (current.path === "cms") {
    path = "/";
    if (current.id === "events") hash = "#/events";
    else if (current.id === "event" && current.section) hash = `#/event/${current.section}`;
    else if (current.id === "topics") hash = "#/topics";
    else if (current.id === "members") hash = "#/members";
    else if (current.id === "board") hash = "#/board";
    else if (current.id === "editorial" && current.section === "news") hash = "#/news";
    else if (current.id === "edit" && query.get("module") === "topics" && query.get("id")) hash = `#/topic/${query.get("id")}`;
    else if (current.id === "edit" && query.get("module") === "editorialContent" && query.get("section") === "news" && query.get("id")) hash = `#/news/${query.get("id")}`;
    else hash = "#/home";
  }
  const search = location.search || "";
  const origin = ["localhost", "127.0.0.1", ""].includes(location.hostname) || location.protocol === "file:"
    ? mobilePublicOrigin
    : location.origin;
  return `${origin}${path}${search}${hash}`;
}

function updateMobileQrCode() {
  const link = document.querySelector("[data-mobile-qr-link]");
  const image = document.querySelector("[data-mobile-qr-code]");
  if (!link || !image) return;
  const mobileUrl = mobileUrlForCurrentRoute();
  link.href = mobileUrl;
  link.title = mobileUrl;
  image.src = `https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=1&data=${encodeURIComponent(mobileUrl)}`;
}

document.addEventListener("click", (event) => {
  const link = event.target.closest('a[href^="#/"]');
  if (!link) return;
  window.setTimeout(render, 0);
});

function formObject(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  form.querySelectorAll('input[type="checkbox"]').forEach((item) => {
    data[item.name] = item.checked;
  });
  return data;
}

function isProtectedInternalEditorialRecord(collection, record = {}) {
  if (collection !== "editorialContent") return false;
  if (record.section === "download" || String(record.migratedTo || "").startsWith("downloads/")) return false;
  if (["press", "news"].includes(record.page) || ["pressRelease", "news"].includes(record.section)) return false;
  return ["home", "about", "join", "imprint", "privacy", "legal", "contact", "login", "members", "board"].includes(record.page)
    || ["intro", "hero", "legal", "internal", "footer"].includes(record.section);
}

function dataUrlToFile(dataUrl, fileName) {
  if (!dataUrl?.startsWith("data:image/")) return null;
  const [header, data] = dataUrl.split(",");
  const mime = header.match(/data:(.*?);base64/)?.[1] || "image/jpeg";
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new File([bytes], fileName, { type: mime });
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener("error", () => reject(new Error("Bilddaten konnten nicht geladen werden.")), { once: true });
    image.src = dataUrl;
  });
}

async function generatedThumbToJpeg(dataUrl, fileName, size = { width: 1200, height: 675 }) {
  const image = await loadImageFromDataUrl(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = size.width || 1200;
  canvas.height = size.height || 675;
  const context = canvas.getContext("2d");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const scale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  context.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
  if (!blob) throw new Error("KI-Bild konnte nicht komprimiert werden.");
  const safeName = String(fileName || "ki-collage.jpg").replace(/\.[^.]+$/, "") + `-${canvas.width}x${canvas.height}.jpg`;
  return {
    file: new File([blob], safeName, { type: "image/jpeg" }),
    dataUrl: canvas.toDataURL("image/jpeg", 0.82)
  };
}

function fileToInput(input, file) {
  const transfer = new DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
}

function filesToInput(input, files) {
  if (!input) return;
  const transfer = new DataTransfer();
  files.forEach((file) => transfer.items.add(file));
  input.files = transfer.files;
}

function imageFileFromDropzone(form, inputName, entityId) {
  const input = form.querySelector(`input[name="${inputName}"]`);
  const file = input?.files?.[0];
  if (file) return file;
  const dataUrl = form.elements[`${inputName}DataUrl`]?.value;
  const fileName = form.elements[`${inputName}FileName`]?.value || `${entityId || "image"}-240x180.jpg`;
  return dataUrlToFile(dataUrl, fileName);
}

function findAiSource(button) {
  const form = button.closest("form") || document;
  const target = button.dataset.aiTarget;
  const field = form.querySelector(`[name="${target}"]`) || document.getElementById(target);
  if (!field) return { text: "", field: null };
  return { text: field.value ?? field.textContent ?? "", field };
}

function eventContext(button) {
  const form = button.closest("form");
  const formValues = form ? formObject(form) : {};
  const linkedEventOption = form?.elements.linkedEventId?.selectedOptions?.[0]?.textContent || "";
  const sponsorOption = form?.elements.sponsorId?.selectedOptions?.[0]?.textContent || "";
  const hiddenContext = document.getElementById(button.dataset.aiTarget)?.textContent;
  let parsedContext = {};
  if (hiddenContext) {
    try { parsedContext = JSON.parse(hiddenContext); } catch { parsedContext = { notes: hiddenContext }; }
  }
  return {
    ...parsedContext,
    ...formValues,
    linkedEventLabel: linkedEventOption,
    sponsorLabel: sponsorOption,
    placeholders: ["{{firstName}}", "{{lastName}}", "{{eventTitle}}", "{{eventDate}}", "{{eventLocation}}", "{{confirmationLink}}"]
  };
}

function imageGenerationContext(form) {
  const values = formObject(form);
  return {
    title: values.title || "",
    subtitle: values.subtitle || values.shortDescription || values.introText || "",
    bodyText: values.bodyText || values.longDescription || "",
    shortDescription: values.shortDescription || values.introText || "",
    category: values.category || "",
    module: form.dataset.module || (form.id === "topic-editor-form" ? "topics" : "editorialContent")
  };
}

function structuredToText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

function compactAiText(value = "", maxLength = 12000) {
  const clean = String(value || "").replace(/\r/g, "").trim();
  if (clean.length <= maxLength) return clean;
  const headLength = Math.floor(maxLength * 0.72);
  const tailLength = maxLength - headLength;
  return `${clean.slice(0, headLength).trim()}\n\n[Ausgangstext gekuerzt]\n\n${clean.slice(-tailLength).trim()}`;
}

const AI_FIELD_LIMITS = {
  title: 90,
  subtitle: 150,
  shortDescription: 180,
  introText: 220,
  seoTitle: 70,
  seoDescription: 160
};

function limitText(value = "", maxLength = 0) {
  const clean = String(value || "").replace(/\s+/g, " ").trim();
  if (!maxLength || clean.length <= maxLength) return clean;
  const clipped = clean.slice(0, maxLength + 1);
  const boundary = clipped.lastIndexOf(" ");
  return clipped.slice(0, boundary > Math.floor(maxLength * 0.65) ? boundary : maxLength).trim();
}

function parsePromptTestInput(raw = "") {
  if (!String(raw || "").trim()) {
    return {
      THEMA: "Barrierefreiheit in Streaming-Angeboten",
      KATEGORIE: "Barrierefreiheit",
      QUELLEN: "EU-Kommission; W3C; HbbTV Association",
      TEXTLAENGE: "250 bis 350 Woerter",
      SPRACHSTIL: "sachlich, klar, leicht verstaendlich",
      HEUTIGES_DATUM: new Date().toISOString().slice(0, 10)
    };
  }
  try {
    return JSON.parse(raw);
  } catch {
    return { FREITEXT: raw };
  }
}

function renderPromptPreview(promptText = "", input = {}) {
  return String(promptText || "").replace(/\{\{\s*([A-ZAEIOU_]+)\s*\}\}/gi, (match, key) => {
    const value = input[key] ?? input[key.toUpperCase()] ?? input[key.toLowerCase()];
    return value === undefined ? match : String(value);
  });
}

function evaluatePromptSafety(values = {}, testInput = {}) {
  const combined = `${values.system_instructions || ""}\n${values.prompt_text || ""}`.toLowerCase();
  const warnings = [];
  [
    ["quellen", "Quellenpflicht fehlt"],
    ["halluzination", "Halluzinationsschutz fehlt"],
    ["dubletten", "Dublettenpruefung fehlt"],
    ["beleg", "Belegstellenpflicht fehlt"]
  ].forEach(([needle, warning]) => {
    if (!combined.includes(needle)) warnings.push(warning);
  });
  if (Number(values.temperature || 0) > 0.4) warnings.push("Temperatur fuer Faktenaufgaben zu hoch");
  if (!String(values.output_format || "").trim()) warnings.push("Output-Format fehlt");
  if (!Object.keys(testInput || {}).length) warnings.push("Keine Testdaten erkannt");
  return warnings;
}

function promptTemplateChat(template = "") {
  const templates = {
    article_text: [
      "Redaktion: Wir brauchen einen Prompt fuer den Beitragstext.",
      "Der Text soll 250 bis 350 Woerter haben, sachlich sein und nur belegte Aussagen verwenden.",
      "Die KI muss Quellen, Belegstellen und Dublettenstatus beachten.",
      "Bitte Headline, Subline und klare Branchen-Einordnung vorbereiten."
    ].join("\n"),
    source_check: [
      "Redaktion: Erstelle einen Prompt fuer die Quellenpruefung.",
      "Der Prompt soll Domain, Herausgeber, Trust-Score, Quellentyp und belegte Aussage pruefen.",
      "Gesperrte oder ungepruefte Quellen duerfen keine automatische Veroeffentlichung erlauben."
    ].join("\n"),
    duplicate_check: [
      "Redaktion: Wir brauchen einen Prompt fuer die Dublettenpruefung.",
      "Vergleiche Headline, Subline, Kategorie, Tags, Kernthema, zentrale Aussagen, Quellen und Slug.",
      "Nur ein neuer belegbarer Blickwinkel darf als neuer Beitrag weiterlaufen."
    ].join("\n"),
    final_check: [
      "Redaktion: Erstelle einen Prompt fuer die Endpruefung.",
      "Der Prompt muss Halluzinationen, Quellenpflicht, Dubletten, Belegstellen, Rechtsrisiken und Pflichtfelder pruefen.",
      "Ausgabe bitte als JSON mit Status, Warnungen, Sperrgruenden und Freigabeempfehlung."
    ].join("\n"),
    thumbnail: [
      "Redaktion: Erstelle einen Prompt fuer eine Thumbnail-Idee.",
      "Das Bild soll serioes, modern und medienbranchenbezogen sein.",
      "Keine Logos, keine realen Personen ohne Rechteklaerung und keine irrefuehrenden Inhalte."
    ].join("\n"),
    thumbnail_generation: [
      "Redaktion: Erstelle einen Prompt fuer die Thumbnail-Erstellung.",
      "Die Bild-KI soll ein fotorealistisches oder serioes redaktionelles 16:9-Vorschaubild erzeugen.",
      "Keine echten Logos, keine realen Personen ohne Rechteklaerung, keine Comic-Optik und keine irrefuehrenden Bildinhalte.",
      "Der Prompt soll Motiv, Stil, Komposition, Licht und Ausschlussregeln klar enthalten.",
      `Default-Prompt, falls keine Details vorhanden sind: ${defaultAiEditorialThumbnailPrompt}`
    ].join("\n"),
    keywords: [
      "Redaktion: Erstelle einen Prompt fuer Keywords und Tags.",
      "Die KI soll Hauptkeyword, Nebenkeywords, Keyword-Typen und Relevanz-Scores erzeugen.",
      "Keywords unter Relevanz 50 sollen nicht automatisch gespeichert werden."
    ].join("\n"),
    seo: [
      "Redaktion: Erstelle einen Prompt fuer SEO-Daten.",
      "Die KI soll Slug, Meta-Titel, Meta-Beschreibung und SEO-Keywords vorbereiten.",
      "Die Angaben muessen sachlich bleiben und duerfen keine unbelegten Versprechen enthalten."
    ].join("\n")
  };
  return templates[template] || "";
}

function inferPromptTypeFromText(text = "") {
  const clean = String(text || "").toLowerCase();
  if (clean.includes("quelle")) return "Quellenpruefung";
  if (clean.includes("dublette") || clean.includes("doppelt")) return "Dublettenpruefung";
  if (clean.includes("headline")) return "Headline";
  if (clean.includes("subline") || clean.includes("thubline")) return "Subline / Thubline";
  if (clean.includes("thumbnail") && (clean.includes("erstell") || clean.includes("generier") || clean.includes("bild-ki") || clean.includes("bild ki"))) return "Thumbnail-Erstellung";
  if (clean.includes("thumbnail")) return clean.includes("prompt") ? "Thumbnail-Prompt" : "Thumbnail-Idee";
  if (clean.includes("keyword") || clean.includes("tag")) return "Keywords";
  if (clean.includes("seo")) return "SEO / Meta";
  if (clean.includes("sprachstil") || clean.includes("stil")) return "Sprachstil";
  if (clean.includes("endpruefung") || clean.includes("freigabe") || clean.includes("halluzination")) return "Endpruefung";
  if (clean.includes("themenbewertung") || clean.includes("bewertung")) return "Themenbewertung";
  if (clean.includes("thema")) return "Themenrecherche";
  return "Beitragstext";
}

function buildPromptFromSource(values = {}) {
  const source = [promptTemplateChat(values.prompt_chat_template), values.prompt_seed_text].filter(Boolean).join("\n\n").trim();
  const promptType = inferPromptTypeFromText(`${values.prompt_type || ""}\n${source}`);
  const name = `${promptType} - KI-Redaktion`;
  const description = limitText(`Aus einfacher Redaktionsvorgabe vorbereitet: ${source}`, 180);
  const systemInstructions = [
    "Du arbeitest fuer die KI-Redaktion von PROdigitalTV.",
    "Erfinde keine Fakten, Zahlen, Zitate, Quellen, URLs, Personen, Organisationen, Studien oder Rechtsstaende.",
    "Jede zentrale Aussage muss durch belastbare Quellen und Belegstellen gedeckt sein.",
    "Keine Veroeffentlichung bei Dubletten, ungeprueften Quellen, gesperrten Quellen oder unklarer Faktenlage.",
    "Schreibe sachlich, klar, journalistisch und leicht verstaendlich."
  ].join("\n");
  const promptText = [
    `Aufgabe: ${source || "Fuehre den angeforderten redaktionellen Pruef- oder Erzeugungsschritt aus."}`,
    "",
    "Nutze ausschliesslich diese CMS-Daten:",
    "- Thema: {{THEMA}}",
    "- Kategorie: {{KATEGORIE}}",
    "- Quellen: {{QUELLEN}}",
    "- Bestehende Beitraege / Dublettenliste: {{DUBLETTENLISTE}}",
    "- Quellenstatus: {{QUELLENSTATUS}}",
    "- Beitragstext: {{BEITRAGSTEXT}}",
    "- Headline: {{HEADLINE}}",
    "- Subline: {{SUBLINE}}",
    "- Keywords: {{KEYWORDS}}",
    "- Heutiges Datum: {{HEUTIGES_DATUM}}",
    "",
    "Wenn eine Information nicht belegbar ist, lasse sie weg und markiere den Vorgang als pruefpflichtig.",
    promptType === "Thumbnail-Erstellung" ? `Nutze als Default fuer die Bild-KI, wenn keine spezifischen Details vorliegen: ${defaultAiEditorialThumbnailPrompt}` : "",
    "Gib das Ergebnis strukturiert im verlangten Output-Format zurueck."
  ].filter(Boolean).join("\n");
  return {
    name,
    prompt_type: promptType,
    description,
    system_instructions: systemInstructions,
    prompt_text: promptText,
    output_format: promptType === "Beitragstext" ? "markdown + pruefhinweise_json" : "json",
    temperature: promptType === "Beitragstext" ? "0.2" : "0.1",
    max_tokens: promptType === "Beitragstext" ? "1600" : "1200",
    status: "Entwurf",
    change_note: "Aus Fliesstext- oder Chat-Vorgabe vorbereitet.",
    test_input_json: JSON.stringify(parsePromptTestInput(""), null, 2)
  };
}

function aiFieldLimit(button, sourceField) {
  const fieldName = button.dataset.aiField || sourceField?.name || button.dataset.aiTarget || "";
  const tag = sourceField?.tagName?.toLowerCase() || "";
  if (AI_FIELD_LIMITS[fieldName]) return AI_FIELD_LIMITS[fieldName];
  if (tag === "input") return 120;
  return 0;
}

function articleCanPublish(article = {}) {
  const sourceStatus = article.source_status || article.sourceStatus || "";
  const duplicateStatus = String(article.duplicate_status || article.duplicateStatus || "").toLowerCase();
  const aiStatus = article.ai_check_status || article.aiCheckStatus || "";
  const bodyText = String(article.bodyText || article.body || "");
  const unresolvedDraft = /sicherer Themenvorschlag|lokale KI-Redaktion|Noch keine finale zentrale Aussage|Arbeitsentwurf|Belegstellen fehlen/i.test(bodyText);
  return sourceStatus === "geprueft"
    && !duplicateStatus.includes("dublette")
    && aiStatus === "bestanden"
    && article.headline
    && (article.subline || article.subtitle)
    && bodyText
    && !unresolvedDraft
    && (article.thumbnail_idea || article.thumbnailIdea || article.imageUrl)
    && (article.primary_keyword || article.primaryKeyword || (Array.isArray(article.tags) && article.tags.length));
}

function safeLocalArticleDraft(article = {}, sources = [], keywords = []) {
  const sourceLabels = sources.slice(0, 3).map((source) => source.publisher || source.title || source.domain).filter(Boolean);
  const mainKeyword = article.primary_keyword || keywords.find((keyword) => keyword.is_primary)?.keyword || article.category || "das Thema";
  const headline = String(article.headline || article.title || "Der Beitrag").replace(/^Themenvorschlag:\s*/i, "");
  return [
    `${headline} betrifft ein Feld, das fuer TV-, Streaming- und Medienanbieter redaktionell relevant sein kann. Dieser Arbeitsentwurf fasst noch keine externen Fakten als gesichert zusammen. Er markiert, welche Punkte die Redaktion anhand der hinterlegten Quellen pruefen sollte.`,
    `Im Mittelpunkt steht ${mainKeyword}. Fuer eine veroeffentlichbare Fassung muessen die Aussagen einzeln mit belastbaren Quellen abgeglichen werden. Hinterlegt sind aktuell ${sources.length} Quellen${sourceLabels.length ? `, darunter ${sourceLabels.join(", ")}` : ""}.`,
    "Wichtig ist die Einordnung fuer Anbieter, Plattformen, Produktion und Regulierung. Erst wenn klar ist, welche konkrete Entwicklung belegt ist, kann daraus ein leicht verstaendlicher Branchenbeitrag entstehen. Fachbegriffe sollten kurz erklaert und rechtliche oder technische Aussagen besonders sorgfaeltig geprueft werden.",
    "Dieser Text ist deshalb nur ein redaktioneller Arbeitsentwurf. Belegstellen fehlen noch auf Aussage-Ebene. Eine automatische Veroeffentlichung bleibt blockiert, bis Quellen, Dubletten, Keywords, KI-Pruefung und redaktionelle Freigabe vollstaendig bestanden sind."
  ].join("\n\n");
}

function draftArticleTextFromTopic(topic = {}) {
  const title = String(topic.headline || topic.title || "Medienthema").replace(/^Themenvorschlag:\s*/i, "");
  const keywordList = Array.isArray(topic.keywords) ? topic.keywords : [];
  const mainKeyword = keywordList[0] || topic.category || "das Thema";
  const reason = topic.reason || topic.subline || "Das Thema ist fuer die digitale Medienbranche relevant.";
  return [
    `${title} ist ein Thema, das fuer TV-, Streaming- und digitale Medienanbieter redaktionell relevant ist. ${reason}`,
    `Im Mittelpunkt steht ${mainKeyword}. Fuer die weitere Bearbeitung sollte die Redaktion klaeren, welche konkrete Entwicklung belegt ist, welche Akteure betroffen sind und welche Quellen als belastbar gelten. Erst danach kann der Beitrag final freigegeben werden.`,
    `Fuer die Branche geht es vor allem um Einordnung: Welche Folgen ergeben sich fuer Anbieter, Plattformen, Produktion, Distribution, Vermarktung oder Regulierung? Der Text soll spaeter leicht verstaendlich erklaeren, warum das Thema aktuell ist und was Medienunternehmen daraus ableiten koennen.`,
    "Dieser Entwurf ist eine redaktionelle Vorbereitung. Vor einer Veroeffentlichung muessen Quellen, Belegstellen, Dublettenstatus, Keywords und Freigabe im CMS geprueft werden."
  ].join("\n\n");
}

function shortTextFromTopic(topic = {}, bodyText = "") {
  return limitText(String(topic.subline || topic.reason || bodyText || "").replace(/\s+/g, " ").trim(), 180);
}

function domainFromUrl(value = "") {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function svgDataUrl(svg) {
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

function isOversizedInlineImage(value = "") {
  return String(value || "").startsWith("data:image/") && String(value || "").length > 900000;
}

function generateLocalEditorialThumbnail(article = {}) {
  const title = String(article.headline || article.title || "PROdigitalTV").replace(/^Themenvorschlag:\s*/i, "").slice(0, 56);
  const category = String(article.category || "KI-Redaktion").slice(0, 34);
  const keyword = String(article.primary_keyword || "Medienbranche").slice(0, 28);
  const safe = (value) => String(value || "").replace(/[<&>"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "\"": "&quot;" }[char]));
  const key = `${category} ${keyword} ${title}`.toLowerCase();
  const variants = [
    {
      match: ["hbbtv", "smart-tv"],
      label: "Smart-TV Studio",
      accent: "#1d9bf0",
      scene: `<rect x="96" y="108" width="566" height="332" rx="24" fill="#111827" stroke="#dbeafe" stroke-width="16"/>
        <rect x="132" y="146" width="494" height="248" rx="12" fill="#dbeafe"/>
        <rect x="176" y="184" width="168" height="92" rx="10" fill="#0f3a68" opacity=".92"/>
        <rect x="372" y="184" width="198" height="34" rx="17" fill="#ffffff" opacity=".94"/>
        <rect x="372" y="238" width="154" height="24" rx="12" fill="#ffffff" opacity=".72"/>
        <path d="M251 468h256M379 438v30" stroke="#e5edf7" stroke-width="20" stroke-linecap="round"/>
        <circle cx="908" cy="242" r="96" fill="#ffffff" opacity=".15"/>
        <path d="M855 242h106M908 189v106" stroke="#ffffff" stroke-width="18" stroke-linecap="round" opacity=".82"/>`
    },
    {
      match: ["fast", "distribution", "ott"],
      label: "Distribution Control Room",
      accent: "#00a878",
      scene: `<rect x="92" y="122" width="318" height="194" rx="18" fill="#e8f2ff" opacity=".95"/>
        <rect x="446" y="96" width="318" height="194" rx="18" fill="#f5f8fb" opacity=".92"/>
        <rect x="800" y="136" width="280" height="172" rx="18" fill="#dfefff" opacity=".88"/>
        <path d="M250 350c142 88 324 88 506 0s270-55 346 3" fill="none" stroke="#ffffff" stroke-width="20" opacity=".72"/>
        <g fill="#071a33" opacity=".68"><rect x="130" y="162" width="96" height="18" rx="9"/><rect x="484" y="136" width="146" height="18" rx="9"/><rect x="836" y="174" width="116" height="18" rx="9"/></g>
        <circle cx="960" cy="430" r="70" fill="#ffffff" opacity=".16"/><path d="M925 430h72" stroke="#ffffff" stroke-width="18" stroke-linecap="round"/>`
    },
    {
      match: ["musik", "gema", "rechte", "verwertung"],
      label: "Audio Rights Desk",
      accent: "#e30613",
      scene: `<rect x="120" y="132" width="310" height="330" rx="28" fill="#f8fafc" opacity=".94"/>
        <path d="M168 218c28-76 92-76 120 0s92 76 120 0" fill="none" stroke="#071a33" stroke-width="16" stroke-linecap="round" opacity=".78"/>
        <rect x="520" y="118" width="342" height="244" rx="18" fill="#fff" opacity=".86"/>
        <rect x="560" y="162" width="222" height="18" rx="9" fill="#071a33" opacity=".72"/>
        <rect x="560" y="214" width="258" height="16" rx="8" fill="#071a33" opacity=".36"/>
        <rect x="560" y="258" width="198" height="16" rx="8" fill="#071a33" opacity=".28"/>
        <circle cx="950" cy="250" r="82" fill="#ffffff" opacity=".18"/><path d="M910 250h80M950 210v80" stroke="#ffffff" stroke-width="16" stroke-linecap="round" opacity=".72"/>`
    },
    {
      match: ["ki", "redaktion", "produktion"],
      label: "Editorial AI Desk",
      accent: "#7c3aed",
      scene: `<rect x="96" y="124" width="450" height="284" rx="22" fill="#edf2ff" opacity=".92"/>
        <rect x="132" y="166" width="190" height="30" rx="15" fill="#071a33" opacity=".72"/>
        <rect x="132" y="226" width="340" height="18" rx="9" fill="#071a33" opacity=".34"/>
        <rect x="132" y="270" width="294" height="18" rx="9" fill="#071a33" opacity=".28"/>
        <path d="M694 148c120 0 216 96 216 216" fill="none" stroke="#ffffff" stroke-width="18" opacity=".5"/>
        <circle cx="760" cy="274" r="96" fill="#ffffff" opacity=".17"/>
        <path d="M710 274h100M760 224v100" stroke="#ffffff" stroke-width="18" stroke-linecap="round" opacity=".8"/>`
    },
    {
      match: ["barriere", "untertitel", "accessibility"],
      label: "Accessible Streaming",
      accent: "#f59e0b",
      scene: `<rect x="100" y="114" width="562" height="320" rx="24" fill="#0f172a" stroke="#fff7ed" stroke-width="16"/>
        <rect x="144" y="158" width="474" height="232" rx="12" fill="#e8eef7"/>
        <rect x="188" y="318" width="386" height="44" rx="10" fill="#071a33" opacity=".82"/>
        <rect x="220" y="334" width="168" height="12" rx="6" fill="#ffffff" opacity=".92"/>
        <rect x="414" y="334" width="104" height="12" rx="6" fill="#ffffff" opacity=".7"/>
        <circle cx="916" cy="256" r="86" fill="#ffffff" opacity=".18"/>
        <path d="M872 256h88M916 212v88" stroke="#ffffff" stroke-width="18" stroke-linecap="round" opacity=".76"/>`
    }
  ];
  const variant = variants.find((item) => item.match.some((token) => key.includes(token))) || variants[Math.abs([...key].reduce((sum, char) => sum + char.charCodeAt(0), 0)) % variants.length];
  return svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" role="img" aria-label="${safe(title)}">
    <defs>
      <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stop-color="#09111f"/>
        <stop offset="0.52" stop-color="#193a5c"/>
        <stop offset="1" stop-color="${variant.accent}"/>
      </linearGradient>
      <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 .08"/></feComponentTransfer></filter>
      <radialGradient id="lens" cx=".72" cy=".32" r=".65"><stop offset="0" stop-color="#ffffff" stop-opacity=".34"/><stop offset=".44" stop-color="#ffffff" stop-opacity=".08"/><stop offset="1" stop-color="#000000" stop-opacity=".18"/></radialGradient>
    </defs>
    <rect width="1200" height="675" fill="url(#bg)"/>
    <rect width="1200" height="675" fill="url(#lens)"/>
    <rect width="1200" height="675" filter="url(#grain)" opacity=".85"/>
    <path d="M0 540c160-92 319-106 485-38 190 78 346 69 715-106v279H0z" fill="#ffffff" opacity=".1"/>
    <path d="M78 94c72-52 155-78 248-78h710c56 0 101 45 101 101v354c0 63-51 114-114 114H92c-46 0-83-37-83-83V184c0-36 25-68 69-90z" fill="#ffffff" opacity=".07"/>
    ${variant.scene}
    <rect x="0" y="496" width="1200" height="179" fill="#06111f" opacity=".72"/>
    <text x="96" y="552" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700">${safe(category)}</text>
    <text x="96" y="610" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="44" font-weight="800">${safe(title)}</text>
    <text x="842" y="552" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="800">${safe(keyword)}</text>
    <text x="842" y="588" fill="#ffffff" opacity=".72" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="700">${safe(variant.label)}</text>
  </svg>`);
}

function slugify(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function localSeoDescription(article = {}) {
  const text = String(article.subline || article.subtitle || article.bodyText || article.body || "").replace(/\s+/g, " ").trim();
  return limitText(text || "Redaktionelle Einordnung fuer TV-, Streaming- und Medienanbieter.", 158);
}

function localArticleKeywords(article = {}, fallbackKeywords = []) {
  const title = String(article.headline || article.title || "");
  const subline = String(article.subline || article.subtitle || "");
  const body = String(article.bodyText || article.body || "");
  const category = String(article.category || "");
  const sourceKeywords = [
    ...(Array.isArray(fallbackKeywords) ? fallbackKeywords : []),
    ...(Array.isArray(article.tags) ? article.tags : []),
    article.primary_keyword || article.primaryKeyword || "",
    category,
    ...(`${title} ${subline}`).match(/[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß-]{3,}/g) || []
  ];
  const stopWords = new Set([
    "eine", "einer", "eines", "einem", "einen", "auch", "oder", "und", "fuer", "mit", "auf", "aus", "das", "der", "die",
    "den", "dem", "des", "zur", "zum", "von", "als", "ist", "sind", "werden", "wird", "kann", "soll", "thema", "beitrag",
    "redaktionelle", "redaktioneller", "digitale", "digitalen", "branche", "medienbranche"
  ]);
  const frequency = new Map();
  sourceKeywords.forEach((raw) => {
    const keyword = String(raw || "").replace(/^Themenvorschlag:\s*/i, "").trim();
    if (!keyword || keyword.length < 4) return;
    const normalized = keyword.toLowerCase();
    if (stopWords.has(normalized)) return;
    frequency.set(keyword, (frequency.get(keyword) || 0) + 1);
  });
  String(body).match(/[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]{4,}(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]{3,})?/g)?.slice(0, 18).forEach((keyword) => {
    const clean = keyword.trim();
    if (!stopWords.has(clean.toLowerCase())) frequency.set(clean, (frequency.get(clean) || 0) + 1);
  });
  return Array.from(frequency.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "de"))
    .slice(0, 12)
    .map(([keyword], index) => ({
      keyword,
      keyword_type: index === 0 ? "Hauptkeyword" : category.toLowerCase().includes("recht") ? "Rechtskeyword" : "Branchenkeyword",
      relevance_score: index === 0 ? 95 : Math.max(58, 88 - index * 4),
      is_primary: index === 0,
      explanation: index === 0 ? "Zentrales Thema aus Headline, Kategorie und Beitragstext." : "Automatisch aus Artikelinhalt und Themenkontext abgeleitet."
    }));
}

function localSeoPayload(article = {}, keywords = []) {
  const headline = String(article.headline || article.title || "").replace(/^Themenvorschlag:\s*/i, "").trim();
  const seoTitle = limitText(headline || "PROdigitalTV Branchenbeitrag", 68);
  const seoDescription = localSeoDescription(article);
  const seoKeywords = keywords.map((keyword) => keyword.keyword || keyword).filter(Boolean).slice(0, 8).join(", ");
  return {
    slug: article.slug || slugify(seoTitle),
    seoTitle,
    seo_title: seoTitle,
    seoDescription,
    seo_description: seoDescription,
    seoKeywords,
    seo_keywords: seoKeywords
  };
}

function optimizeLocalEditorialText(value = "") {
  const text = String(value || "").replace(/\r/g, "").trim();
  if (!text) return "";
  const paragraphs = text.split(/\n+/).map((paragraph) => paragraph.replace(/\s+/g, " ").trim()).filter(Boolean);
  return paragraphs.map((paragraph) => {
    return paragraph
      .replace(/\bsehr sehr\b/gi, "sehr")
      .replace(/\bKI-Redaktion\b/g, "Redaktion")
      .replace(/\bArbeitsentwurf\b/g, "Entwurf")
      .replace(/\bVeroeffentlichung bleibt blockiert\b/g, "Veroeffentlichung bleibt an die Pruefung gebunden");
  }).join("\n\n");
}

function summarizeLocalEditorialText(article = {}) {
  const body = String(article.bodyText || article.body || "").replace(/\s+/g, " ").trim();
  const firstSentence = body.split(/(?<=[.!?])\s+/).find(Boolean) || article.subline || article.subtitle || "";
  return limitText(firstSentence || "Redaktionelle Einordnung fuer die digitale Medienwirtschaft.", 90);
}

async function writeAiArticleLog(articleId, status, message, details = {}) {
  await upsert("ai_editorial_logs", {
    id: `ai-editorial-log-${crypto.randomUUID()}`,
    article_id: articleId,
    task_name: "KI_Redaktion_Manuelle_Pruefung",
    status,
    message,
    found_topics_json: [],
    rejected_topics_json: [],
    used_sources_json: details.usedSources || [],
    source_check_json: details.sourceCheck || {},
    duplicate_check_json: details.duplicateCheck || {},
    keyword_result_json: details.keywordResult || {},
    ai_check_json: details.aiCheck || {},
    error_json: details.error || {},
    created_at: new Date().toISOString()
  });
}

function normalizeAiSuggestion(value, button, sourceField) {
  const maxLength = aiFieldLimit(button, sourceField);
  return maxLength ? limitText(value, maxLength) : String(value || "").trim();
}

function progressMarkup(label, width = 45) {
  return `<span class="cms-progress"><span>${escapeHtml(label)}</span><span class="progress progress--indeterminate"><i style="width:${width}%"></i></span></span>`;
}

function submitFormAndWait(form) {
  if (!form) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      form.removeEventListener("cms-form-saved", onSaved);
      form.removeEventListener("cms-form-save-failed", onFailed);
    };
    const onSaved = (event) => {
      cleanup();
      resolve(event.detail || {});
    };
    const onFailed = (event) => {
      cleanup();
      reject(event.detail?.error || new Error("Speichern fehlgeschlagen."));
    };
    form.addEventListener("cms-form-saved", onSaved, { once: true });
    form.addEventListener("cms-form-save-failed", onFailed, { once: true });
    form.requestSubmit();
  });
}

function showAiDialog({ button, originalText, result, sourceField }) {
  document.querySelector(".ai-dialog-backdrop")?.remove();
  const suggestedText = normalizeAiSuggestion(result.suggestedText || structuredToText(result.structured), button, sourceField);
  const wrapper = document.createElement("div");
  wrapper.className = "ai-dialog-backdrop";
  wrapper.innerHTML = `<div class="ai-dialog" role="dialog" aria-modal="true">
    <div class="actions" style="justify-content:space-between"><div><p class="eyebrow">ChatGPT-Vorschlag</p><h2>${escapeHtml(button.textContent.trim())}</h2></div><button type="button" class="link-button" data-ai-close>Schliessen</button></div>
    <div class="ai-dialog-grid">
      <div class="field"><label>Originaltext</label><textarea readonly>${escapeHtml(originalText)}</textarea></div>
      <div class="field"><label>KI-Vorschlag</label><textarea data-ai-suggestion>${escapeHtml(suggestedText)}</textarea></div>
    </div>
    ${result.structured ? `<pre class="ai-structured">${escapeHtml(JSON.stringify(result.structured, null, 2))}</pre>` : ""}
    <div class="actions"><button type="button" class="button button--primary" data-ai-accept>Uebernehmen</button><button type="button" class="button button--secondary" data-ai-save-draft>Als Entwurf speichern</button><button type="button" class="button button--secondary" data-ai-regenerate>Neu generieren</button><button type="button" class="button button--secondary" data-ai-close>Verwerfen</button></div>
    <p class="muted">KI-Ausgaben werden nicht automatisch veroeffentlicht. Bitte pruefen, bearbeiten und erst danach speichern.</p>
  </div>`;
  document.body.append(wrapper);
  wrapper.querySelectorAll("[data-ai-close]").forEach((item) => item.addEventListener("click", () => wrapper.remove()));
  wrapper.querySelector("[data-ai-accept]").addEventListener("click", () => {
    const value = normalizeAiSuggestion(wrapper.querySelector("[data-ai-suggestion]").value, button, sourceField);
    if (sourceField && "value" in sourceField) sourceField.value = value;
    wrapper.remove();
  });
  wrapper.querySelector("[data-ai-save-draft]").addEventListener("click", async () => {
    const value = wrapper.querySelector("[data-ai-suggestion]").value;
    await saveAiDraft({
      entityType: button.dataset.aiEntityType,
      entityId: button.dataset.aiEntityId,
      fieldName: button.dataset.aiField,
      originalText,
      suggestedText: value,
      action: button.dataset.aiAction
    });
    wrapper.querySelector(".muted").textContent = "KI-Entwurf wurde in aiDrafts gespeichert.";
  });
  wrapper.querySelector("[data-ai-regenerate]").addEventListener("click", () => {
    wrapper.remove();
    button.click();
  });
}

function wireImageDropzones() {
  document.querySelectorAll("[data-image-dropzone]").forEach((zone) => {
    const form = zone.closest("form");
    const input = zone.querySelector('input[type="file"]');
    const removeInput = zone.querySelector('input[type="hidden"]');
    const dataInput = zone.querySelector(`input[name="${input?.name}DataUrl"]`);
    const fileNameInput = zone.querySelector(`input[name="${input?.name}FileName"]`);
    const preview = zone.querySelector("[data-image-preview]");
    const selectButton = zone.querySelector("[data-image-select]");
    const removeButton = zone.querySelector("[data-image-remove]");
    const tools = zone.querySelector("[data-image-tools]");
    const zoom = zone.querySelector("[data-image-zoom]");
    const sizeSelect = zone.querySelector("[data-image-size]");
    const resolution = zone.querySelector("[data-image-resolution]");
    const cropButton = zone.querySelector("[data-image-crop]");
    const status = zone.querySelector("[data-image-status]");
    const emptyText = preview?.querySelector("span")?.textContent || "Bild per Drag-and-drop oder Klick hochladen";
    zone.querySelectorAll("[data-image-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        const mode = button.dataset.imageMode;
        zone.querySelectorAll("[data-image-mode]").forEach((item) => item.classList.toggle("is-active", item === button));
        zone.querySelectorAll("[data-image-mode-panel]").forEach((panel) => {
          panel.hidden = panel.dataset.imageModePanel !== mode;
        });
      });
    });
    const crop = { file: null, src: "", img: null, x: 0, y: 0, scale: 1, dragging: false, startX: 0, startY: 0, originX: 0, originY: 0 };
    const selectedSize = () => {
      const [width, height] = String(sizeSelect?.value || "240x180").split("x").map((value) => Number(value));
      return { width: width || 240, height: height || 180 };
    };
    const updateResolution = () => {
      const size = selectedSize();
      if (resolution) resolution.textContent = `Ausgabeformat: ${size.width} x ${size.height} px.`;
      if (preview) {
        const availableWidth = Math.max(240, Math.min(640, (zone.clientWidth || 720) - 28));
        const previewWidth = size.width / size.height > 1.4 ? availableWidth : Math.min(420, availableWidth);
        preview.style.width = `${previewWidth}px`;
        preview.style.height = `${Math.round(previewWidth * size.height / size.width)}px`;
      }
    };
    const renderCrop = () => {
      if (!crop.img) return;
      crop.img.style.width = "100%";
      crop.img.style.height = "100%";
      crop.img.style.maxWidth = "100%";
      crop.img.style.maxHeight = "100%";
      crop.img.style.objectFit = "contain";
      crop.img.style.transform = `translate(${crop.x}px, ${crop.y}px) scale(${crop.scale})`;
      crop.img.style.transformOrigin = "center";
    };
    const showFile = (file, options = {}) => {
      if (!file || !file.type.startsWith("image/")) return;
      form?.classList.remove("is-saved");
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        crop.file = file;
        crop.src = reader.result;
        crop.x = 0;
        crop.y = 0;
        crop.scale = 1;
        preview.innerHTML = `<img src="${reader.result}" alt="">`;
        crop.img = preview.querySelector("img");
        preview.classList.add("has-image");
        if (removeButton) removeButton.hidden = false;
        tools.hidden = false;
        zoom.value = "1";
        removeInput.value = "";
        if (dataInput) dataInput.value = options.dataUrl || "";
        if (fileNameInput) fileNameInput.value = options.fileName || "";
        updateResolution();
        status.textContent = options.statusText || "Neues Bild ausgewaehlt. Das gesamte Motiv ist sichtbar. Bei Bedarf zoomen/verschieben oder direkt speichern.";
        renderCrop();
      });
      reader.readAsDataURL(file);
    };
    preview?.addEventListener("click", () => {
      if (preview.classList.contains("has-image")) return;
      input.click();
    });
    selectButton?.addEventListener("click", () => input.click());
    input?.addEventListener("change", () => showFile(input.files?.[0]));
    preview?.addEventListener("pointerdown", (event) => {
      if (!crop.img) return;
      crop.dragging = true;
      crop.startX = event.clientX;
      crop.startY = event.clientY;
      crop.originX = crop.x;
      crop.originY = crop.y;
      preview.setPointerCapture(event.pointerId);
    });
    preview?.addEventListener("pointermove", (event) => {
      if (!crop.dragging) return;
      crop.x = crop.originX + event.clientX - crop.startX;
      crop.y = crop.originY + event.clientY - crop.startY;
      renderCrop();
    });
    preview?.addEventListener("pointerup", () => { crop.dragging = false; });
    zoom?.addEventListener("input", () => {
      crop.scale = Number(zoom.value || 1);
      renderCrop();
    });
    sizeSelect?.addEventListener("change", () => {
      form?.classList.remove("is-saved");
      updateResolution();
    });
    cropButton?.addEventListener("click", async () => {
      if (!crop.img || !crop.file) return;
      const size = selectedSize();
      const canvas = document.createElement("canvas");
      canvas.width = size.width;
      canvas.height = size.height;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const baseScale = Math.max(canvas.width / crop.img.naturalWidth, canvas.height / crop.img.naturalHeight);
      const width = crop.img.naturalWidth * baseScale * crop.scale;
      const height = crop.img.naturalHeight * baseScale * crop.scale;
      const previewRect = preview.getBoundingClientRect();
      const offsetX = crop.x * (canvas.width / Math.max(1, previewRect.width));
      const offsetY = crop.y * (canvas.height / Math.max(1, previewRect.height));
      ctx.drawImage(crop.img, (canvas.width - width) / 2 + offsetX, (canvas.height - height) / 2 + offsetY, width, height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", .9));
      const croppedFile = new File([blob], crop.file.name.replace(/\.[^.]+$/, "") + `-${size.width}x${size.height}.jpg`, { type: "image/jpeg" });
      fileToInput(input, croppedFile);
      crop.file = croppedFile;
      crop.src = canvas.toDataURL("image/jpeg", .9);
      if (dataInput) dataInput.value = crop.src;
      if (fileNameInput) fileNameInput.value = croppedFile.name;
      preview.innerHTML = `<img src="${crop.src}" alt="">`;
      crop.img = preview.querySelector("img");
      crop.x = 0;
      crop.y = 0;
      crop.scale = 1;
      zoom.value = "1";
      tools.hidden = true;
      status.textContent = `Bild zugeschnitten (${size.width} x ${size.height} px). Bitte speichern.`;
      renderCrop();
    });
    zone.addEventListener("dragover", (event) => {
      event.preventDefault();
      zone.classList.add("is-dragover");
    });
    zone.addEventListener("dragleave", () => zone.classList.remove("is-dragover"));
    zone.addEventListener("drop", (event) => {
      event.preventDefault();
      zone.classList.remove("is-dragover");
      const file = event.dataTransfer?.files?.[0];
      if (!file) return;
      fileToInput(input, file);
      showFile(file);
    });
    zone.querySelector("[data-ai-image-generate]")?.addEventListener("click", async (event) => {
      const button = event.currentTarget;
      const promptField = zone.querySelector("[data-ai-image-prompt]");
      const originalLabel = button.textContent;
      button.disabled = true;
      button.textContent = "KI erzeugt Collage ...";
      status.innerHTML = progressMarkup("KI erzeugt eine redaktionelle Collage ...", 35);
      try {
        const generated = await generateCmsThumbCollage({
          entityType: form?.dataset.module || "cms",
          entityId: form?.dataset.id || form?.dataset.topicId || "",
          prompt: promptField?.value || "",
          context: form ? imageGenerationContext(form) : {},
          size: "1536x1024",
          quality: "medium"
        });
        if (promptField && generated.prompt) promptField.value = generated.prompt;
        const normalized = await generatedThumbToJpeg(generated.imageDataUrl, generated.fileName || `${form?.dataset.id || form?.dataset.topicId || "cms-thumb"}-ki-collage.png`, selectedSize());
        const file = normalized.file;
        fileToInput(input, file);
        showFile(file, {
          dataUrl: normalized.dataUrl,
          fileName: file.name,
          statusText: "KI-Collage erzeugt. Speichere Bild automatisch ..."
        });
        status.innerHTML = progressMarkup("KI-Collage erzeugt. Bild wird gespeichert ...", 78);
        try {
          const saved = await submitFormAndWait(form);
          const savedImageUrl = saved.imageUrl || saved.assetUrl || saved.logoUrl || saved.photoUrl || normalized.dataUrl;
          updateDropzoneSavedImage(form, savedImageUrl);
          status.textContent = "KI-Collage wurde erzeugt und gespeichert.";
        } catch (saveError) {
          await saveGeneratedImageFallback(form, normalized.dataUrl, file.name);
          status.textContent = "KI-Collage wurde erzeugt und ohne Firebase-Storage direkt im Datensatz gespeichert.";
        }
      } catch (error) {
        status.textContent = `KI-Bild konnte nicht erzeugt werden: ${error.message || String(error)}`;
      } finally {
        button.disabled = false;
        button.textContent = originalLabel;
      }
    });
    removeButton?.addEventListener("click", () => {
      form?.classList.remove("is-saved");
      input.value = "";
      removeInput.value = "1";
      if (dataInput) dataInput.value = "";
      if (fileNameInput) fileNameInput.value = "";
      crop.file = null;
      crop.src = "";
      crop.img = null;
      tools.hidden = true;
      preview.innerHTML = `<span>${emptyText}</span>`;
      preview.classList.remove("has-image");
      if (removeButton) removeButton.hidden = true;
      status.textContent = "Bild zum Löschen markiert. Bitte speichern.";
    });
    updateResolution();
  });
}

function wireGalleryEditor() {
  const form = document.querySelector("#gallery-edit-form");
  if (!form) return;
  const dropzone = form.querySelector("[data-gallery-dropzone]");
  const dropInput = form.elements.galleryImagesDrop;
  const buttonInput = form.elements.galleryImages;
  const result = form.querySelector("#gallery-save-result");
  const updateDropzoneText = (files) => {
    const count = files?.length || 0;
    const label = dropzone?.querySelector("span");
    if (label && count) label.textContent = `${count} Bild${count === 1 ? "" : "er"} ausgewaehlt. Upload startet automatisch.`;
  };
  const autosaveDroppedFiles = (images) => {
    if (!images.length) return;
    if (!form.elements.title.value.trim()) form.elements.title.value = "Neue Bildergalerie";
    updateDropzoneText(images);
    if (result) result.innerHTML = `<div class="alert">${progressMarkup("Bilder abgelegt. Galerie wird automatisch gespeichert ...", 35)}</div>`;
    window.setTimeout(() => form.requestSubmit(), 0);
  };
  const acceptFiles = (files, autosave = false) => {
    const images = Array.from(files || []).filter((file) => file.type.startsWith("image/"));
    if (!images.length) return;
    filesToInput(dropInput, images);
    if (buttonInput) buttonInput.value = "";
    updateDropzoneText(images);
    if (autosave) autosaveDroppedFiles(images);
  };
  const hasImageFiles = (files) => Array.from(files || []).some((file) => file.type.startsWith("image/"));
  dropzone?.addEventListener("click", () => dropInput?.click());
  dropInput?.addEventListener("change", () => acceptFiles(dropInput.files, true));
  dropzone?.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropzone.classList.add("is-dragover");
  });
  dropzone?.addEventListener("dragleave", () => dropzone.classList.remove("is-dragover"));
  dropzone?.addEventListener("drop", (event) => {
    event.preventDefault();
    dropzone.classList.remove("is-dragover");
    acceptFiles(event.dataTransfer?.files, true);
  });

  const sortable = form.querySelector("[data-gallery-sortable]");
  let dragged = null;
  sortable?.addEventListener("dragover", (event) => {
    if (!hasImageFiles(event.dataTransfer?.files)) return;
    event.preventDefault();
    dropzone?.classList.add("is-dragover");
  });
  sortable?.addEventListener("dragleave", () => dropzone?.classList.remove("is-dragover"));
  sortable?.addEventListener("drop", (event) => {
    if (!hasImageFiles(event.dataTransfer?.files)) return;
    event.preventDefault();
    event.stopPropagation();
    dropzone?.classList.remove("is-dragover");
    acceptFiles(event.dataTransfer?.files, true);
  });
  sortable?.querySelectorAll("[data-gallery-image-item]").forEach((item) => {
    item.addEventListener("dragstart", () => {
      dragged = item;
      item.classList.add("is-dragging");
    });
    item.addEventListener("dragend", () => {
      item.classList.remove("is-dragging");
      dragged = null;
    });
    item.addEventListener("dragover", (event) => {
      if (hasImageFiles(event.dataTransfer?.files)) return;
      event.preventDefault();
    });
    item.addEventListener("drop", (event) => {
      if (hasImageFiles(event.dataTransfer?.files)) return;
      event.preventDefault();
      const target = event.currentTarget;
      if (!dragged || dragged === target) return;
      const rect = target.getBoundingClientRect();
      const after = event.clientY > rect.top + rect.height / 2 || event.clientX > rect.left + rect.width / 2;
      sortable.insertBefore(dragged, after ? target.nextSibling : target);
    });
  });
}

function openGalleryPlayer(gallery) {
  const images = Array.isArray(gallery?.images) ? gallery.images.filter((image) => image.url) : [];
  if (!images.length) return;
  let index = 0;
  let timer = null;
  const overlay = document.createElement("div");
  overlay.className = "gallery-player";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  const renderSlide = () => {
    const image = images[index];
    overlay.innerHTML = `<div class="gallery-player__panel">
      <div class="gallery-player__top"><strong>${escapeHtml(gallery.title || "Bildergalerie")}</strong><button class="gallery-player__close" type="button" data-gallery-close aria-label="Schliessen">×</button></div>
      <figure class="gallery-player__stage"><img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.altText || image.caption || "Galeriebild")}">${image.caption ? `<figcaption>${escapeHtml(image.caption)}</figcaption>` : ""}</figure>
      <div class="gallery-player__controls">
        <button type="button" data-gallery-prev aria-label="Vorheriges Bild">‹</button>
        <span>${index + 1} / ${images.length}</span>
        <button type="button" data-gallery-next aria-label="Naechstes Bild">›</button>
        <button type="button" data-gallery-toggle>${timer ? "Pause" : "Play"}</button>
      </div>
    </div>`;
  };
  const stop = () => {
    if (timer) window.clearInterval(timer);
    timer = null;
  };
  const next = () => {
    index = (index + 1) % images.length;
    renderSlide();
  };
  const previous = () => {
    index = (index - 1 + images.length) % images.length;
    renderSlide();
  };
  const start = () => {
    stop();
    timer = window.setInterval(next, 3600);
  };
  const close = () => {
    stop();
    overlay.remove();
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (event) => {
    if (event.key === "Escape") close();
    if (event.key === "ArrowRight") next();
    if (event.key === "ArrowLeft") previous();
  };
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay || event.target.closest("[data-gallery-close]")) close();
    if (event.target.closest("[data-gallery-next]")) next();
    if (event.target.closest("[data-gallery-prev]")) previous();
    if (event.target.closest("[data-gallery-toggle]")) {
      if (timer) stop();
      else start();
      renderSlide();
    }
  });
  document.addEventListener("keydown", onKey);
  document.body.appendChild(overlay);
  renderSlide();
  start();
  renderSlide();
}

function wireGalleryPlayers() {
  document.querySelectorAll("[data-gallery-play]").forEach((button) => {
    if (button.dataset.galleryPlayerWired === "1") return;
    button.dataset.galleryPlayerWired = "1";
    button.addEventListener("click", () => {
    try {
      openGalleryPlayer(JSON.parse(button.dataset.galleryPayload || "{}"));
    } catch (error) {
      console.error("Galerie konnte nicht geoeffnet werden", error);
    }
    });
  });
}

function renderEditorGalleryPreview(select) {
  const preview = select.closest("form")?.querySelector("[data-editor-gallery-preview]");
  if (!preview) return;
  const option = select.selectedOptions?.[0];
  const payloadText = option?.dataset.galleryPayload || "";
  if (!payloadText) {
    preview.className = "editor-gallery-preview editor-gallery-preview--empty";
    preview.innerHTML = `<p class="muted">Keine Galerie verknuepft. Galerie auswaehlen und speichern, um sie mit diesem Inhalt zu verbinden.</p>`;
    return;
  }
  try {
    const gallery = JSON.parse(payloadText);
    const imageCount = Array.isArray(gallery.images) ? gallery.images.length : 0;
    preview.className = "editor-gallery-preview";
    preview.innerHTML = `<div><strong>${escapeHtml(gallery.title || "Bildergalerie")}</strong><span>${imageCount} Bilder</span></div><button class="gallery-play-button" type="button" data-gallery-play data-gallery-payload="${escapeHtml(payloadText)}" title="Galerie abspielen" aria-label="Galerie abspielen"><span aria-hidden="true"></span></button>`;
    wireGalleryPlayers();
  } catch (error) {
    preview.className = "editor-gallery-preview editor-gallery-preview--empty";
    preview.innerHTML = `<p class="muted">Galerie-Vorschau konnte nicht geladen werden.</p>`;
  }
}

function wireEditorGallerySelects() {
  document.querySelectorAll('select[name="galleryId"]').forEach((select) => {
    if (select.dataset.editorGalleryWired === "1") return;
    select.dataset.editorGalleryWired = "1";
    select.addEventListener("change", () => renderEditorGalleryPreview(select));
  });
}

function wireGalleryLinkSaves() {
  document.querySelectorAll("[data-save-gallery-link]").forEach((button) => {
    if (button.dataset.galleryLinkWired === "1") return;
    button.dataset.galleryLinkWired = "1";
    button.addEventListener("click", async () => {
      const form = button.closest("form");
      const select = form?.querySelector('select[name="galleryId"]');
      const result = form?.querySelector("[data-gallery-link-result]");
      if (!form || !select) return;
      const module = form.dataset.module || (form.id === "topic-editor-form" ? "topics" : "editorialContent");
      const id = form.dataset.id || form.dataset.topicId;
      button.disabled = true;
      if (result) result.innerHTML = `<div class="alert">Galerie-Verknuepfung wird gespeichert...</div>`;
      try {
        const existing = (await getOne(module, id)) || { id, createdAt: new Date().toISOString() };
        await upsert(module, {
          ...existing,
          galleryId: select.value || "",
          updatedAt: new Date().toISOString()
        });
        if (result) result.innerHTML = `<div class="alert alert--success">Galerie-Verknuepfung gespeichert.</div>`;
      } catch (error) {
        if (result) result.innerHTML = `<div class="alert alert--error">Galerie konnte nicht verknuepft werden: ${escapeHtml(error.message || "Unbekannter Fehler")}</div>`;
      } finally {
        button.disabled = false;
      }
    });
  });
}

function wireLinkedMediaClears() {
  document.querySelectorAll("[data-clear-linked-media]").forEach((button) => {
    if (button.dataset.clearLinkedMediaWired === "1") return;
    button.dataset.clearLinkedMediaWired = "1";
    button.addEventListener("click", async () => {
      const form = button.closest("form");
      if (!form) return;
      const module = form.dataset.module || (form.id === "topic-editor-form" ? "topics" : "editorialContent");
      const id = form.dataset.id || form.dataset.topicId;
      const kind = button.dataset.clearLinkedMedia;
      const result = kind === "audio"
        ? form.querySelector("[data-speech-result]")
        : form.querySelector("[data-gallery-link-result]");
      button.disabled = true;
      if (result) result.innerHTML = `<div class="alert">Verknuepfung wird geloest...</div>`;
      try {
        const existing = (await getOne(module, id)) || { id, createdAt: new Date().toISOString() };
        const update = kind === "audio"
          ? { audioUrl: "", audioStoragePath: "", audioMimeType: "", audioTextLength: 0, audioTextTruncated: false }
          : { galleryId: "" };
        await upsert(module, { ...existing, ...update, updatedAt: new Date().toISOString() });
        if (kind === "gallery") {
          const select = form.querySelector('select[name="galleryId"]');
          if (select) {
            await selectOptionByValue(select, "");
            renderEditorGalleryPreview(select);
          }
        }
        if (kind === "audio") {
          button.closest(".audio-generation-panel")?.querySelector("audio")?.remove();
        }
        if (result) result.innerHTML = `<div class="alert alert--success">Verknuepfung geloest.</div>`;
      } catch (error) {
        if (result) result.innerHTML = `<div class="alert alert--error">Verknuepfung konnte nicht geloest werden: ${escapeHtml(error.message || "Unbekannter Fehler")}</div>`;
      } finally {
        button.disabled = false;
      }
    });
  });
}

async function selectOptionByValue(select, value) {
  select.value = value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function updateTopicThumbInList(topicId, imageUrl) {
  const safeId = window.CSS?.escape ? CSS.escape(topicId) : topicId.replace(/"/g, '\\"');
  const thumb = document.querySelector(`[data-topic-drag-id="${safeId}"] .topic-thumb`);
  if (!thumb) return;
  thumb.innerHTML = imageUrl ? `<img src="${imageUrl}" alt="">` : "<span>Bild</span>";
}

function updateDropzoneSavedImage(form, imageUrl) {
  const preview = form.querySelector("[data-image-preview]");
  const tools = form.querySelector("[data-image-tools]");
  const input = form.querySelector("[data-image-dropzone] input[type='file']");
  const dataInput = form.querySelector(`[name="${input?.name}DataUrl"]`);
  const fileNameInput = form.querySelector(`[name="${input?.name}FileName"]`);
  if (!preview) return;
  if (imageUrl) {
    preview.innerHTML = `<img src="${imageUrl}" alt="">`;
    preview.classList.add("has-image");
  } else {
    preview.innerHTML = "<span>Bild per Drag-and-drop oder Klick hochladen</span>";
    preview.classList.remove("has-image");
  }
  const removeButton = form.querySelector("[data-image-remove]");
  if (removeButton) removeButton.hidden = !imageUrl;
  if (input) input.value = "";
  if (dataInput) dataInput.value = "";
  if (fileNameInput) fileNameInput.value = "";
  if (tools) tools.hidden = true;
}

async function saveGeneratedImageFallback(form, dataUrl, fileName) {
  const module = form.dataset.module || (form.id === "topic-editor-form" ? "topics" : "editorialContent");
  const id = form.dataset.id || form.dataset.topicId;
  const existing = (await getOne(module, id)) || { id, createdAt: new Date().toISOString() };
  const values = { ...existing, imageUrl: dataUrl, assetStoragePath: "", updatedAt: new Date().toISOString() };
  if (module === "editorialContent") {
    values.assetUrl = dataUrl;
    values.assetFileName = fileName || `${id}-ki-thumb.jpg`;
    values.assetType = "image";
    values.documentUrl = "";
  }
  await upsert(module, values);
  updateDropzoneSavedImage(form, dataUrl);
}

async function saveEventTopicSpeakerForm(form) {
  const existingEvent = await getOne("events", form.dataset.eventId);
  const speakerId = form.dataset.speakerId || `speakers-${crypto.randomUUID()}`;
  const existingSpeaker = form.dataset.speakerId ? await getOne("speakers", speakerId) : { id: speakerId, status: "published", visibility: "public", createdAt: new Date().toISOString() };
  const topicIdsForSpeaker = new Set(existingSpeaker.topicIds || []);
  topicIdsForSpeaker.add(form.dataset.topicId);
  const eventIdsForSpeaker = new Set(existingSpeaker.eventIds || []);
  eventIdsForSpeaker.add(form.dataset.eventId);
  const eventSpeakerIds = Array.from(new Set([...(existingEvent.speakerIds || []), speakerId]));
  const image = imageFileFromDropzone(form, "speakerImage", speakerId);
  const imageUpdate = {};
  if (form.elements.removeSpeakerImage?.value === "1") {
    await deleteStoredAsset(existingSpeaker);
    imageUpdate.photoUrl = "";
    imageUpdate.assetStoragePath = "";
  }
  if (image) {
    await deleteStoredAsset(existingSpeaker);
    const asset = await uploadEntityImage("speakers", speakerId, image);
    imageUpdate.photoUrl = asset.url;
    imageUpdate.assetStoragePath = asset.storagePath;
  }
  await upsert("speakers", {
    ...existingSpeaker,
    id: speakerId,
    name: form.elements.name.value,
    company: form.elements.company.value,
    position: form.elements.position.value,
    ...imageUpdate,
    topicId: existingSpeaker.topicId || form.dataset.topicId,
    topicIds: Array.from(topicIdsForSpeaker),
    eventIds: Array.from(eventIdsForSpeaker),
    updatedAt: new Date().toISOString()
  });
  await upsert("events", { ...existingEvent, speakerIds: eventSpeakerIds, updatedAt: new Date().toISOString() });
  form.dataset.speakerId = speakerId;
  form.querySelector("#event-topic-speaker-result").innerHTML = `<div class="alert alert--success">Referent wurde gespeichert.</div>`;
  const imageStatus = form.querySelector("[data-image-status]");
  if (imageStatus) imageStatus.textContent = imageUpdate.photoUrl ? "Bild wurde gespeichert." : imageUpdate.photoUrl === "" ? "Bild wurde gelöscht." : imageStatus.textContent;
  form.classList.add("is-saved");
  if (!new URLSearchParams(location.hash.split("?")[1] || "").get("speaker")) {
    history.replaceState(null, "", `#/cms/event/${form.dataset.eventId}?tab=topics&mode=referent&topic=${form.dataset.topicId}&speaker=${speakerId}`);
  }
}

function wireActions() {
  wireImageDropzones();
  wireGalleryEditor();
  wireGalleryPlayers();
  wireEditorGallerySelects();
  wireGalleryLinkSaves();
  wireLinkedMediaClears();
  document.querySelectorAll("[data-generate-article-speech]").forEach((button) => button.addEventListener("click", async () => {
    const result = button.closest(".audio-list-cell, .audio-generation-panel")?.querySelector("[data-speech-result]");
    const audioUrl = button.dataset.audioUrl || "";
    if (audioUrl && button.classList.contains("audio-play-button")) {
      const activeAudio = document.querySelector("audio[data-list-audio-player]");
      const activeButton = document.querySelector(".audio-play-button.is-playing");
      if (button.classList.contains("is-playing") && activeAudio) {
        activeAudio.pause();
        activeAudio.remove();
        button.classList.remove("is-playing");
        return;
      }
      if (activeAudio) activeAudio.remove();
      if (activeButton) activeButton.classList.remove("is-playing");
      const audio = document.createElement("audio");
      audio.dataset.listAudioPlayer = "1";
      audio.src = audioUrl;
      audio.hidden = true;
      document.body.append(audio);
      button.classList.add("is-playing");
      audio.addEventListener("ended", () => {
        button.classList.remove("is-playing");
        audio.remove();
      });
      audio.addEventListener("pause", () => {
        if (!audio.ended) button.classList.remove("is-playing");
      });
      await audio.play();
      return;
    }
    const isIconAudioButton = button.classList.contains("audio-play-button");
    const originalLabel = button.textContent;
    const originalAriaLabel = button.getAttribute("aria-label") || "";
    button.disabled = true;
    button.classList.add("is-generating");
    if (isIconAudioButton) button.setAttribute("aria-label", "Audio wird erzeugt");
    else button.textContent = "Audio wird erzeugt ...";
    const form = button.closest("form");
    if (result) result.innerHTML = `<div class="alert">${progressMarkup(form ? "Aktuelle Texte werden zuerst gespeichert ..." : "Gemini erzeugt und speichert die Audiodatei ...", 30)}</div>`;
    try {
      if (form?.matches("#topic-editor-form, #content-edit-form, #ai-article-edit-form")) {
        await submitFormAndWait(form);
        if (result) result.innerHTML = `<div class="alert">${progressMarkup("Gemini erzeugt und speichert die Audiodatei ...", 72)}</div>`;
      }
      const speech = await generateArticleSpeechAsset({ collection: button.dataset.collection, id: button.dataset.recordId });
      if (result) result.innerHTML = `<div class="alert alert--success">Audio gespeichert.${speech.truncated ? " Der Text wurde fuer die Sprachausgabe gekuerzt." : ""}</div>`;
      await render();
    } catch (error) {
      if (result) result.innerHTML = `<div class="alert alert--error">Audio konnte nicht erzeugt werden: ${escapeHtml(error.message || String(error))}</div>`;
    } finally {
      button.disabled = false;
      button.classList.remove("is-generating");
      if (isIconAudioButton) button.setAttribute("aria-label", originalAriaLabel);
      else button.textContent = originalLabel;
    }
  }));
  document.querySelectorAll("form.is-save-aware input, form.is-save-aware textarea, form.is-save-aware select").forEach((field) => {
    field.addEventListener("input", () => field.form?.classList.remove("is-saved"));
    field.addEventListener("change", () => field.form?.classList.remove("is-saved"));
  });
  document.querySelectorAll(".ai-action").forEach((button) => button.addEventListener("click", async () => {
    const originalLabel = button.textContent;
    const { text, field } = findAiSource(button);
    const compactText = compactAiText(text, button.dataset.aiAction === "generateEventRetrospective" ? 9000 : 12000);
    button.disabled = true;
    button.textContent = "ChatGPT arbeitet ...";
    try {
      const result = await callChatGptAction(button.dataset.aiAction, {
        module: "event-admin",
        entityType: button.dataset.aiEntityType,
        entityId: button.dataset.aiEntityId,
        fieldName: button.dataset.aiField,
        originalText: compactText,
        context: eventContext(button)
      });
      showAiDialog({ button, originalText: text, result, sourceField: field });
    } catch (error) {
      alert(error.message || String(error));
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }));

  document.querySelectorAll("[data-ai-editor-tab]").forEach((button) => button.addEventListener("click", () => {
    const target = button.dataset.aiEditorTab;
    const section = document.querySelector(`[data-ai-editor-section="${target}"]`);
    if (!section) return;
    document.querySelectorAll("[data-ai-editor-tab]").forEach((tab) => tab.classList.toggle("active", tab === button));
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  }));

  document.querySelectorAll("[data-ai-editorial-run]").forEach((button) => button.addEventListener("click", async () => {
    const output = document.querySelector("#ai-editorial-run-result") || button.closest("section")?.querySelector(".alert");
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Pruefung laeuft ...";
    if (output) output.innerHTML = `<div class="alert">${progressMarkup("KI-Redaktion startet sichere Pruefkette ...", 35)}</div>`;
    try {
      const result = await runAiEditorialTask(button.dataset.aiEditorialRun || "manual");
      if (output) {
        output.innerHTML = `<div class="alert ${result.ok ? "alert--success" : "alert--warning"}">${escapeHtml(result.message || "KI-Redaktion abgeschlossen.")}</div>`;
      }
      if (result.ok && result.articleId) {
        window.setTimeout(() => {
          window.location.hash = `#/cms/ai-editorial/editor?id=${encodeURIComponent(result.articleId)}`;
        }, 450);
      } else {
        window.setTimeout(render, 700);
      }
    } catch (error) {
      if (output) output.innerHTML = `<div class="alert alert--error">KI-Redaktion konnte nicht ausgefuehrt werden: ${escapeHtml(error.message || String(error))}</div>`;
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }));

  document.querySelectorAll("[data-ai-topic-research]").forEach((button) => button.addEventListener("click", async () => {
    const output = document.querySelector("#ai-topic-research-result") || document.querySelector("#ai-editorial-run-result");
    const panel = button.closest(".ai-topic-research-panel") || document;
    const category = panel.querySelector("#ai-topic-research-category")?.value || "";
    const keywords = panel.querySelector("#ai-topic-research-keywords")?.value || "";
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Recherchiere ...";
    const contextLabel = [category, keywords].filter(Boolean).join(" / ");
    if (output) output.innerHTML = `<div class="alert">${progressMarkup(`Themenrecherche erstellt 10 Vorschlaege${contextLabel ? ` fuer ${contextLabel}` : ""} ...`, 45)}</div>`;
    try {
      const result = await generateAiTopicSuggestions({ category, keywords });
      if (output) output.innerHTML = `<div class="alert alert--success">${escapeHtml(result.message || "Themenvorschlaege wurden erstellt.")}</div>`;
      window.setTimeout(render, 700);
    } catch (error) {
      if (output) output.innerHTML = `<div class="alert alert--error">Themenrecherche konnte nicht ausgefuehrt werden: ${escapeHtml(error.message || String(error))}</div>`;
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }));

  document.querySelector("#ai-topic-suggestions-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const output = document.querySelector("#ai-topic-research-result");
    const selectedIds = Array.from(form.querySelectorAll('input[name="topicSuggestionIds"]:checked')).map((input) => input.value);
    if (!selectedIds.length) {
      if (output) output.innerHTML = `<div class="alert alert--warning">Bitte mindestens ein Thema auswaehlen.</div>`;
      return;
    }
    const now = new Date().toISOString();
    try {
      const createdArticleIds = [];
      for (const id of selectedIds) {
        const suggestion = await getOne("ai_topic_suggestions", id);
        if (!suggestion) continue;
        const articleId = `ai-article-${crypto.randomUUID()}`;
        const cleanTitle = suggestion.headline || suggestion.title || "KI-Thema";
        const bodyText = draftArticleTextFromTopic(suggestion);
        const shortText = shortTextFromTopic(suggestion, bodyText);
        const generatedKeywords = localArticleKeywords({ ...suggestion, headline: cleanTitle, bodyText }, suggestion.keywords || []);
        const generatedSeo = localSeoPayload({ ...suggestion, headline: cleanTitle, bodyText, subline: suggestion.subline || "", slug: slugify(cleanTitle) }, generatedKeywords);
        const thumbnailIdea = suggestion.thumbnail_idea || suggestion.thumbnailIdea || `Redaktionelles Vorschaubild zum Thema ${suggestion.title || cleanTitle}.`;
        const thumbnailPrompt = [
          "Fotorealistisches redaktionelles 16:9-Vorschaubild fuer PROdigitalTV.",
          thumbnailIdea,
          "Serioeser moderner Business-Look, TV-, Streaming- und digitale Medienbranche, natuerliches Licht, keine echten Logos, keine realen Personen, keine Comic-Optik."
        ].join(" ");
        const thumbnailUrl = generateLocalEditorialThumbnail({
          headline: cleanTitle,
          title: cleanTitle,
          category: suggestion.category || "",
          primary_keyword: Array.isArray(suggestion.keywords) ? suggestion.keywords[0] || "" : ""
        });
        await upsert("editorialContent", {
          id: articleId,
          title: cleanTitle,
          headline: cleanTitle,
          subtitle: suggestion.subline || "",
          subline: suggestion.subline || "",
          introText: shortText,
          shortText,
          teaserText: shortText,
          bodyText,
          page: "news",
          section: "news",
          key: `news.${articleId}`,
          slug: generatedSeo.slug || articleId,
          seoTitle: generatedSeo.seoTitle,
          seo_title: generatedSeo.seo_title,
          seoDescription: generatedSeo.seoDescription,
          seo_description: generatedSeo.seo_description,
          seoKeywords: generatedSeo.seoKeywords,
          seo_keywords: generatedSeo.seo_keywords,
          category: suggestion.category || "",
          tags: generatedKeywords.map((item) => item.keyword),
          primary_keyword: generatedKeywords[0]?.keyword || "",
          keyword_json: generatedKeywords,
          thumbnail_idea: thumbnailIdea,
          thumbnail_prompt: thumbnailPrompt,
          thumbnail_url: thumbnailUrl,
          imageUrl: thumbnailUrl,
          source_status: "Recherche erforderlich",
          duplicate_status: suggestion.duplicate_status || "neu",
          ai_check_status: "Warnung",
          legal_check_status: "offen",
          publication_status: "Entwurf",
          status: "draft",
          visibility: "internal",
          relevance_score: Number(suggestion.relevance_score || suggestion.actuality_score || 0),
          author_type: "ai",
          author_name: "KI-Redaktion",
          publication_target: "news",
          topic_suggestion_id: id,
          ai_log_json: {
            manual_flow: true,
            source_note: "Quellen muessen im Editor mit echten URLs erfasst werden. Keine automatische Freigabe ohne mindestens zwei gepruefte Quellen.",
            note: "Aus redaktionell ausgewaehltem Themenvorschlag angelegt. Text, Quellen, Thumbnail, Audio, Keywords und Rubrik im Editor ausarbeiten."
          },
          createdAt: now,
          updatedAt: now
        });
        if (generatedKeywords.length) {
          await Promise.all(generatedKeywords.slice(0, 10).map((keyword, index) => upsert("article_keywords", {
            id: `article-keyword-${crypto.randomUUID()}`,
            article_id: articleId,
            keyword: keyword.keyword,
            keyword_type: keyword.keyword_type || (index === 0 ? "Hauptkeyword" : "Branchenkeyword"),
            relevance_score: keyword.relevance_score || (index === 0 ? 95 : 70),
            is_primary: Boolean(keyword.is_primary),
            explanation: keyword.explanation || "Aus redaktionell ausgewaehltem Themenvorschlag uebernommen.",
            ai_generated: true,
            manually_confirmed: false,
            created_at: now,
            updated_at: now
          })));
        }
        createdArticleIds.push(articleId);
        await upsert("ai_topic_queue", {
          ...suggestion,
          id: `ai-topic-queue-${suggestion.topic_key || id}`,
          suggestion_id: id,
          article_id: articleId,
          status: "Entwurf angelegt",
          queue_status: "uebernommen",
          queued_at: now,
          updated_at: now
        });
        await upsert("ai_topic_suggestions", {
          ...suggestion,
          queue_status: "uebernommen",
          status: "uebernommen",
          updated_at: now
        });
      }
      if (output) output.innerHTML = `<div class="alert alert--success">${createdArticleIds.length} Beitrag/Beitraege wurden als Entwurf angelegt. Die Beitragsliste wird geoeffnet.</div>`;
      window.setTimeout(() => { window.location.hash = "#/cms/ai-editorial/articles"; }, 700);
    } catch (error) {
      if (output) output.innerHTML = `<div class="alert alert--error">Queue konnte nicht aktualisiert werden: ${escapeHtml(error.message || String(error))}</div>`;
    }
  });

  document.querySelectorAll("[data-ai-import-local-drafts]").forEach((button) => button.addEventListener("click", async () => {
    const output = document.querySelector("#ai-editorial-run-result") || button.closest("section")?.querySelector(".alert");
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Importiere ...";
    try {
      const raw = localStorage.getItem("prodigitaltv-demo-db-official-assets-v3");
      const db = raw ? JSON.parse(raw) : {};
      const localArticles = (db.editorialContent || []).filter((item) => item.author_type === "ai"
        || item.authorType === "ai"
        || item.aiGenerated === true
        || item.source_snapshot_json
        || item.ai_log_json
        || item.publication_status);
      if (!localArticles.length) {
        if (output) output.innerHTML = `<div class="alert alert--warning">Keine lokalen KI-Entwuerfe im Browser-Speicher gefunden.</div>`;
        return;
      }
      const articleIds = new Set(localArticles.map((item) => item.id));
      await Promise.all(localArticles.map((article) => upsert("editorialContent", {
        ...article,
        migration_origin: article.migration_origin || "local_browser_storage",
        visibility: article.visibility || "internal",
        updatedAt: new Date().toISOString()
      })));
      const relatedCollections = ["article_sources", "article_keywords", "ai_editorial_logs"];
      for (const collection of relatedCollections) {
        const records = (db[collection] || []).filter((record) => articleIds.has(record.article_id || record.articleId));
        await Promise.all(records.map((record) => upsert(collection, record)));
      }
      if (output) output.innerHTML = `<div class="alert alert--success">${localArticles.length} lokale KI-Entwuerfe wurden importiert.</div>`;
      window.setTimeout(render, 700);
    } catch (error) {
      if (output) output.innerHTML = `<div class="alert alert--error">Import fehlgeschlagen: ${escapeHtml(error.message || String(error))}</div>`;
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }));

  document.querySelectorAll("[data-ai-editorial-automation]").forEach((button) => button.addEventListener("click", async () => {
    const enabled = button.dataset.aiEditorialAutomation === "start";
    const output = document.querySelector("#ai-editorial-run-result");
    try {
      const existing = (await getOne("settings", "aiEditorial")) || { id: "aiEditorial" };
      const settings = { ...existing, automationEnabled: enabled, updatedAt: new Date().toISOString() };
      const result = await saveAiEditorialSettings(settings);
      if (result.localOnly) await upsert("settings", settings);
      if (output) output.innerHTML = `<div class="alert alert--success">Automatisierung wurde ${enabled ? "aktiviert" : "pausiert"}.</div>`;
      window.setTimeout(render, 500);
    } catch (error) {
      if (output) output.innerHTML = `<div class="alert alert--error">${escapeHtml(error.message || String(error))}</div>`;
    }
  }));

  document.querySelector("#ai-editorial-settings-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const output = form.querySelector("#ai-editorial-settings-result");
    const values = formObject(form);
    const settings = {
      id: "aiEditorial",
      automationEnabled: Boolean(values.automationEnabled),
      allowAutoPublish: Boolean(values.allowAutoPublish),
      scheduleLabel: values.scheduleLabel || "Taeglich 06:00 Uhr",
      publicationMode: values.publicationMode || "draft_only",
      minimumSources: Number(values.minimumSources || 2),
      minimumTrustScore: Number(values.minimumTrustScore || 70),
      updatedAt: new Date().toISOString()
    };
    try {
      const result = await saveAiEditorialSettings(settings);
      if (result.localOnly) await upsert("settings", settings);
      if (output) output.innerHTML = `<div class="alert alert--success">KI-Redaktions-Einstellungen wurden gespeichert.</div>`;
    } catch (error) {
      if (output) output.innerHTML = `<div class="alert alert--error">${escapeHtml(error.message || String(error))}</div>`;
    }
  });

  document.querySelector("#ai-prompt-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const output = form.querySelector("#ai-prompt-result");
    let values = formObject(form);
    if (!String(values.name || "").trim() || !String(values.prompt_text || "").trim()) {
      values = { ...values, ...buildPromptFromSource(values) };
    }
    const existingPrompt = values.prompt_id ? await getOne("ai_prompts", values.prompt_id) : null;
    const promptId = values.prompt_id || `ai-prompts-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const nextVersion = existingPrompt ? Number(existingPrompt.version || 1) + 1 : 1;
    const prompt = {
      ...(existingPrompt || {}),
      id: promptId,
      name: values.name || "",
      prompt_type: values.prompt_type || "",
      description: values.description || "",
      prompt_text: values.prompt_text || "",
      system_instructions: values.system_instructions || "",
      output_format: values.output_format || "json",
      model: values.model || "gpt-4.1-mini",
      is_active: Boolean(values.is_active),
      temperature: Number(values.temperature || 0.2),
      max_tokens: Number(values.max_tokens || 1200),
      status: values.status || "Entwurf",
      version: nextVersion,
      created_at: existingPrompt?.created_at || existingPrompt?.createdAt || now,
      updated_at: now
    };
    try {
      await upsert("ai_prompts", prompt);
      await upsert("ai_prompt_versions", {
        id: `ai-prompt-versions-${crypto.randomUUID()}`,
        prompt_id: promptId,
        version: nextVersion,
        prompt_text: prompt.prompt_text,
        system_instructions: prompt.system_instructions,
        output_format: prompt.output_format || "json",
        model: prompt.model,
        temperature: prompt.temperature,
        max_tokens: prompt.max_tokens,
        change_note: values.change_note || "Erste Version im CMS angelegt.",
        status: prompt.status,
        created_at: now
      });
      if (output) output.innerHTML = `<div class="alert alert--success">Prompt wurde ${existingPrompt ? "aktualisiert" : "angelegt"} und als Version ${nextVersion} gespeichert.</div>`;
      form.reset();
      window.setTimeout(render, 700);
    } catch (error) {
      if (output) output.innerHTML = `<div class="alert alert--error">${escapeHtml(error.message || String(error))}</div>`;
    }
  });

  document.querySelectorAll("[data-ai-prompt-edit]").forEach((button) => button.addEventListener("click", async () => {
    const form = document.querySelector("#ai-prompt-form");
    const output = form?.querySelector("#ai-prompt-result");
    try {
      const prompt = await getOne("ai_prompts", button.dataset.aiPromptEdit);
      if (!prompt || !form) throw new Error("Prompt wurde nicht gefunden.");
      const values = {
        prompt_id: prompt.id,
        name: prompt.name || "",
        prompt_type: prompt.prompt_type || "",
        description: prompt.description || "",
        system_instructions: prompt.system_instructions || "",
        prompt_text: prompt.prompt_text || "",
        test_input_json: JSON.stringify(parsePromptTestInput(""), null, 2),
        model: prompt.model || "gpt-4.1-mini",
        temperature: prompt.temperature ?? 0.2,
        max_tokens: prompt.max_tokens ?? 1200,
        output_format: prompt.output_format || "json",
        status: prompt.status || "Entwurf",
        change_note: "",
        prompt_seed_text: prompt.prompt_text || prompt.description || "",
        prompt_seed_mode: "free_text",
        prompt_chat_template: ""
      };
      Object.entries(values).forEach(([name, value]) => {
        const field = form.elements[name];
        if (!field) return;
        if (field.type === "checkbox") field.checked = Boolean(value);
        else field.value = value;
      });
      form.querySelector("[data-prompt-meta-name]").textContent = prompt.name || "Neuer Prompt";
      form.querySelector("[data-prompt-meta-type]").textContent = prompt.prompt_type || "Prompt";
      form.querySelector("[data-prompt-meta-system]").textContent = `${prompt.model || "gpt-4.1-mini"} · Temp. ${prompt.temperature ?? 0.2} · ${prompt.max_tokens ?? 1200} Tokens`;
      if (form.elements.is_active) form.elements.is_active.checked = Boolean(prompt.is_active);
      form.querySelector(".ai-advanced-prompt-fields")?.setAttribute("open", "");
      form.scrollIntoView({ behavior: "smooth", block: "start" });
      if (output) output.innerHTML = `<div class="alert">Prompt geladen. Aendern und mit „Prompt speichern“ als neue Version sichern.</div>`;
    } catch (error) {
      if (output) output.innerHTML = `<div class="alert alert--error">${escapeHtml(error.message || String(error))}</div>`;
    }
  }));

  document.querySelector("[data-ai-prompt-select]")?.addEventListener("change", async (event) => {
    const select = event.currentTarget;
    const selected = select.selectedOptions?.[0];
    const form = document.querySelector("#ai-prompt-form");
    const output = form?.querySelector("#ai-prompt-result");
    if (!select.value || !selected) return;
    if (!form) return;
    if (selected.dataset.createType) {
      document.querySelector(`[data-ai-prompt-create-type="${CSS.escape(selected.dataset.createType)}"]`)?.click();
      return;
    }
    try {
      const prompt = await getOne("ai_prompts", select.value);
      if (!prompt) throw new Error("Prompt wurde nicht gefunden.");
      const values = {
        prompt_id: prompt.id,
        name: prompt.name || "",
        prompt_type: prompt.prompt_type || "",
        description: prompt.description || "",
        system_instructions: prompt.system_instructions || "",
        prompt_text: prompt.prompt_text || "",
        test_input_json: JSON.stringify(parsePromptTestInput(""), null, 2),
        model: prompt.model || "gpt-4.1-mini",
        temperature: prompt.temperature ?? 0.2,
        max_tokens: prompt.max_tokens ?? 1200,
        output_format: prompt.output_format || "json",
        status: prompt.status || "Entwurf",
        change_note: "",
        prompt_seed_text: prompt.prompt_text || prompt.description || "",
        prompt_seed_mode: "free_text",
        prompt_chat_template: ""
      };
      Object.entries(values).forEach(([name, value]) => {
        const field = form.elements[name];
        if (!field) return;
        if (field.type === "checkbox") field.checked = Boolean(value);
        else field.value = value;
      });
      const metaName = form.querySelector("[data-prompt-meta-name]");
      const metaType = form.querySelector("[data-prompt-meta-type]");
      const metaSystem = form.querySelector("[data-prompt-meta-system]");
      if (metaName) metaName.textContent = prompt.name || "Neuer Prompt";
      if (metaType) metaType.textContent = prompt.prompt_type || "Prompt";
      if (metaSystem) metaSystem.textContent = `${prompt.model || "gpt-4.1-mini"} - Temp. ${prompt.temperature ?? 0.2} - ${prompt.max_tokens ?? 1200} Tokens`;
      if (form.elements.is_active) form.elements.is_active.checked = Boolean(prompt.is_active);
      if (output) output.innerHTML = `<div class="alert">Prompt gewechselt. Die Ansicht wurde aktualisiert.</div>`;
    } catch (error) {
      if (output) output.innerHTML = `<div class="alert alert--error">${escapeHtml(error.message || String(error))}</div>`;
    }
  });

  document.querySelectorAll("[data-ai-prompt-create-type]").forEach((button) => button.addEventListener("click", () => {
    const form = document.querySelector("#ai-prompt-form");
    const output = form?.querySelector("#ai-prompt-result");
    if (!form) return;
    const type = button.dataset.aiPromptCreateType || "Beitragstext";
    const name = button.dataset.aiPromptCreateName || `${type} - KI-Redaktion`;
    const seedText = [
      `Die KI soll den Systemschritt "${name}" fuer die KI-Redaktion ausfuehren.`,
      "Sie soll nur mit CMS-Daten, geprueften Quellen und belegbaren Aussagen arbeiten.",
      "Wenn Quellen, Belege oder Dublettenstatus unklar sind, soll sie Warnungen ausgeben und keine Freigabe empfehlen."
    ].join(" ");
    const generated = buildPromptFromSource({
      prompt_type: type,
      prompt_seed_mode: "free_text",
      prompt_chat_template: "",
      prompt_seed_text: seedText
    });
    const values = {
      ...generated,
      prompt_id: "",
      name,
      prompt_type: type,
      prompt_seed_mode: "free_text",
      prompt_chat_template: "",
      prompt_seed_text: seedText
    };
    Object.entries(values).forEach(([fieldName, value]) => {
      const field = form.elements[fieldName];
      if (!field) return;
      if (field.type === "checkbox") field.checked = Boolean(value);
      else field.value = value;
    });
    form.querySelector("[data-prompt-meta-name]").textContent = name;
    form.querySelector("[data-prompt-meta-type]").textContent = type;
    form.querySelector("[data-prompt-meta-system]").textContent = `${values.model || "gpt-4.1-mini"} · Temp. ${values.temperature ?? 0.2} · ${values.max_tokens ?? 1200} Tokens`;
    form.querySelector(".ai-advanced-prompt-fields")?.setAttribute("open", "");
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    if (output) output.innerHTML = `<div class="alert">System-Prompt „${escapeHtml(name)}“ vorbereitet. Bitte testen und speichern.</div>`;
  }));

  document.querySelectorAll("[data-ai-prompt-delete]").forEach((button) => button.addEventListener("click", async () => {
    const promptId = button.dataset.aiPromptDelete;
    const output = document.querySelector("#ai-prompt-result");
    if (!window.confirm("Diesen Prompt vorsichtig archivieren? Er wird deaktiviert, Versionen und Tests bleiben erhalten. Der System-Fallback uebernimmt danach.")) return;
    try {
      const prompt = await getOne("ai_prompts", promptId);
      if (!prompt) throw new Error("Prompt wurde nicht gefunden.");
      await upsert("ai_prompts", {
        ...prompt,
        is_active: false,
        status: "archiviert",
        deleted_at: new Date().toISOString(),
        deleted_by: currentUser()?.email || currentUser()?.displayName || "local",
        updated_at: new Date().toISOString()
      });
      await upsert("ai_prompt_versions", {
        id: `ai-prompt-versions-${crypto.randomUUID()}`,
        prompt_id: promptId,
        version: Number(prompt.version || 1) + 1,
        prompt_text: prompt.prompt_text || "",
        system_instructions: prompt.system_instructions || "",
        output_format: prompt.output_format || "json",
        model: prompt.model || "gpt-4.1-mini",
        temperature: Number(prompt.temperature ?? 0.2),
        max_tokens: Number(prompt.max_tokens || 1200),
        change_note: "Prompt vorsichtig archiviert. System-Fallback bleibt aktiv.",
        status: "archiviert",
        created_at: new Date().toISOString(),
        created_by: currentUser()?.email || currentUser()?.displayName || "local"
      });
      if (output) output.innerHTML = `<div class="alert alert--success">Prompt wurde archiviert. Versionen und Tests bleiben erhalten; der Fallback-Prompt uebernimmt.</div>`;
      window.setTimeout(render, 500);
    } catch (error) {
      if (output) output.innerHTML = `<div class="alert alert--error">${escapeHtml(error.message || String(error))}</div>`;
    }
  }));

  document.querySelector("[data-ai-prompt-generate-from-source]")?.addEventListener("click", (event) => {
    const form = event.currentTarget.closest("form");
    const output = form?.querySelector("#ai-prompt-result");
    if (!form) return;
    const values = formObject(form);
    const generated = buildPromptFromSource(values);
    Object.entries(generated).forEach(([name, value]) => {
      const field = form.elements[name];
      if (!field) return;
      field.value = value;
    });
    form.querySelector(".ai-advanced-prompt-fields")?.setAttribute("open", "");
    if (output) {
      output.innerHTML = `<div class="alert alert--success">Die Eingabe wurde vorbereitet. Die technischen Felder sind automatisch gefuellt und koennen bei Bedarf angepasst werden.</div>`;
    }
  });

  document.querySelector("[data-ai-prompt-test]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const form = button.closest("form");
    const output = form?.querySelector("#ai-prompt-result");
    const values = formObject(form);
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Teste ...";
    try {
      const now = new Date().toISOString();
      const testInput = parsePromptTestInput(values.test_input_json);
      const renderedPrompt = renderPromptPreview(values.prompt_text, testInput);
      const unresolvedPlaceholders = renderedPrompt.match(/\{\{[^}]+\}\}/g) || [];
      const warnings = [
        ...evaluatePromptSafety(values, testInput),
        ...unresolvedPlaceholders.map((placeholder) => `Platzhalter nicht ersetzt: ${placeholder}`)
      ];
      const testStatus = warnings.length ? "Warnung" : "bestanden";
      const promptId = values.name ? `test-${slugify(values.name)}` : `test-prompt-${crypto.randomUUID()}`;
      await upsert("ai_prompt_tests", {
        id: `ai-prompt-test-${crypto.randomUUID()}`,
        prompt_id: promptId,
        prompt_name: values.name || "Unbenannter Prompt",
        prompt_version_id: "",
        test_input_json: testInput,
        test_output_json: {
          rendered_prompt_preview: limitText(renderedPrompt, 1200),
          output_format: values.output_format || "json",
          model: values.model || "",
          safety_result: testStatus
        },
        test_status: testStatus,
        warnings_json: warnings,
        created_at: now,
        created_by: currentUser()?.email || currentUser()?.displayName || "local"
      });
      if (output) {
        output.innerHTML = `<div class="alert ${warnings.length ? "alert--warning" : "alert--success"}"><strong>Prompt-Test: ${escapeHtml(testStatus)}</strong><br>${escapeHtml(warnings.length ? warnings.join(", ") : "Platzhalter ersetzt, Schutzregeln erkannt.")}</div>`;
      }
      window.setTimeout(render, 900);
    } catch (error) {
      if (output) output.innerHTML = `<div class="alert alert--error">${escapeHtml(error.message || String(error))}</div>`;
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  });

  document.querySelectorAll("[data-ai-source-review]").forEach((button) => button.addEventListener("click", async () => {
    const output = document.querySelector("#ai-source-review-result");
    try {
      const source = await getOne("verified_sources", button.dataset.aiSourceReview);
      await upsert("verified_sources", {
        ...source,
        review_status: button.dataset.reviewStatus || "in Pruefung",
        updated_at: new Date().toISOString()
      });
      if (output) output.innerHTML = `<div class="alert alert--success">Quellenvorschlag wurde aktualisiert.</div>`;
      window.setTimeout(render, 500);
    } catch (error) {
      if (output) output.innerHTML = `<div class="alert alert--error">${escapeHtml(error.message || String(error))}</div>`;
    }
  }));

  document.querySelectorAll("[data-ai-article-action]").forEach((button) => button.addEventListener("click", async () => {
    const output = document.querySelector("#ai-article-action-result");
    const articleId = button.dataset.articleId;
    const action = button.dataset.aiArticleAction;
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Pruefe ...";
    try {
      const article = await getOne("editorialContent", articleId);
      if (!article) throw new Error("Artikel wurde nicht gefunden.");
      if (/^Themenvorschlag:\s*/i.test(String(article.title || article.headline || ""))) {
        await upsert("editorialContent", {
          ...article,
          title: String(article.title || "").replace(/^Themenvorschlag:\s*/i, ""),
          headline: String(article.headline || article.title || "").replace(/^Themenvorschlag:\s*/i, ""),
          updatedAt: new Date().toISOString()
        });
        article.title = String(article.title || "").replace(/^Themenvorschlag:\s*/i, "");
        article.headline = String(article.headline || article.title || "").replace(/^Themenvorschlag:\s*/i, "");
      }
      const sources = (await list("article_sources")).filter((source) => source.article_id === articleId || source.articleId === articleId);
      const keywords = (await list("article_keywords")).filter((keyword) => keyword.article_id === articleId || keyword.articleId === articleId);
      const hasEnoughSources = sources.filter((source) => source.check_status === "geprueft" && Number(source.trust_score || 0) >= 70).length >= 2;
      const duplicateBlocked = String(article.duplicate_status || "").toLowerCase().includes("dublette");
      let update = { updatedAt: new Date().toISOString() };
      let message = "";
      let status = "warning";

      if (action === "preview") {
        window.location.hash = `#/news/${articleId}`;
        return;
      }

      if (action === "reviewRelease") {
        const editForm = document.querySelector("#ai-article-edit-form");
        const formValues = editForm?.dataset.articleId === articleId ? formObject(editForm) : {};
        const mergedArticle = { ...article, ...formValues };
        const unresolvedDraft = /sicherer Themenvorschlag|lokale KI-Redaktion|Noch keine finale zentrale Aussage|Arbeitsentwurf|Belegstellen fehlen/i.test(String(mergedArticle.bodyText || ""));
        const checkedSources = sources.filter((source) => source.check_status === "geprueft" && Number(source.trust_score || 0) >= 70);
        const blockers = [
          checkedSources.length >= 2 ? "" : "Mindestens zwei gepruefte Quellen mit Trust-Score ab 70 fehlen.",
          duplicateBlocked ? "Dublettenstatus blockiert die Freigabe." : "",
          mergedArticle.headline || mergedArticle.title ? "" : "Headline fehlt.",
          mergedArticle.subline || mergedArticle.subtitle ? "" : "Subline fehlt.",
          mergedArticle.bodyText || mergedArticle.body ? "" : "Haupttext fehlt.",
          mergedArticle.primary_keyword || keywords.length ? "" : "Keywords fehlen.",
          unresolvedDraft ? "Arbeitsentwurf oder fehlende Belegstellen im Text erkannt." : ""
        ].filter(Boolean);
        const publicationTarget = formValues.publication_target || article.publication_target || "news";
        const targetLabel = publicationTarget === "monthly_topic" ? "Thema des Monats" : publicationTarget === "topic" ? "Langfristiges Thema" : "Daily News / News";
        document.querySelector(".ai-dialog-backdrop")?.remove();
        const wrapper = document.createElement("div");
        wrapper.className = "ai-dialog-backdrop";
        wrapper.innerHTML = `<div class="ai-dialog ai-release-dialog" role="dialog" aria-modal="true">
          <div class="actions" style="justify-content:space-between"><div><p class="eyebrow">Freigabepruefung</p><h2>${escapeHtml(mergedArticle.headline || mergedArticle.title || "KI-Beitrag")}</h2></div><button type="button" class="link-button" data-ai-close>Schliessen</button></div>
          <div class="ai-release-grid">
            <section class="ai-release-card"><h3>Pflichtstatus</h3><div class="ai-status-stack"><span class="ai-status ${checkedSources.length >= 2 ? "ai-status--success" : "ai-status--danger"}">Quellen ${checkedSources.length}/2</span><span class="ai-status ${duplicateBlocked ? "ai-status--danger" : "ai-status--success"}">${duplicateBlocked ? "Dublette" : "Keine Dublette"}</span><span class="ai-status ${blockers.length ? "ai-status--warning" : "ai-status--success"}">${blockers.length ? "Pruefpflichtig" : "Freigabefaehig"}</span></div></section>
            <section class="ai-release-card"><h3>Veroeffentlichungsziel</h3><p>${escapeHtml(targetLabel)}</p><small>Veroeffentlicht wird danach im Meta-Bereich oder ueber die redaktionelle News-/Themenverwaltung.</small></section>
            <section class="ai-release-card"><h3>Quellen</h3>${sources.length ? sources.map((source) => `<p><strong>${escapeHtml(source.publisher || source.title || "Quelle")}</strong><br><small>${escapeHtml(source.domain || source.url || "")} · Trust ${Number(source.trust_score || 0)} · ${escapeHtml(source.check_status || "ungeprueft")}</small></p>`).join("") : `<p class="muted">Keine Quellen gespeichert.</p>`}</section>
            <section class="ai-release-card"><h3>Keywords</h3>${keywords.length ? `<div class="ai-keyword-cloud">${keywords.slice(0, 8).map((keyword) => `<span>${escapeHtml(keyword.keyword)} <strong>${Number(keyword.relevance_score || 0)}</strong></span>`).join("")}</div>` : `<p class="muted">Keine Keywords gespeichert.</p>`}</section>
          </div>
          ${blockers.length ? `<div class="alert alert--warning"><strong>Freigabe noch blockiert:</strong><ul>${blockers.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>` : `<div class="alert alert--success">Alle zentralen Freigaberegeln sind erfuellt. Der Beitrag kann redaktionell freigegeben werden.</div>`}
          <div class="actions"><button type="button" class="button button--primary" data-ai-release-confirm ${blockers.length ? "disabled" : ""}>Freigabe setzen</button><button type="button" class="button button--secondary" data-ai-close>Zurueck zum Editor</button></div>
        </div>`;
        document.body.appendChild(wrapper);
        wrapper.querySelectorAll("[data-ai-close]").forEach((item) => item.addEventListener("click", () => wrapper.remove()));
        wrapper.querySelector("[data-ai-release-confirm]")?.addEventListener("click", async (event) => {
          const confirmButton = event.currentTarget;
          confirmButton.disabled = true;
          confirmButton.textContent = "Speichere ...";
          const now = new Date().toISOString();
          await upsert("editorialContent", {
            ...article,
            title: formValues.headline || article.title || article.headline || "",
            headline: formValues.headline || article.headline || article.title || "",
            subtitle: formValues.subline || article.subline || article.subtitle || "",
            subline: formValues.subline || article.subline || article.subtitle || "",
            bodyText: formValues.bodyText || article.bodyText || article.body || "",
            introText: formValues.introText || article.introText || article.shortText || "",
            source_status: "geprueft",
            ai_check_status: "bestanden",
            publication_status: "freigegeben",
            final_check_json: { status: "bestanden", blockers: [], checked_at: now },
            updatedAt: now
          });
          await writeAiArticleLog(articleId, "success", "Beitrag wurde ueber Freigabe-Overlay redaktionell freigegeben.", {
            usedSources: sources,
            sourceCheck: { source_status: "geprueft", checkedSources: checkedSources.length },
            keywordResult: keywords,
            aiCheck: { status: "bestanden" }
          });
          const dialog = wrapper.querySelector(".ai-dialog");
          if (dialog) {
            dialog.innerHTML = `<div class="alert alert--success"><strong>OK.</strong> Freigabe wurde gesetzt.</div>`;
          }
          if (output) output.innerHTML = `<div class="alert alert--success">Beitrag wurde freigegeben. Veroeffentlichen erfolgt im Meta-Bereich oder spaeter in der Redaktion.</div>`;
          window.setTimeout(() => {
            wrapper.remove();
            render();
          }, 850);
        });
        return;
      }

      if (action === "sources") {
        update.source_status = hasEnoughSources ? "geprueft" : "unzureichend";
        message = hasEnoughSources ? "Quellenpruefung bestanden." : "Quellenlage unzureichend - mindestens zwei gepruefte Quellen mit Trust-Score ab 70 erforderlich.";
        status = hasEnoughSources ? "success" : "blocked";
      }

      if (action === "mapClaims") {
        if (!sources.length) {
          update.source_status = "unzureichend";
          message = "Keine Quellen vorhanden, Belege koennen nicht zugeordnet werden.";
          status = "blocked";
        } else {
          const bodyLead = String(article.bodyText || article.body || "").split(/[.!?]\s/).filter(Boolean).slice(0, 2).join(". ");
          await Promise.all(sources.map((source, index) => upsert("article_sources", {
            ...source,
            claim_reference: source.claim_reference && source.claim_reference !== "Noch keine finale zentrale Aussage erzeugt."
              ? source.claim_reference
              : index === 0
                ? (bodyLead || "Einordnung des Themas fuer die digitale Medienwirtschaft.")
                : "Branchenrelevanz, technische oder regulatorische Einordnung.",
            relevance_note: source.relevance_note || "Quelle wurde dem Artikel fuer die redaktionelle Belegpruefung zugeordnet.",
            check_status: Number(source.trust_score || 0) >= 70 ? "geprueft" : "teilweise geprueft",
            updated_at: new Date().toISOString()
          })));
          update.source_status = hasEnoughSources ? "geprueft" : "teilweise geprueft";
          update.publication_status = article.publication_status === "veroeffentlicht" ? article.publication_status : "pruefpflichtig";
          message = "Belegstellen wurden den Quellen zugeordnet. Bitte danach KI-Pruefung starten.";
          status = hasEnoughSources ? "success" : "warning";
        }
      }

      if (action === "keywords") {
        const editForm = document.querySelector("#ai-article-edit-form");
        const formValues = editForm?.dataset.articleId === articleId ? formObject(editForm) : {};
        const generatedKeywords = localArticleKeywords({ ...article, ...formValues }, article.tags || []);
        const fallbackKeywords = generatedKeywords.length ? generatedKeywords : localArticleKeywords(article, ["TV", "Streaming", "Medienbranche", "Produktion", "Plattformregulierung"]);
        const existing = new Set(keywords.map((keyword) => String(keyword.keyword || "").toLowerCase()));
        const keywordsToSave = fallbackKeywords.filter((keyword) => !existing.has(String(keyword.keyword || keyword).toLowerCase()));
        await Promise.all(keywordsToSave.map((keyword, index) => upsert("article_keywords", {
          id: `article-keyword-${crypto.randomUUID()}`,
          article_id: articleId,
          keyword: keyword.keyword || keyword,
          keyword_type: keyword.keyword_type || (index === 0 ? "Hauptkeyword" : "Branchenkeyword"),
          relevance_score: keyword.relevance_score || (index === 0 ? 95 : 72),
          is_primary: Boolean(keyword.is_primary || index === 0),
          explanation: keyword.explanation || "Automatisch aus Artikelinhalt nacherzeugt.",
          ai_generated: true,
          manually_confirmed: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })));
        update.primary_keyword = article.primary_keyword || fallbackKeywords[0]?.keyword || fallbackKeywords[0] || "";
        update.tags = Array.from(new Set([...(Array.isArray(article.tags) ? article.tags : []), ...fallbackKeywords.map((keyword) => keyword.keyword || keyword)]));
        update.keyword_json = fallbackKeywords;
        const seoPayload = localSeoPayload({ ...article, ...formValues }, fallbackKeywords);
        update.seoKeywords = seoPayload.seoKeywords;
        update.seo_keywords = seoPayload.seo_keywords;
        const keywordCloud = document.querySelector("#ai-editor-section-keywords .ai-keyword-cloud");
        if (keywordCloud) {
          keywordCloud.innerHTML = fallbackKeywords.map((keyword) => `<span>${escapeHtml(keyword.keyword || keyword)} <strong>${Number(keyword.relevance_score || 70)}</strong></span>`).join("");
        }
        message = `${keywordsToSave.length ? keywordsToSave.length : fallbackKeywords.length} Keywords wurden automatisch erzeugt und gespeichert.`;
        status = "success";
      }

      if (action === "thumbnail") {
        if (output) output.innerHTML = `<div class="alert">${progressMarkup("Thumbnail wird erzeugt ...", 45)}</div>`;
        const editForm = document.querySelector("#ai-article-edit-form");
        const formValues = editForm?.dataset.articleId === articleId ? formObject(editForm) : {};
        const articleForThumbnail = {
          ...article,
          thumbnail_idea: formValues.thumbnail_idea || article.thumbnail_idea || article.thumbnailIdea || "",
          thumbnail_prompt: formValues.thumbnail_prompt || article.thumbnail_prompt || article.thumbnailPrompt || "",
          headline: formValues.headline || article.headline || article.title || "",
          title: formValues.headline || article.title || article.headline || "",
          subline: formValues.subline || article.subline || article.subtitle || "",
          category: formValues.category || article.category || ""
        };
        let thumbnailUrl = "";
        let generatedPrompt = articleForThumbnail.thumbnail_prompt || "";
        try {
          const generated = await generateAiEditorialThumbnail(articleForThumbnail);
          thumbnailUrl = generated?.imageDataUrl || "";
          generatedPrompt = generated?.prompt || generatedPrompt;
        } catch (thumbnailError) {
          console.warn("KI-Thumbnail nicht verfuegbar, lokaler Fallback wird genutzt.", thumbnailError);
        }
        if (!thumbnailUrl || isOversizedInlineImage(thumbnailUrl)) thumbnailUrl = generateLocalEditorialThumbnail(articleForThumbnail);
        update.imageUrl = thumbnailUrl;
        update.thumbnail_url = thumbnailUrl;
        update.thumbnail_idea = articleForThumbnail.thumbnail_idea || "Serioeses redaktionelles Vorschaubild fuer die digitale Medienwirtschaft.";
        update.thumbnail_prompt = generatedPrompt || defaultAiEditorialThumbnailPrompt;
        update.publication_status = article.publication_status === "veroeffentlicht" ? article.publication_status : "pruefpflichtig";
        message = "Thumbnail wurde lokal erzeugt und am Artikel gespeichert.";
        status = "success";
      }

      if (action === "seo") {
        const editForm = document.querySelector("#ai-article-edit-form");
        const formValues = editForm?.dataset.articleId === articleId ? formObject(editForm) : {};
        const generatedKeywords = keywords.length ? keywords : localArticleKeywords({ ...article, ...formValues }, article.tags || []);
        Object.assign(update, localSeoPayload({ ...article, ...formValues }, generatedKeywords));
        update.publication_status = article.publication_status === "veroeffentlicht" ? article.publication_status : "pruefpflichtig";
        message = "SEO-Titel, Meta-Beschreibung, Slug und SEO-Keywords wurden automatisch erzeugt.";
        status = "success";
      }

      if (action === "draftText") {
        update.bodyText = safeLocalArticleDraft(article, sources, keywords);
        update.ai_check_status = "Warnung";
        update.publication_status = "pruefpflichtig";
        update.final_check_json = {
          status: "Warnung",
          blockers: ["claim_level_source_mapping_required", "manual_review_required"],
          note: "Lokaler Arbeitsentwurf erzeugt. Keine Veroeffentlichung ohne Aussage-zu-Quelle-Pruefung."
        };
        message = "Redaktioneller Arbeitsentwurf wurde vorbereitet. Veroeffentlichung bleibt bis zur Belegstellenpruefung blockiert.";
        status = "warning";
      }

      if (action === "headline") {
        const editForm = document.querySelector("#ai-article-edit-form");
        const formValues = editForm?.dataset.articleId === articleId ? formObject(editForm) : {};
        const bodyLead = String(formValues.bodyText || article.bodyText || article.body || "").split(/(?<=[.!?])\s+/).find(Boolean) || "";
        const rawHeadline = String(formValues.headline || article.headline || article.title || bodyLead || article.category || "PROdigitalTV Beitrag").replace(/^Themenvorschlag:\s*/i, "");
        const cleanHeadline = limitText(rawHeadline, 72);
        update.title = cleanHeadline;
        update.headline = cleanHeadline;
        update.slug = article.slug || slugify(cleanHeadline);
        update.publication_status = article.publication_status === "veroeffentlicht" ? article.publication_status : "pruefpflichtig";
        message = "Headline wurde vorbereitet.";
        status = "success";
      }

      if (action === "optimizeText") {
        const optimized = optimizeLocalEditorialText(article.bodyText || article.body || "");
        if (!optimized) {
          message = "Textoptimierung nicht moeglich: Beitragstext fehlt.";
          status = "blocked";
        } else {
          update.bodyText = optimized;
          update.ai_check_status = "Warnung";
          update.publication_status = article.publication_status === "veroeffentlicht" ? article.publication_status : "pruefpflichtig";
          message = "Text wurde redaktionell geglaettet. Bitte Pruefung erneut starten.";
          status = "success";
        }
      }

      if (action === "summary") {
        const summary = summarizeLocalEditorialText(article);
        update.subline = summary;
        update.subtitle = summary;
        update.seoDescription = localSeoDescription({ ...article, subline: summary });
        update.seo_description = update.seoDescription;
        update.ai_check_status = "Warnung";
        update.publication_status = article.publication_status === "veroeffentlicht" ? article.publication_status : "pruefpflichtig";
        message = "Zusammenfassung wurde als Subline und Meta-Beschreibung vorbereitet.";
        status = "success";
      }

      if (action === "confirmClaims") {
        if (!hasEnoughSources) {
          update.source_status = "unzureichend";
          update.publication_status = "gesperrt wegen Quellenlage";
          update.ai_check_status = "nicht bestanden";
          message = "Belegpruefung blockiert: Es fehlen mindestens zwei gepruefte Quellen.";
          status = "blocked";
        } else {
          const cleanBody = String(article.bodyText || "")
            .replace(/Dieser Arbeitsentwurf fasst noch keine externen Fakten als gesichert zusammen\.?\s*/i, "")
            .replace(/Dieser Text ist deshalb nur ein redaktioneller Arbeitsentwurf\. Belegstellen fehlen noch auf Aussage-Ebene\.?\s*/i, "")
            .replace(/Eine automatische Veroeffentlichung bleibt blockiert, bis Quellen, Dubletten, Keywords, KI-Pruefung und redaktionelle Freigabe vollstaendig bestanden sind\.?/i, "Die Redaktion hat die Belegstellen im CMS geprueft. Die Veroeffentlichung bleibt an die weiteren Statuspruefungen gebunden.");
          update.bodyText = cleanBody;
          update.source_status = "geprueft";
          update.final_check_json = {
            status: "Belege redaktionell bestaetigt",
            blockers: [],
            note: "Manuelle Bestaetigung im lokalen CMS-Workflow."
          };
          message = "Belegpruefung wurde manuell bestaetigt. Starte danach KI-Pruefung und Freigabe.";
          status = "success";
        }
      }

      if (action === "check") {
        const unresolvedDraft = /sicherer Themenvorschlag|lokale KI-Redaktion|Noch keine finale zentrale Aussage|Arbeitsentwurf|Belegstellen fehlen/i.test(String(article.bodyText || ""));
        const blockers = [
          hasEnoughSources ? "" : "Quellenlage unzureichend",
          duplicateBlocked ? "Dublette erkannt" : "",
          article.bodyText ? "" : "Beitragstext fehlt",
          unresolvedDraft ? "Aussage-zu-Quelle-Pruefung fehlt" : "",
          article.headline || article.title ? "" : "Headline fehlt",
          article.subline || article.subtitle ? "" : "Subline fehlt",
          article.primary_keyword || keywords.length ? "" : "Keywords fehlen"
        ].filter(Boolean);
        update.source_status = hasEnoughSources ? "geprueft" : "unzureichend";
        update.ai_check_status = blockers.length ? "Warnung" : "bestanden";
        update.publication_status = blockers.length ? "pruefpflichtig" : "freigegeben";
        message = blockers.length ? `KI-Pruefung mit Warnungen: ${blockers.join(", ")}.` : "KI-Pruefung bestanden. Beitrag kann freigegeben werden.";
        status = blockers.length ? "warning" : "success";
      }

      if (action === "approve") {
        const unresolvedDraft = /sicherer Themenvorschlag|lokale KI-Redaktion|Noch keine finale zentrale Aussage|Arbeitsentwurf|Belegstellen fehlen/i.test(String(article.bodyText || ""));
        if (!hasEnoughSources || duplicateBlocked || unresolvedDraft) {
          update.publication_status = !hasEnoughSources ? "gesperrt wegen Quellenlage" : duplicateBlocked ? "gesperrt wegen Dublette" : "pruefpflichtig";
          update.ai_check_status = "nicht bestanden";
          message = !hasEnoughSources ? "Freigabe blockiert: Quellenlage unzureichend." : duplicateBlocked ? "Freigabe blockiert: Dublette erkannt." : "Freigabe blockiert: Aussage-zu-Quelle-Pruefung fehlt.";
          status = "blocked";
        } else {
          update.source_status = "geprueft";
          update.ai_check_status = "bestanden";
          update.publication_status = "freigegeben";
          message = "Beitrag wurde freigegeben.";
          status = "success";
        }
      }

      if (action === "publish") {
        const editForm = document.querySelector("#ai-article-edit-form");
        const formValues = editForm?.dataset.articleId === articleId ? formObject(editForm) : {};
        const publicationTarget = formValues.publication_target || article.publication_target || article.publicationTarget || "news";
        const candidate = { ...article, ...update };
        if (!articleCanPublish(candidate)) {
          update.publication_status = "pruefpflichtig";
          message = "Veroeffentlichung blockiert: Es fehlen noch bestandene Pruefungen oder Pflichtfelder.";
          status = "blocked";
        } else if (publicationTarget === "topic" || publicationTarget === "monthly_topic") {
          const cleanTitle = String(formValues.headline || article.headline || article.title || "KI-Thema").replace(/^Themenvorschlag:\s*/i, "").trim();
          const topicId = article.published_topic_id || article.topic_id || article.slug || slugify(cleanTitle) || `ki-topic-${crypto.randomUUID()}`;
          await upsert("topics", {
            id: topicId,
            title: cleanTitle,
            subtitle: formValues.subline || article.subline || article.subtitle || "",
            shortDescription: formValues.introText || article.introText || article.shortText || formValues.subline || article.subline || article.subtitle || "",
            longDescription: formValues.bodyText || article.bodyText || article.body || "",
            introText: formValues.introText || article.introText || article.shortText || "",
            shortText: formValues.introText || article.introText || article.shortText || "",
            category: formValues.category || article.category || "Thema",
            imageUrl: article.imageUrl || article.thumbnail_url || article.thumbnailUrl || "",
            galleryId: article.galleryId || "",
            status: "active",
            visibility: "public",
            publishDate: new Date().toISOString().slice(0, 10),
            validFrom: new Date().toISOString().slice(0, 10),
            sourceAiArticleId: articleId,
            editorialFormat: publicationTarget,
            isMonthlyTopic: publicationTarget === "monthly_topic",
            tags: Array.isArray(article.tags) ? article.tags : [],
            updatedAt: new Date().toISOString()
          });
          update.status = "draft";
          update.visibility = "internal";
          update.publication_target = publicationTarget;
          update.published_topic_id = topicId;
          update.publication_status = "veroeffentlicht";
          update.published_at = new Date().toISOString();
          message = publicationTarget === "monthly_topic" ? "Beitrag wurde als Thema des Monats veroeffentlicht." : "Beitrag wurde als langfristiges Thema veroeffentlicht.";
          status = "success";
        } else {
          update.status = "published";
          update.visibility = "public";
          update.page = "news";
          update.section = "news";
          update.key = article.key || `news.${articleId}`;
          update.introText = formValues.introText || article.introText || article.shortText || "";
          update.shortText = formValues.introText || article.introText || article.shortText || "";
          update.teaserText = formValues.introText || article.introText || article.shortText || "";
          update.publication_target = "news";
          update.publication_status = "veroeffentlicht";
          update.published_at = new Date().toISOString();
          update.publishDate = new Date().toISOString().slice(0, 10);
          message = "Beitrag wurde als News veroeffentlicht.";
          status = "success";
        }
      }

      if (action === "block") {
        update.status = "draft";
        update.visibility = "internal";
        update.publication_status = "gesperrt wegen redaktioneller Pruefung";
        update.ai_check_status = "nicht bestanden";
        message = "Beitrag wurde gesperrt.";
        status = "blocked";
      }

      await upsert("editorialContent", { ...article, ...update });
      await writeAiArticleLog(articleId, status, message, {
        usedSources: sources,
        sourceCheck: { source_status: update.source_status || article.source_status || "", checkedSources: sources.length },
        duplicateCheck: { duplicate_status: article.duplicate_status || "" },
        keywordResult: keywords,
        aiCheck: { status: update.ai_check_status || article.ai_check_status || "" }
      });
      if (output) output.innerHTML = `<div class="alert ${status === "success" ? "alert--success" : status === "blocked" ? "alert--error" : "alert--warning"}">${escapeHtml(message)}</div>`;
      window.setTimeout(render, 700);
    } catch (error) {
      if (output) output.innerHTML = `<div class="alert alert--error">${escapeHtml(error.message || String(error))}</div>`;
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }));

  document.querySelector("#ai-article-edit-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const output = form.querySelector("#ai-article-save-result");
    const articleId = form.dataset.articleId;
    const values = formObject(form);
    const cleanHeadline = String(values.headline || "").replace(/^Themenvorschlag:\s*/i, "").trim();
    try {
      const article = await getOne("editorialContent", articleId);
      if (!article) throw new Error("Artikel wurde nicht gefunden.");
      const updated = {
        ...article,
        title: cleanHeadline,
        headline: cleanHeadline,
        subtitle: values.subline || "",
        subline: values.subline || "",
        category: values.category || "",
        publication_target: values.publication_target || article.publication_target || "news",
        page: article.page || "news",
        section: article.section || "news",
        key: article.key || `news.${articleId}`,
        primary_keyword: values.primary_keyword || "",
        bodyText: values.bodyText || "",
        introText: values.introText || "",
        shortText: values.introText || "",
        teaserText: values.introText || "",
        thumbnail_idea: values.thumbnail_idea || "",
        thumbnail_prompt: values.thumbnail_prompt || "",
        slug: values.slug || slugify(cleanHeadline),
        seoTitle: values.seoTitle || "",
        seo_title: values.seoTitle || "",
        seoDescription: values.seoDescription || "",
        seo_description: values.seoDescription || "",
        seoKeywords: values.seoKeywords || "",
        seo_keywords: values.seoKeywords || "",
        publication_status: article.publication_status === "veroeffentlicht" ? article.publication_status : "pruefpflichtig",
        ai_check_status: article.publication_status === "veroeffentlicht" ? article.ai_check_status : "Warnung",
        updatedAt: new Date().toISOString()
      };
      await upsert("editorialContent", updated);
      await writeAiArticleLog(articleId, "warning", "Artikel wurde manuell bearbeitet und wieder auf pruefpflichtig gesetzt.", {
        aiCheck: { status: updated.ai_check_status },
        sourceCheck: { source_status: updated.source_status || "" }
      });
      if (output) output.innerHTML = `<div class="alert alert--success">Aenderungen gespeichert. Bitte Pruefung erneut starten.</div>`;
      form.dispatchEvent(new CustomEvent("cms-form-saved", { detail: { id: articleId } }));
      window.setTimeout(render, 700);
    } catch (error) {
      if (output) output.innerHTML = `<div class="alert alert--error">${escapeHtml(error.message || String(error))}</div>`;
      form.dispatchEvent(new CustomEvent("cms-form-save-failed", { detail: { error } }));
    }
  });

  document.querySelector("#ai-article-source-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const output = form.querySelector("#ai-source-save-result");
    const articleId = form.dataset.articleId;
    const values = formObject(form);
    const url = String(values.url || "").trim();
    const domain = domainFromUrl(url);
    if (!domain) {
      if (output) output.innerHTML = `<div class="alert alert--error">Bitte eine gueltige URL eintragen. Quellen duerfen nicht erfunden werden.</div>`;
      return;
    }
    try {
      const now = new Date().toISOString();
      await upsert("article_sources", {
        id: `article-source-${crypto.randomUUID()}`,
        article_id: articleId,
        title: values.title || "",
        publisher: values.publisher || "",
        domain,
        url,
        source_type: values.source_type || "Quelle",
        published_at: "",
        accessed_at: now,
        relevance_note: values.relevance_note || "",
        claim_reference: values.claim_reference || "",
        trust_score: Number(values.trust_score || 0),
        check_status: values.check_status || "ungeprueft",
        created_at: now,
        updated_at: now
      });

      const article = await getOne("editorialContent", articleId);
      const articleSources = (await list("article_sources")).filter((source) => source.article_id === articleId || source.articleId === articleId);
      const checkedSources = articleSources.filter((source) => source.check_status === "geprueft" && Number(source.trust_score || 0) >= 70);
      const sourceStatus = checkedSources.length >= 2 ? "geprueft" : articleSources.length ? "teilweise geprueft" : "Recherche erforderlich";

      await upsert("editorialContent", {
        ...(article || { id: articleId }),
        source_status: sourceStatus,
        publication_status: article?.publication_status === "veroeffentlicht" ? article.publication_status : "pruefpflichtig",
        ai_check_status: article?.ai_check_status === "bestanden" && checkedSources.length >= 2 ? article.ai_check_status : "Warnung",
        updatedAt: now
      });
      await writeAiArticleLog(articleId, "warning", "Quelle wurde manuell erfasst. Quellenstatus aktualisiert.", {
        usedSources: articleSources,
        sourceCheck: { source_status: sourceStatus, checkedSources: checkedSources.length }
      });
      if (output) {
        output.innerHTML = `<div class="alert alert--success">Quelle gespeichert. ${checkedSources.length >= 2 ? "Quellenstatus ist geprueft." : "Fuer die Freigabe sind mindestens zwei gepruefte Quellen mit Trust-Score ab 70 noetig."}</div>`;
      }
      form.reset();
      window.setTimeout(render, 700);
    } catch (error) {
      if (output) output.innerHTML = `<div class="alert alert--error">Quelle konnte nicht gespeichert werden: ${escapeHtml(error.message || String(error))}</div>`;
    }
  });

  document.querySelector("#ai-settings-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const firebase = await import("./firebase/firebaseClient.js").then((module) => module.getFirebaseServices());
    const payload = formObject(form);
    payload.allowedRoles = [payload.allowAdmin ? "admin" : "", payload.allowEditor ? "editor" : ""].filter(Boolean);
    payload.enabled = Boolean(payload.enabled);
    payload.loggingEnabled = Boolean(payload.loggingEnabled);
    delete payload.allowAdmin;
    delete payload.allowEditor;
    const callable = firebase.functionsLib.httpsCallable(firebase.functions, "saveAiSettings");
    await callable(payload);
    form.querySelector("#ai-settings-result").innerHTML = `<div class="alert alert--success">ChatGPT-Einstellungen wurden gespeichert.</div>`;
  });

  document.querySelector("#ai-test-connection")?.addEventListener("click", async () => {
    const output = document.querySelector("#ai-settings-result");
    try {
      const firebase = await import("./firebase/firebaseClient.js").then((module) => module.getFirebaseServices());
      const callable = firebase.functionsLib.httpsCallable(firebase.functions, "testOpenAiConnection");
      const result = await callable({});
      output.innerHTML = `<div class="alert alert--success">Verbindung erfolgreich: ${escapeHtml(result.data.preview || "ok")}</div>`;
    } catch (error) {
      output.innerHTML = `<div class="alert alert--warning">${escapeHtml(error.message || String(error))}</div>`;
    }
  });

  const registrationForm = document.querySelector("#registration-form");
  registrationForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const result = registrationForm.querySelector("#form-result");
    try {
      await createRegistration(registrationForm.dataset.eventId, formObject(registrationForm));
      result.innerHTML = `<div class="alert alert--success">Vielen Dank. Bitte pruefen Sie Ihre E-Mail und bestaetigen Sie die Anmeldung ueber den zugesandten Link.</div>`;
      registrationForm.querySelector("button[type=submit]").disabled = true;
    } catch (error) {
      result.innerHTML = `<div class="alert alert--warning">${escapeHtml(error.message)}</div>`;
    }
  });

  document.querySelector("#login-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      const values = formObject(form);
      const user = await login(values.email, values.password, values.role);
      go(["admin", "editor"].includes(user.role) ? "cms" : "portal");
    } catch (error) {
      form.querySelector("#login-result").innerHTML = `<div class="alert alert--warning">${escapeHtml(error.message)}</div>`;
    }
  });

  document.querySelector("#google-login-button")?.addEventListener("click", async (event) => {
    event.preventDefault();
    const form = document.querySelector("#login-form");
    try {
      const values = formObject(form);
      const user = await loginWithGoogle(values.role);
      go(["admin", "editor"].includes(user.role) ? "cms" : "portal");
    } catch (error) {
      form.querySelector("#login-result").innerHTML = `<div class="alert alert--warning">${escapeHtml(error.message)}</div>`;
    }
  });

  document.querySelector("#bootstrap-admin-button")?.addEventListener("click", async () => {
    const output = document.querySelector("#bootstrap-admin-result");
    output.innerHTML = `<div class="alert">Admin-Freischaltung wird geprueft ...</div>`;
    try {
      const firebase = await import("./firebase/firebaseClient.js").then((module) => module.getFirebaseServices());
      const callable = firebase.functionsLib.httpsCallable(firebase.functions, "bootstrapFirstAdmin");
      await callable({});
      await refreshAuthToken(true);
      output.innerHTML = `<div class="alert alert--success">Erster Admin wurde freigeschaltet. CMS wird geoeffnet ...</div>`;
      go("cms");
    } catch (error) {
      output.innerHTML = `<div class="alert alert--warning">${escapeHtml(error.message || String(error))}</div>`;
    }
  });

  document.querySelector("#logout-button")?.addEventListener("click", async () => {
    await logout();
    go("home");
  });

  document.querySelectorAll("[data-event-tab]").forEach((button) => button.addEventListener("click", () => {
    go(`cms/event/${button.dataset.eventId}?tab=${button.dataset.eventTab}`);
  }));

  let draggedTopicCard = null;
  document.querySelectorAll("[data-topic-drag-id]").forEach((card) => {
    card.addEventListener("dragstart", (event) => {
      draggedTopicCard = card;
      card.classList.add("is-dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", card.dataset.topicDragId);
    });
    card.addEventListener("dragend", async () => {
      card.classList.remove("is-dragging");
      document.querySelectorAll("[data-topic-drag-id]").forEach((item) => item.classList.remove("is-drop-target"));
      const cards = Array.from(document.querySelectorAll("[data-topic-drag-id]"));
      const topicIds = cards.map((item) => item.dataset.topicDragId);
      const eventId = card.dataset.eventId;
      const existingEvent = await getOne("events", eventId);
      await upsert("events", { ...existingEvent, topicIds, updatedAt: new Date().toISOString() });
      draggedTopicCard = null;
    });
    card.addEventListener("dragover", (event) => {
      event.preventDefault();
      if (!draggedTopicCard || draggedTopicCard === card) return;
      card.classList.add("is-drop-target");
      const list = card.parentElement;
      const rect = card.getBoundingClientRect();
      const after = event.clientY > rect.top + rect.height / 2;
      list.insertBefore(draggedTopicCard, after ? card.nextSibling : card);
    });
    card.addEventListener("dragleave", () => card.classList.remove("is-drop-target"));
  });

  document.querySelector("#event-edit-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const existing = (await getOne("events", form.dataset.eventId)) || { id: form.dataset.eventId, topicIds: [], speakerIds: [], sponsorIds: [], status: "draft" };
    const values = formObject(form);
    const image = form.querySelector('input[name="eventImage"]')?.files?.[0];
    const newEventType = values.newEventType?.trim();
    if (image) {
      const asset = await uploadEntityImage("events", form.dataset.eventId, image);
      values.imageUrl = asset.url;
      values.assetStoragePath = asset.storagePath;
    }
    if (newEventType) {
      const eventTypesSetting = (await getOne("settings", "eventTypes")) || {
        id: "eventTypes",
        key: "eventTypes",
        group: "events",
        value: []
      };
      const eventTypes = Array.isArray(eventTypesSetting.value) ? eventTypesSetting.value : [];
      const nextEventTypes = Array.from(new Set([...eventTypes, newEventType])).sort((a, b) => a.localeCompare(b, "de"));
      await upsert("settings", {
        ...eventTypesSetting,
        value: nextEventTypes,
        description: "Eventtypen fuer CMS-Auswahl"
      });
      values.eventType = newEventType;
    }
    delete values.eventImage;
    delete values.newEventType;
    await upsert("events", { ...existing, ...values });
    form.querySelector("#event-save-result").innerHTML = `<div class="alert alert--success">Event wurde gespeichert.</div>`;
  });

  document.querySelector("#event-speakers-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const existing = await getOne("events", form.dataset.eventId);
    const speakerIds = Array.from(form.querySelectorAll('input[name="speakerIds"]:checked')).map((input) => input.value);
    await upsert("events", { ...existing, speakerIds });
    form.querySelector("#speaker-assignment-result").innerHTML = `<div class="alert alert--success">Referentenzuordnung wurde gespeichert.</div>`;
  });

  document.querySelector("#event-topic-assignment-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const existing = await getOne("events", form.dataset.eventId);
    const topicIds = Array.from(form.querySelectorAll('input[name="topicIds"]:checked')).map((input) => input.value);
    const speakerIds = Array.from(form.querySelectorAll('input[name="speakerIds"]:checked')).map((input) => input.value);
    const topics = await list("topics");
    const speakers = await list("speakers");
    for (const topic of topics) {
      if (!form.elements[`edit-topic-${topic.id}-title`]) continue;
      await upsert("topics", {
        ...topic,
        title: form.elements[`edit-topic-${topic.id}-title`].value,
        shortDescription: form.elements[`edit-topic-${topic.id}-shortDescription`].value,
        updatedAt: new Date().toISOString()
      });
    }
    for (const speaker of speakers) {
      if (!form.elements[`edit-speaker-${speaker.id}-name`]) continue;
      await upsert("speakers", {
        ...speaker,
        name: form.elements[`edit-speaker-${speaker.id}-name`].value,
        company: form.elements[`edit-speaker-${speaker.id}-company`].value,
        position: form.elements[`edit-speaker-${speaker.id}-position`].value,
        shortBio: form.elements[`edit-speaker-${speaker.id}-shortBio`].value,
        updatedAt: new Date().toISOString()
      });
    }
    const newTopicTitle = form.elements.newTopicTitle?.value?.trim();
    if (newTopicTitle) {
      const id = `topics-${crypto.randomUUID()}`;
      await upsert("topics", {
        id,
        title: newTopicTitle,
        shortDescription: form.elements.newTopicShortDescription.value,
        status: "active",
        visibility: "public",
        sortOrder: topics.length + 1,
        createdAt: new Date().toISOString()
      });
      topicIds.push(id);
    }
    const newSpeakerName = form.elements.newSpeakerName?.value?.trim();
    if (newSpeakerName) {
      const id = `speakers-${crypto.randomUUID()}`;
      await upsert("speakers", {
        id,
        name: newSpeakerName,
        company: form.elements.newSpeakerCompany.value,
        position: form.elements.newSpeakerPosition.value,
        shortBio: form.elements.newSpeakerShortBio.value,
        status: "published",
        visibility: "public",
        createdAt: new Date().toISOString()
      });
      speakerIds.push(id);
    }
    await upsert("events", { ...existing, topicIds, speakerIds, updatedAt: new Date().toISOString() });
    form.querySelector("#event-topic-assignment-result").innerHTML = `<div class="alert alert--success">Zuordnung wurde gespeichert.</div>`;
    await render();
  });

  document.querySelector("#event-topic-editor-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const existingEvent = await getOne("events", form.dataset.eventId);
    const topicId = form.dataset.topicId || `topics-${crypto.randomUUID()}`;
    const existingTopic = form.dataset.topicId ? await getOne("topics", topicId) : { id: topicId, status: "active", visibility: "public", createdAt: new Date().toISOString() };
    const topicIds = Array.from(new Set([...(existingEvent.topicIds || []), topicId]));
    const image = imageFileFromDropzone(form, "topicImage", topicId);
    const imageUpdate = {};
    if (form.elements.removeTopicImage?.value === "1") {
      imageUpdate.imageUrl = "";
      imageUpdate.assetStoragePath = "";
    }
    if (image) {
      await deleteStoredAsset(existingTopic);
      const asset = await uploadEntityImage("topics", topicId, image);
      imageUpdate.imageUrl = asset.url;
      imageUpdate.assetStoragePath = asset.storagePath;
    }
    await upsert("topics", {
      ...existingTopic,
      id: topicId,
      title: form.elements.title.value,
      shortDescription: form.elements.text.value,
      longDescription: form.elements.text.value,
      ...imageUpdate,
      updatedAt: new Date().toISOString()
    });
    await upsert("events", { ...existingEvent, topicIds, updatedAt: new Date().toISOString() });
    form.querySelector("#event-topic-editor-result").innerHTML = `<div class="alert alert--success">Vortrag wurde gespeichert.</div>`;
    const imageStatus = form.querySelector("[data-image-status]");
    if (imageStatus) imageStatus.textContent = imageUpdate.imageUrl ? "Bild wurde gespeichert." : imageUpdate.imageUrl === "" ? "Bild wurde gelöscht." : imageStatus.textContent;
    if (Object.prototype.hasOwnProperty.call(imageUpdate, "imageUrl")) {
      updateDropzoneSavedImage(form, imageUpdate.imageUrl);
      updateTopicThumbInList(topicId, imageUpdate.imageUrl);
    }
    if (!form.dataset.topicId) go(`cms/event/${form.dataset.eventId}?tab=topics&mode=edit&topic=${topicId}`);
  });

  document.querySelector("#event-topic-assign-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const existingEvent = await getOne("events", form.dataset.eventId);
    const topicIds = Array.from(new Set([...(existingEvent.topicIds || []), form.elements.topicId.value]));
    await upsert("events", { ...existingEvent, topicIds, updatedAt: new Date().toISOString() });
    form.querySelector("#event-topic-assign-result").innerHTML = `<div class="alert alert--success">Vortrag wurde zugeordnet.</div>`;
    go(`cms/event/${form.dataset.eventId}?tab=topics&mode=edit&topic=${form.elements.topicId.value}`);
  });

  document.querySelectorAll("[data-unassign-event-topic]").forEach((button) => button.addEventListener("click", async () => {
    const existingEvent = await getOne("events", button.dataset.eventId);
    const topicIds = (existingEvent.topicIds || []).filter((topicId) => topicId !== button.dataset.unassignEventTopic);
    const speakerIds = [];
    for (const speakerId of existingEvent.speakerIds || []) {
      const speaker = await getOne("speakers", speakerId);
      if (speaker?.topicId !== button.dataset.unassignEventTopic && !(speaker?.topicIds || []).includes(button.dataset.unassignEventTopic)) speakerIds.push(speakerId);
    }
    await upsert("events", { ...existingEvent, topicIds, speakerIds, updatedAt: new Date().toISOString() });
    await render();
  }));

  document.querySelector("#event-topic-speaker-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveEventTopicSpeakerForm(event.currentTarget);
  });
  document.querySelector("#event-topic-speaker-form button[type='submit']")?.addEventListener("click", async (event) => {
    const form = event.currentTarget.form;
    if (!form || form.classList.contains("is-saving")) return;
    if (form.reportValidity && !form.reportValidity()) return;
    event.preventDefault();
    form.classList.add("is-saving");
    try {
      await saveEventTopicSpeakerForm(form);
    } finally {
      form.classList.remove("is-saving");
    }
  });

  document.querySelectorAll("[data-remove-event-topic-speaker]").forEach((button) => button.addEventListener("click", async () => {
    const speaker = await getOne("speakers", button.dataset.removeEventTopicSpeaker);
    const existingEvent = await getOne("events", button.dataset.eventId);
    if (!speaker || !existingEvent) return;
    if (!window.confirm(`${speaker.name || "Referent"} aus diesem Vortrag entfernen?`)) return;
    const topicIds = new Set(Array.isArray(speaker.topicIds) ? speaker.topicIds : []);
    topicIds.delete(button.dataset.topicId);
    const remainingEventTopicIds = Array.from(topicIds).filter((topicId) => (existingEvent.topicIds || []).includes(topicId));
    const stillInEvent = remainingEventTopicIds.length > 0 || (speaker.topicId && speaker.topicId !== button.dataset.topicId && (existingEvent.topicIds || []).includes(speaker.topicId));
    const eventIds = new Set(Array.isArray(speaker.eventIds) ? speaker.eventIds : []);
    if (!stillInEvent) eventIds.delete(button.dataset.eventId);
    const speakerIds = stillInEvent
      ? Array.from(new Set(existingEvent.speakerIds || []))
      : (existingEvent.speakerIds || []).filter((speakerId) => speakerId !== speaker.id);
    await upsert("speakers", {
      ...speaker,
      topicId: speaker.topicId === button.dataset.topicId ? "" : speaker.topicId,
      topicIds: Array.from(topicIds),
      eventIds: Array.from(eventIds),
      updatedAt: new Date().toISOString()
    });
    await upsert("events", { ...existingEvent, speakerIds, updatedAt: new Date().toISOString() });
    go(`cms/event/${button.dataset.eventId}?tab=topics&mode=edit&topic=${button.dataset.topicId}`);
  }));

  document.querySelectorAll("[data-copy-talk-to-topic]").forEach((button) => button.addEventListener("click", async () => {
    const talk = await getOne("topics", button.dataset.copyTalkToTopic);
    if (!talk) return;
    const id = `topics-${crypto.randomUUID()}`;
    await upsert("topics", {
      ...talk,
      id,
      title: talk.title || "Neues Thema",
      sourceTalkId: talk.id,
      sourceEventId: button.dataset.eventId || "",
      eventIds: [],
      topicIds: [],
      isEditorialTopic: true,
      status: talk.status || "active",
      visibility: talk.visibility || "public",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    go(`cms/edit?module=topics&id=${id}`);
  }));

  document.querySelector("#event-partners-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const existing = await getOne("events", form.dataset.eventId);
    const sponsorIds = Array.from(form.querySelectorAll('input[name="sponsorIds"]:checked')).map((input) => input.value);
    let hostId = form.elements.hostId?.value || "";
    const sponsors = await list("sponsors");
    for (const sponsor of sponsors) {
      if (!form.elements[`edit-sponsor-${sponsor.id}-name`]) continue;
      await upsert("sponsors", {
        ...sponsor,
        name: form.elements[`edit-sponsor-${sponsor.id}-name`].value,
        role: form.elements[`edit-sponsor-${sponsor.id}-role`].value,
        website: form.elements[`edit-sponsor-${sponsor.id}-website`].value,
        description: form.elements[`edit-sponsor-${sponsor.id}-description`].value,
        status: sponsor.status || "published",
        updatedAt: new Date().toISOString()
      });
    }
    const newSponsorName = form.elements.newSponsorName?.value?.trim();
    if (newSponsorName) {
      const id = `sponsors-${crypto.randomUUID()}`;
      await upsert("sponsors", {
        id,
        name: newSponsorName,
        role: form.elements.newSponsorRole.value,
        website: form.elements.newSponsorWebsite.value,
        description: form.elements.newSponsorDescription.value,
        status: "published",
        visibility: "public",
        createdAt: new Date().toISOString()
      });
      sponsorIds.push(id);
      if (form.elements.newSponsorIsHost.checked) hostId = id;
    }
    await upsert("events", { ...existing, sponsorIds, hostId, updatedAt: new Date().toISOString() });
    form.querySelector("#event-partners-result").innerHTML = `<div class="alert alert--success">Sponsoren und Gastgeber wurden gespeichert.</div>`;
    await render();
  });

  document.querySelector("#gallery-edit-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const result = form.querySelector("#gallery-save-result");
    const submitButton = form.querySelector('button[type="submit"], button:not([type])');
    if (submitButton) submitButton.disabled = true;
    if (result) result.innerHTML = `<div class="alert">${progressMarkup("Galerie wird gespeichert ...", 20)}</div>`;
    try {
      const galleryId = form.dataset.galleryId;
      const existing = (await getOne("galleries", galleryId)) || { id: galleryId, createdAt: new Date().toISOString() };
      const keptImages = [];
      form.querySelectorAll("[data-gallery-image-item]").forEach((item) => {
        if (item.querySelector('input[name$="-remove"]')?.checked) return;
        keptImages.push({
          id: item.querySelector('input[name$="-id"]')?.value || `gallery-image-${crypto.randomUUID()}`,
          url: item.querySelector('input[name$="-url"]')?.value || "",
          storagePath: item.querySelector('input[name$="-storagePath"]')?.value || "",
          fileName: item.querySelector('input[name$="-fileName"]')?.value || "",
          caption: item.querySelector('input[name$="-caption"]')?.value || "",
          altText: item.querySelector('input[name$="-altText"]')?.value || "",
          sortOrder: keptImages.length + 1
        });
      });
      const files = [...Array.from(form.elements.galleryImages?.files || []), ...Array.from(form.elements.galleryImagesDrop?.files || [])];
      const uploadedImages = files.length
        ? await uploadGalleryImages(galleryId, files, (progress) => {
            if (result) result.innerHTML = `<div class="alert">${progressMarkup(`Bilder werden hochgeladen (${progress}%) ...`, Math.max(30, progress))}</div>`;
          })
        : [];
      const images = [...keptImages, ...uploadedImages.map((image, index) => ({ ...image, sortOrder: keptImages.length + index + 1 }))];
      await upsert("galleries", {
        ...existing,
        id: galleryId,
        title: form.elements.title.value.trim(),
        description: form.elements.description.value.trim(),
        status: form.elements.status.value,
        visibility: form.elements.visibility.value || "public",
        images,
        updatedAt: new Date().toISOString()
      });
      if (result) {
        result.innerHTML = `<div class="alert alert--success">Galerie gespeichert. ${images.length} Bild${images.length === 1 ? "" : "er"} sind zugeordnet.</div>`;
        result.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
      form.elements.galleryImages.value = "";
      form.elements.galleryImagesDrop.value = "";
      const current = route();
      const target = `cms/edit?module=galleries&id=${galleryId}`;
      if (current.path === "cms" && current.id === "edit" && current.query.get("module") === "galleries" && current.query.get("id") !== galleryId) {
        go(target);
      } else {
        await render();
      }
    } catch (error) {
      if (result) result.innerHTML = `<div class="alert alert--error">Galerie konnte nicht gespeichert werden: ${escapeHtml(error.message || "Unbekannter Fehler")}</div>`;
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  document.querySelector("#content-edit-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const result = form.querySelector("#content-save-result");
    const submitButton = form.querySelector('button[type="submit"], button:not([type])');
    if (submitButton) submitButton.disabled = true;
    if (result) result.innerHTML = `<div class="alert">Speichere...</div>`;
    try {
      const existing = (await getOne(form.dataset.module, form.dataset.id)) || { id: form.dataset.id, createdAt: new Date().toISOString() };
      const values = formObject(form);
      const removeAssetRequested = values.removeAssetFile === "1";
      if (form.dataset.module === "editorialContent" && values.publishDate) values.validFrom = values.publishDate;
      if (form.dataset.module === "editorialContent" && Object.prototype.hasOwnProperty.call(values, "linkedEventId")) {
        values.galleryEventId = values.linkedEventId || "";
        if (values.isRetrospective) values.category = "Rückblick";
      }
      const image = imageFileFromDropzone(form, "assetFile", form.dataset.id);
      if (removeAssetRequested) {
        values.imageUrl = "";
        values.documentUrl = "";
        values.assetUrl = "";
        values.assetFileName = "";
        values.assetType = "";
        values.logoUrl = "";
        values.photoUrl = "";
        values.assetStoragePath = "";
      }
      if (image) {
        await deleteStoredAsset(existing);
        const asset = await uploadEntityImage(form.dataset.module, form.dataset.id, image);
        if (form.dataset.module === "topics") values.imageUrl = asset.url;
        if (form.dataset.module === "members") values.logoUrl = asset.url;
        if (form.dataset.module === "boardMembers") values.photoUrl = asset.url;
        if (form.dataset.module === "speakers") values.photoUrl = asset.url;
        if (form.dataset.module === "sponsors") values.logoUrl = asset.url;
        if (form.dataset.module === "editorialContent") {
          values.assetUrl = asset.url;
          values.assetFileName = image.name;
          values.assetType = image.type.startsWith("image/") ? "image" : "document";
          if (image.type.startsWith("image/")) {
            values.imageUrl = asset.url;
            values.documentUrl = "";
          } else {
            values.documentUrl = asset.url;
            values.imageUrl = "";
          }
        }
        values.assetStoragePath = asset.storagePath;
      }
      delete values.assetFile;
      delete values.assetFileDataUrl;
      delete values.removeAssetFile;
      const savedValues = { ...existing, ...values };
      await upsert(form.dataset.module, savedValues);
      if (image || removeAssetRequested) {
        updateDropzoneSavedImage(form, savedValues.imageUrl || savedValues.logoUrl || savedValues.photoUrl || "");
      }
      if (result) {
        result.innerHTML = `<div class="alert alert--success">Gespeichert.</div>`;
        result.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
      form.dispatchEvent(new CustomEvent("cms-form-saved", { detail: savedValues }));
    } catch (error) {
      if (result) result.innerHTML = `<div class="alert alert--error">Speichern fehlgeschlagen: ${escapeHtml(error.message || "Unbekannter Fehler")}</div>`;
      form.dispatchEvent(new CustomEvent("cms-form-save-failed", { detail: { error } }));
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  document.querySelector("#membership-application-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const result = form.querySelector("#membership-application-result");
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    if (result) result.innerHTML = `<div class="alert">Antrag wird gespeichert...</div>`;
    try {
      const values = formObject(form);
      if (!values.privacyAccepted) throw new Error("Bitte Datenschutzerklaerung akzeptieren.");
      if (!values.statutesAccepted) throw new Error("Bitte Vereinssatzung akzeptieren.");
      if (!values.feeInfoAccepted) throw new Error("Bitte Beitragsinformationen bestaetigen.");
      const id = `membershipApplications-${crypto.randomUUID()}`;
      await upsert("membershipApplications", {
        id,
        ...values,
        status: "new",
        source: "website",
        submittedAt: new Date().toISOString()
      });
      form.reset();
      if (result) result.innerHTML = `<div class="alert alert--success">Vielen Dank. Der Mitgliedsantrag wurde gespeichert.</div>`;
    } catch (error) {
      if (result) result.innerHTML = `<div class="alert alert--error">Absenden fehlgeschlagen: ${escapeHtml(error.message || "Unbekannter Fehler")}</div>`;
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  document.querySelector("#topic-editor-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const result = form.querySelector("#topic-editor-result");
    const submitButton = form.querySelector('button[type="submit"], .actions .button');
    if (submitButton) submitButton.disabled = true;
    if (result) result.innerHTML = `<div class="alert">Thema wird gespeichert ...</div>`;
    try {
    const topicId = form.dataset.topicId;
    const topic = (await getOne("topics", topicId)) || { id: topicId, status: "active", visibility: "public" };
    const image = imageFileFromDropzone(form, "topicImage", topicId);
    const imageUpdate = {};
    if (form.elements.removeTopicImage?.value === "1") {
      imageUpdate.imageUrl = "";
      imageUpdate.assetStoragePath = "";
    }
    if (image) {
      await deleteStoredAsset(topic);
      const asset = await uploadEntityImage("topics", topicId, image);
      imageUpdate.imageUrl = asset.url;
      imageUpdate.assetStoragePath = asset.storagePath;
    }
    const savedTopic = {
      ...topic,
      title: form.elements.title?.value || "",
      subtitle: form.elements.subtitle?.value || "",
      category: form.elements.category?.value || "Thema",
      publishDate: form.elements.publishDate?.value || "",
      validFrom: form.elements.publishDate?.value || topic.validFrom || "",
      validTo: form.elements.validTo?.value || "",
      shortDescription: form.elements.shortDescription?.value || "",
      introText: form.elements.shortDescription?.value || "",
      longDescription: form.elements.longDescription?.value || "",
      bodyText: form.elements.longDescription?.value || "",
      articleText: form.elements.longDescription?.value || "",
      galleryId: form.elements.galleryId?.value || "",
      status: form.elements.status?.value || topic.status || "active",
      ...imageUpdate,
      updatedAt: new Date().toISOString()
    };
    await upsert("topics", savedTopic);

    const selected = new Set(Array.from(form.querySelectorAll('input[name="assignedSpeakerIds"]:checked')).map((input) => input.value));
    const speakers = await list("speakers");
    await Promise.all(speakers.map((speaker) => {
      const topicIds = new Set(Array.isArray(speaker.topicIds) ? speaker.topicIds : []);
      if (selected.has(speaker.id)) topicIds.add(topicId);
      if (!selected.has(speaker.id)) topicIds.delete(topicId);
      const values = {
        ...speaker,
        topicId: selected.has(speaker.id) ? speaker.topicId || topicId : speaker.topicId === topicId ? "" : speaker.topicId,
        topicIds: Array.from(topicIds),
        updatedAt: new Date().toISOString()
      };
      if (form.elements[`speaker-${speaker.id}-name`]) values.name = form.elements[`speaker-${speaker.id}-name`].value;
      if (form.elements[`speaker-${speaker.id}-company`]) values.company = form.elements[`speaker-${speaker.id}-company`].value;
      if (form.elements[`speaker-${speaker.id}-position`]) values.position = form.elements[`speaker-${speaker.id}-position`].value;
      if (form.elements[`speaker-${speaker.id}-shortBio`]) values.shortBio = form.elements[`speaker-${speaker.id}-shortBio`].value;
      return upsert("speakers", values);
    }));

    const newSpeakerName = form.elements.newSpeakerName?.value?.trim();
    if (newSpeakerName) {
      const id = `speakers-${crypto.randomUUID()}`;
      await upsert("speakers", {
        id,
        name: newSpeakerName,
        company: form.elements.newSpeakerCompany.value,
        position: form.elements.newSpeakerPosition.value,
        shortBio: form.elements.newSpeakerShortBio.value,
        topicId,
        topicIds: [topicId],
        status: "published",
        visibility: "public",
        createdAt: new Date().toISOString()
      });
    }
    const imageStatus = form.querySelector("[data-image-status]");
    if (imageStatus) imageStatus.textContent = imageUpdate.imageUrl ? "Bild wurde gespeichert." : imageUpdate.imageUrl === "" ? "Bild wurde geloescht." : imageStatus.textContent;
    if (Object.prototype.hasOwnProperty.call(imageUpdate, "imageUrl")) updateDropzoneSavedImage(form, imageUpdate.imageUrl);
    if (result) {
      result.innerHTML = `<div class="alert alert--success">Thema wurde gespeichert.${imageUpdate.imageUrl ? " Bild wurde hochgeladen." : ""}</div>`;
      result.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    form.classList.add("is-saved");
    form.dispatchEvent(new CustomEvent("cms-form-saved", { detail: savedTopic }));
    } catch (error) {
      if (result) result.innerHTML = `<div class="alert alert--error">Speichern fehlgeschlagen: ${escapeHtml(error.message || "Unbekannter Fehler")}</div>`;
      form.dispatchEvent(new CustomEvent("cms-form-save-failed", { detail: { error } }));
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  document.querySelector("#topic-speakers-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const topicId = form.dataset.topicId;
    const selected = new Set(Array.from(form.querySelectorAll('input[name="speakerIds"]:checked')).map((input) => input.value));
    const speakers = await list("speakers");
    await Promise.all(speakers.map((speaker) => {
      const topicIds = new Set(Array.isArray(speaker.topicIds) ? speaker.topicIds : []);
      if (selected.has(speaker.id)) topicIds.add(topicId);
      if (!selected.has(speaker.id)) topicIds.delete(topicId);
      const next = { ...speaker, topicIds: Array.from(topicIds) };
      if (selected.has(speaker.id)) next.topicId = speaker.topicId || topicId;
      if (!selected.has(speaker.id) && speaker.topicId === topicId) next.topicId = "";
      return upsert("speakers", next);
    }));
    form.querySelector("#topic-speakers-result").innerHTML = `<div class="alert alert--success">Referentenauswahl wurde gespeichert.</div>`;
    await render();
  });

  document.querySelector("#topic-speaker-create-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = formObject(form);
    const id = `speakers-${crypto.randomUUID()}`;
    const image = form.querySelector('input[name="assetFile"]')?.files?.[0];
    if (image) {
      const asset = await uploadEntityImage("speakers", id, image);
      values.photoUrl = asset.url;
      values.assetStoragePath = asset.storagePath;
    }
    delete values.assetFile;
    await upsert("speakers", {
      id,
      ...values,
      topicId: form.dataset.topicId,
      topicIds: [form.dataset.topicId],
      status: "published",
      visibility: "public",
      createdAt: new Date().toISOString()
    });
    form.querySelector("#topic-speaker-create-result").innerHTML = `<div class="alert alert--success">Referent wurde angelegt.</div>`;
    await render();
  });

  document.querySelectorAll(".topic-speaker-edit-form").forEach((form) => form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const existing = await getOne("speakers", form.dataset.speakerId);
    const values = formObject(form);
    const topicIds = new Set(Array.isArray(existing.topicIds) ? existing.topicIds : []);
    topicIds.add(form.dataset.topicId);
    const image = form.querySelector('input[name="assetFile"]')?.files?.[0];
    if (image) {
      const asset = await uploadEntityImage("speakers", form.dataset.speakerId, image);
      values.photoUrl = asset.url;
      values.assetStoragePath = asset.storagePath;
    }
    delete values.assetFile;
    await upsert("speakers", {
      ...existing,
      ...values,
      topicId: existing.topicId || form.dataset.topicId,
      topicIds: Array.from(topicIds),
      updatedAt: new Date().toISOString()
    });
    form.querySelector(".topic-speaker-edit-result").innerHTML = `<div class="alert alert--success">Referent wurde gespeichert.</div>`;
  }));

  document.querySelectorAll("[data-unassign-topic-speaker]").forEach((button) => button.addEventListener("click", async () => {
    const speaker = await getOne("speakers", button.dataset.unassignTopicSpeaker);
    const topicIds = new Set(Array.isArray(speaker.topicIds) ? speaker.topicIds : []);
    topicIds.delete(button.dataset.topicId);
    await upsert("speakers", {
      ...speaker,
      topicId: speaker.topicId === button.dataset.topicId ? "" : speaker.topicId,
      topicIds: Array.from(topicIds),
      updatedAt: new Date().toISOString()
    });
    await render();
  }));

  document.querySelector("[data-delete-event]")?.addEventListener("click", async (event) => {
    if (!window.confirm("Dieses Event wirklich loeschen? Zugeordnete Daten muessen separat geprueft werden.")) return;
    await remove("events", event.currentTarget.dataset.deleteEvent);
    go("cms/events");
  });

  document.querySelector("#media-upload-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const result = form.querySelector("#upload-result");
    const files = Array.from(form.querySelector('input[type="file"]').files || []);
    if (!files.length) {
      result.innerHTML = `<div class="alert alert--warning" style="margin-top:14px">Bitte mindestens eine Datei auswaehlen.</div>`;
      return;
    }
    result.innerHTML = `<div class="progress"><span style="width:0"></span></div>`;
    await uploadEventMedia(form.dataset.eventId, files, {}, (progress) => {
      result.querySelector("span").style.width = `${progress}%`;
    });
    result.innerHTML += `<div class="alert alert--success" style="margin-top:12px">Upload abgeschlossen. Medien warten auf Freigabe.</div>`;
  });

  document.querySelectorAll("[data-media-approve]").forEach((button) => button.addEventListener("click", async () => {
    const medium = await getOne("eventMedia", button.dataset.mediaApprove);
    await upsert("eventMedia", { ...medium, status: "approved", visibility: "public" });
    await render();
  }));

  document.querySelectorAll("[data-record-status]").forEach((button) => button.addEventListener("click", async () => {
    const record = await getOne(button.dataset.recordStatus, button.dataset.recordId);
    if (isProtectedInternalEditorialRecord(button.dataset.recordStatus, record)) {
      window.alert("CMS-Interna duerfen nicht unsichtbar geschaltet werden.");
      return;
    }
    const updates = { ...record, status: button.dataset.status };
    if (button.dataset.recordStatus === "eventMedia") {
      updates.visibility = button.dataset.status === "approved" ? "public" : "internal";
    }
    if (button.dataset.recordStatus === "members") {
      updates.isLive = button.dataset.status === "active";
      if (updates.isLive) updates.visibility = "public";
    }
    await upsert(button.dataset.recordStatus, updates);
    await render();
  }));

  document.querySelectorAll("[data-record-visibility]").forEach((button) => button.addEventListener("click", async () => {
    const record = await getOne(button.dataset.recordVisibility, button.dataset.recordId);
    if (isProtectedInternalEditorialRecord(button.dataset.recordVisibility, record)) {
      window.alert("CMS-Interna duerfen nicht unsichtbar geschaltet werden.");
      return;
    }
    await upsert(button.dataset.recordVisibility, {
      ...record,
      visibility: button.dataset.visibility,
      status: button.dataset.status || record.status,
      updatedAt: new Date().toISOString()
    });
    await render();
  }));

  document.querySelectorAll("[data-event-status]").forEach((button) => button.addEventListener("click", async () => {
    const existing = await getOne("events", button.dataset.eventStatus);
    await upsert("events", { ...existing, status: button.dataset.status });
    await render();
  }));

  document.querySelectorAll("[data-delete-record]").forEach((button) => button.addEventListener("click", async () => {
    const collection = button.dataset.deleteRecord;
    const record = await getOne(collection, button.dataset.recordId);
    if (isProtectedInternalEditorialRecord(collection, record)) {
      window.alert("CMS-Interna duerfen nicht geloescht werden.");
      return;
    }
    if (!window.confirm(`${record?.name || record?.title || "Eintrag"} wirklich loeschen?`)) return;
    await deleteStoredAsset(record);
    await remove(collection, button.dataset.recordId);
    await render();
  }));

  document.querySelectorAll("[data-export-event]").forEach((button) => button.addEventListener("click", async () => {
    const event = await getOne("events", button.dataset.exportEvent);
    const registrations = (await list("registrations")).filter((item) => item.eventId === event.id);
    downloadRegistrationsCsv(event, registrations);
  }));

  document.querySelectorAll("[data-setup-action]").forEach((button) => button.addEventListener("click", async () => {
    const output = document.querySelector("#setup-result");
    const actions = { connection: checkFirebaseConnection, structure: checkFirestoreStructure, initialize: initializeDatabase, demo: createDemoData, "remove-demo": removeDemoData };
    try {
      if (button.dataset.setupAction === "remove-demo" && !window.confirm("Demodaten wirklich entfernen beziehungsweise die lokale Vorschau zuruecksetzen?")) return;
      const result = await actions[button.dataset.setupAction]();
      const message = Array.isArray(result) ? `${result.filter((item) => item.available).length} von ${result.length} Collections enthalten Daten.` : result.message || "Aktion erfolgreich abgeschlossen.";
      output.innerHTML = `<div class="alert alert--success">${escapeHtml(message)}</div>`;
      if (["initialize", "demo"].includes(button.dataset.setupAction)) setTimeout(render, 500);
    } catch (error) {
      output.innerHTML = `<div class="alert alert--warning">${escapeHtml(error.message)}</div>`;
    }
  }));
}

if ("serviceWorker" in navigator && ["localhost", "127.0.0.1"].includes(location.hostname)) {
  navigator.serviceWorker.getRegistrations?.().then((registrations) => registrations.forEach((registration) => registration.unregister())).catch(() => {});
} else if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
onRouteChange(render);
render();
waitForAuthReady().finally(render);
