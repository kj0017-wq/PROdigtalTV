import { cmsShell, cmsTitle } from "./cmsLayout.js?v=253";
import { list, getOne, upsert } from "../firebase/dataService.js?v=253";
import { localPreviewMode } from "../firebase/firebaseClient.js";
import { authDebugState, currentUser, canUseCms, refreshAuthToken, waitForAuthReady } from "../firebase/authService.js?v=253";
import { escapeHtml, formatDateTime, formatShortDate } from "../utils/format.js";

const sections = [
  ["dashboard", "Themenliste"],
  ["articles", "Beitraege"],
  ["sources", "Quellen"],
  ["prompts", "Prompts"],
  ["keywords", "Keywords"],
  ["automation", "Automatisierung"],
  ["logs", "Logs / Pruefberichte"],
  ["settings", "Einstellungen"]
];

const publicationModes = {
  draft_only: "nur Entwurf erstellen",
  review_release: "nach Pruefung freigeben",
  auto_publish: "automatisch veroeffentlichen bei bestandener Pruefung"
};

const promptTypes = [
  "Themenrecherche",
  "Themenbewertung",
  "Quellenpruefung",
  "Dublettenpruefung",
  "Headline",
  "Subline / Thubline",
  "Beitragstext",
  "Sprachstil",
  "Thumbnail-Idee",
  "Thumbnail-Prompt",
  "Thumbnail-Erstellung",
  "Keywords",
  "SEO / Meta",
  "Endpruefung"
];

const systemPromptCatalog = [
  ["Themenrecherche", "Themenrecherche"],
  ["Themenbewertung", "Themenbewertung"],
  ["Quellenpruefung", "Quellenpruefung"],
  ["Dublettenpruefung", "Dublettenpruefung"],
  ["Headline", "Headline-Erstellung"],
  ["Subline / Thubline", "Subline-/Thubline-Erstellung"],
  ["Beitragstext", "Texterstellung"],
  ["Sprachstil", "Sprachstil-Pruefung"],
  ["Thumbnail-Idee", "Thumbnail-Idee"],
  ["Thumbnail-Prompt", "Thumbnail-Prompt"],
  ["Thumbnail-Erstellung", "Thumbnail-Erstellung"],
  ["Keywords", "Keyword-Erstellung"],
  ["SEO / Meta", "SEO-/Meta-Erstellung"],
  ["Endpruefung", "Endpruefung"]
];

const topicResearchCategories = [
  "Alle Themenbereiche",
  "Technik",
  "Streaming-Technologie",
  "Smart-TV / HbbTV",
  "OTT / Distribution",
  "KI in Redaktion und Produktion",
  "KI in der Synchronbranche",
  "Medienrecht / Verwertungsrecht",
  "Produktion / Postproduktion",
  "Barrierefreiheit",
  "Plattformregulierung",
  "Werbung / Vermarktung",
  "FAST-Channels",
  "Lokale und regionale Medien"
];

function defaultSystemPrompt(type, label) {
  const now = new Date().toISOString();
  const id = `ai-prompt-system-${type.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
  const promptText = type === "Themenrecherche"
    ? [
      "Aufgabe: Erzeuge fuer die PROdigitalTV KI-Redaktion genau 10 redaktionelle Themenvorschlaege.",
      "Jeder Vorschlag muss ein konkretes Thema aus TV, Streaming, Digitalmedien, Medienrecht, Produktion, KI, Distribution oder Vermarktung sein.",
      "Bewerte jeden Vorschlag mit Aktualitaetsbewertung 0-100, Branchenrelevanz 0-100 und kurzer Begruendung.",
      "Gib zusaetzlich Kategorie, moegliche Headline, kurze Subline, 5-8 Keywords, moegliche Quellenarten und Dublettenhinweis aus.",
      "Wichtig: Aus der Themenrecherche entsteht noch kein Artikel. Die Ausgabe ist eine Vorschlagsliste fuer die Redaktion.",
      "Nur Themen, die ein Redakteur auswaehlt, duerfen in die Themen-Queue uebernommen werden.",
      "Keine Quellen, Zahlen, Studien, URLs oder Fakten erfinden. Wenn Live-Quellen fehlen, Quellenstatus als Recherche erforderlich kennzeichnen.",
      "Ausgabeformat: JSON-Array mit 10 Objekten: title, headline, subline, category, keywords, actuality_score, industry_score, relevance_score, source_status, duplicate_hint, reason."
    ].join("\n")
    : [
      `Aufgabe: ${label} fuer die PROdigitalTV KI-Redaktion.`,
      "Arbeite nur mit den gelieferten Platzhaltern und CMS-Daten.",
      "Nutze {{THEMA}}, {{KATEGORIE}}, {{QUELLEN}}, {{BESTEHENDE_BEITRAEGE}}, {{SPRACHSTIL}}, {{TEXTLAENGE}}, {{HEUTIGES_DATUM}}, {{VERIFIZIERTE_QUELLEN}}, {{BEITRAGSTEXT}}, {{HEADLINE}}, {{SUBLINE}} und {{KEYWORDS}}, sofern vorhanden.",
      "Keine Fakten, Zahlen, Quellen, URLs, Personen oder Organisationen erfinden.",
      "Wenn die Quellenlage nicht reicht, gib eine Sperre oder Warnung aus statt fertiger Veroeffentlichung."
    ].join("\n");
  return {
    id,
    name: label,
    prompt_type: type,
    description: `Standardprompt fuer ${label}. Kann redaktionell angepasst werden.`,
    prompt_text: promptText,
    system_instructions: "Feste Schutzregeln: keine Halluzinationen, keine erfundenen Quellen, keine Veroeffentlichung ohne gepruefte Quellen, keine Veroeffentlichung bei Dubletten oder unklarem Faktenstand.",
    output_format: ["Themenrecherche", "Quellenpruefung", "Dublettenpruefung", "Keywords", "SEO / Meta", "Endpruefung"].includes(type) ? "json" : "text",
    model: "gpt-4.1-mini",
    temperature: ["Headline", "Subline / Thubline", "Thumbnail-Idee", "Thumbnail-Prompt", "Thumbnail-Erstellung"].includes(type) ? 0.3 : 0.2,
    max_tokens: ["Beitragstext", "Endpruefung"].includes(type) ? 1400 : 900,
    is_active: true,
    status: "aktiv",
    version: 1,
    created_at: now,
    updated_at: now,
    created_by: "System",
    updated_by: "System"
  };
}

async function ensureSystemPrompts(prompts = []) {
  const existingTypes = new Set(prompts.filter((prompt) => !isArchivedPrompt(prompt)).map((prompt) => prompt.prompt_type || prompt.promptType));
  const missing = systemPromptCatalog.filter(([type]) => !existingTypes.has(type));
  if (!missing.length) return prompts;
  const created = missing.map(([type, label]) => defaultSystemPrompt(type, label));
  await Promise.all(created.map((prompt) => upsert("ai_prompts", prompt)));
  await Promise.all(created.map((prompt) => upsert("ai_prompt_versions", {
    id: `${prompt.id}-v1`,
    prompt_id: prompt.id,
    version: 1,
    prompt_text: prompt.prompt_text,
    system_instructions: prompt.system_instructions,
    output_format: prompt.output_format,
    model: prompt.model,
    temperature: prompt.temperature,
    max_tokens: prompt.max_tokens,
    change_note: "Automatisch angelegte Systemversion.",
    status: prompt.status,
    created_at: prompt.created_at,
    created_by: prompt.created_by
  })));
  return [...prompts, ...created];
}

function protect(content) {
  const user = currentUser();
  if (!canUseCms(user)) {
    const debug = authDebugState();
    const userHint = user
      ? `<div class="alert alert--warning" style="margin:16px 0">Angemeldet als <strong>${escapeHtml(user.email || user.displayName || user.uid || "-")}</strong>, erkannte Rolle: <strong>${escapeHtml(user.role || "guest")}</strong>. Fuer die KI-Redaktion ist <strong>admin</strong> oder <strong>editor</strong> noetig.</div>`
      : "";
    return `<section class="login-wrap"><div class="form-card login-card"><p class="eyebrow">Zugriff geschuetzt</p><h1>CMS-Login erforderlich</h1><p style="margin:14px 0 24px">Die KI-Redaktion steht Administratoren und Redakteuren zur Verfuegung.</p>${userHint}<div class="alert" style="margin:16px 0;text-align:left"><strong>Diagnose</strong><br>Session: ${debug.stored ? "vorhanden" : "leer"}<br>Firebase: ${escapeHtml(debug.firebaseAuthUser?.email || "nicht angemeldet")}<br>Real-Modus: ${debug.realDataMode ? "ja" : "nein"}<br>Lokale Vorschau: ${debug.localPreviewMode ? "ja" : "nein"}</div><a class="button button--primary" href="#/login">Anmelden</a></div></section>`;
  }
  return content;
}

function badge(value = "") {
  const normalized = String(value || "Entwurf").toLowerCase();
  const tone = normalized.includes("gesperrt") || normalized.includes("dublette") || normalized.includes("fehler") || normalized.includes("unzureichend")
    ? "danger"
    : normalized.includes("pruef") || normalized.includes("warn") || normalized.includes("teilweise") || normalized.includes("neu")
      ? "warning"
      : normalized.includes("geprueft") || normalized.includes("freigegeben") || normalized.includes("veroeffentlicht") || normalized.includes("aktiv") || normalized.includes("bestanden")
        ? "success"
        : "neutral";
  return `<span class="ai-status ai-status--${tone}">${escapeHtml(value || "Entwurf")}</span>`;
}

function pictogram(icon, label, attrs = "", disabled = false) {
  return `<button class="ai-picto-button" type="button" ${attrs} ${disabled ? "disabled" : ""}><span aria-hidden="true">${icon}</span><strong>${escapeHtml(label)}</strong></button>`;
}

function linkPictogram(icon, label, href) {
  return `<a class="ai-picto-button" href="${escapeHtml(href)}"><span aria-hidden="true">${icon}</span><strong>${escapeHtml(label)}</strong></a>`;
}

function iconButton(icon, label, attrs = "") {
  return `<button class="icon-button" type="button" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}" ${attrs}>${icon}</button>`;
}

const iconEdit = `<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;
const iconTrash = `<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5"/><path d="M14 11v5"/></svg>`;
const iconPlus = `<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>`;

function nav(active) {
  return `<nav class="ai-editorial-tabs">${sections.map(([key, label]) => `<a href="#/cms/ai-editorial/${key}" class="${active === key ? "active" : ""}">${escapeHtml(label)}</a>`).join("")}</nav>`;
}

function latest(items, field = "createdAt") {
  return [...items].sort((a, b) => String(b[field] || b.updatedAt || "").localeCompare(String(a[field] || a.updatedAt || "")))[0];
}

function promptPreview(prompt = {}) {
  const text = String(prompt.prompt_text || prompt.promptText || prompt.description || "").trim();
  if (!text) return "Kein Prompt-Text hinterlegt.";
  return text.length > 260 ? `${text.slice(0, 260).trim()}...` : text;
}

function promptForType(prompts = [], type) {
  return latest(prompts.filter((prompt) => (prompt.prompt_type || prompt.promptType) === type && !isArchivedPrompt(prompt)), "updated_at");
}

function sourceRows(sources) {
  return sources.map((source) => `<tr>
    <td><strong>${escapeHtml(source.name || source.title || "-")}</strong><small>${escapeHtml(source.domain || "")}</small></td>
    <td>${escapeHtml(source.source_type || source.sourceType || "-")}</td>
    <td>${badge(source.source_status || source.check_status || source.review_status || "neu")}</td>
    <td>${Number(source.trust_score ?? source.suggested_trust_score ?? 0)}</td>
    <td><a class="link" href="${escapeHtml(source.url || "#")}" target="_blank" rel="noreferrer">oeffnen</a></td>
  </tr>`).join("");
}

function sourceCards(sources) {
  return sources.map((source) => `<article class="ai-source-card">
    <div>
      <h3>${escapeHtml(source.publisher || source.name || source.title || "Quelle")}</h3>
      <p>${escapeHtml(source.title || source.relevance_note || "")}</p>
    </div>
    <div class="ai-status-stack">${badge(source.check_status || source.source_status || "neu")}<span class="ai-status ai-status--neutral">Trust ${Number(source.trust_score || 0)}</span></div>
    <dl>
      <div><dt>Belegte Aussage</dt><dd>${escapeHtml(source.claim_reference || "Noch nicht zugeordnet")}</dd></div>
      <div><dt>Relevanz</dt><dd>${escapeHtml(source.relevance_note || "Keine Relevanznotiz")}</dd></div>
      <div><dt>Domain</dt><dd>${escapeHtml(source.domain || "-")}</dd></div>
      <div><dt>Abruf</dt><dd>${escapeHtml(formatShortDate(source.accessed_at || source.accessedAt || "")) || "-"}</dd></div>
    </dl>
    <a class="button button--secondary button--small" href="${escapeHtml(source.url || "#")}" target="_blank" rel="noreferrer">Quelle oeffnen</a>
  </article>`).join("");
}

function articleRows(articles) {
  return articles.map((article) => `<tr>
    <td><a class="link editorial-title-link" href="#/cms/ai-editorial/editor?id=${encodeURIComponent(article.id)}">${escapeHtml(article.headline || article.title || "-")}</a><small>${escapeHtml(article.subline || article.subtitle || "")}</small></td>
    <td>${badge(articleOrigin(article).label)}<small>${escapeHtml(articleOrigin(article).shortNote)}</small></td>
    <td>${escapeHtml(article.category || "-")}</td>
    <td>${badge(article.source_status || article.sourceStatus || "-")}</td>
    <td>${badge(article.duplicate_status || article.duplicateStatus || "-")}</td>
    <td>${badge(article.ai_check_status || article.aiCheckStatus || "-")}</td>
    <td>${badge(article.publication_status || article.status || "-")}</td>
    <td>${escapeHtml(formatShortDate(article.published_at || article.publishDate || article.createdAt || ""))}</td>
  </tr>`).join("");
}

function promptRows(prompts) {
  return prompts.map((prompt) => `<tr>
    <td><strong>${escapeHtml(prompt.name || "-")}</strong><small>${escapeHtml(prompt.description || "")}</small></td>
    <td>${escapeHtml(prompt.prompt_type || prompt.promptType || "-")}</td>
    <td class="prompt-preview-cell">${escapeHtml(promptPreview(prompt))}</td>
    <td>${badge(prompt.status || "Entwurf")}</td>
    <td>${prompt.is_active ? badge("aktiv") : badge("inaktiv")}</td>
    <td>v${Number(prompt.version || 1)}</td>
    <td>${escapeHtml(formatShortDate(prompt.updated_at || prompt.updatedAt || prompt.created_at || ""))}</td>
    <td class="table-actions table-actions--icons">${iconButton(iconEdit, "Prompt bearbeiten", `data-ai-prompt-edit="${escapeHtml(prompt.id)}"`)}${iconButton(iconTrash, "Prompt loeschen", `data-ai-prompt-delete="${escapeHtml(prompt.id)}"` )}</td>
  </tr>`).join("");
}

function isArchivedPrompt(prompt = {}) {
  const status = String(prompt.status || "").toLowerCase();
  return status.includes("archiviert") || status.includes("geloescht") || prompt.deleted_at || prompt.deletedAt;
}

function promptCatalogRows(prompts) {
  return systemPromptCatalog.map(([type, label]) => {
    const prompt = promptForType(prompts, type);
    if (!prompt) {
      return `<tr>
        <td><strong>${escapeHtml(label)}</strong><small>Kein eigener aktiver Prompt. System-Fallback bleibt als Sicherheitsnetz aktiv.</small></td>
        <td>${escapeHtml(type)}</td>
        <td class="prompt-preview-cell prompt-preview-cell--empty">System-Fallback wird verwendet, bis ein eigener Prompt angelegt ist.</td>
        <td>${badge("Fallback")}</td>
        <td>${badge("inaktiv")}</td>
        <td>-</td>
        <td>-</td>
        <td class="table-actions table-actions--icons">${iconButton(iconPlus, `${label} anlegen`, `data-ai-prompt-create-type="${escapeHtml(type)}" data-ai-prompt-create-name="${escapeHtml(label)}"`)}</td>
      </tr>`;
    }
    return `<tr>
      <td><strong>${escapeHtml(label)}</strong><small>${escapeHtml(prompt.description || prompt.name || "")}</small></td>
      <td>${escapeHtml(type)}</td>
      <td class="prompt-preview-cell">${escapeHtml(promptPreview(prompt))}</td>
      <td>${badge(prompt.status || "Entwurf")}</td>
      <td>${prompt.is_active ? badge("aktiv") : badge("inaktiv")}</td>
      <td>v${Number(prompt.version || 1)}</td>
      <td>${escapeHtml(formatShortDate(prompt.updated_at || prompt.updatedAt || prompt.created_at || ""))}</td>
      <td class="table-actions table-actions--icons">${iconButton(iconEdit, `${label} bearbeiten`, `data-ai-prompt-edit="${escapeHtml(prompt.id)}"`)}${iconButton(iconTrash, `${label} loeschen`, `data-ai-prompt-delete="${escapeHtml(prompt.id)}"` )}</td>
    </tr>`;
  }).join("");
}

function promptNameNavigation(prompts = []) {
  return `<div class="prompt-name-nav"><label for="ai-prompt-name-select">Prompt auswaehlen</label><select id="ai-prompt-name-select" data-ai-prompt-select><option value="">Bitte Prompt waehlen...</option>${systemPromptCatalog.map(([type, label]) => {
    const prompt = promptForType(prompts, type);
    if (!prompt) {
      return `<option value="create:${escapeHtml(type)}" data-create-type="${escapeHtml(type)}" data-create-name="${escapeHtml(label)}">${escapeHtml(label)} - Fallback anlegen</option>`;
    }
    return `<option value="${escapeHtml(prompt.id)}">${escapeHtml(label)} - ${escapeHtml(prompt.is_active ? "aktiv" : "inaktiv")} - v${Number(prompt.version || 1)}</option>`;
  }).join("")}</select></div>`;
}

function promptTestRows(tests) {
  return tests.map((test) => `<tr>
    <td>${escapeHtml(formatDateTime(test.created_at || test.createdAt || "")) || "-"}</td>
    <td>${escapeHtml(test.prompt_name || test.promptName || test.prompt_id || "-")}</td>
    <td>${badge(test.test_status || test.testStatus || "-")}</td>
    <td>${escapeHtml((test.warnings_json || test.warningsJson || []).join(", ") || "Keine Warnungen")}</td>
  </tr>`).join("");
}

function topicSuggestionRows(suggestions = []) {
  return suggestions.map((topic) => `<tr>
    <td><label class="checkbox"><input type="checkbox" name="topicSuggestionIds" value="${escapeHtml(topic.id)}"><span><strong>${escapeHtml(topic.title || "-")}</strong><small>${escapeHtml(topic.reason || topic.subline || "")}</small></span></label></td>
    <td>${escapeHtml(topic.category || "-")}</td>
    <td><strong>${Number(topic.actuality_score || 0)}</strong><small>Relevanz ${Number(topic.relevance_score || 0)}</small></td>
    <td>${badge(topic.queue_status || topic.status || "vorgeschlagen")}</td>
  </tr>`).join("");
}

function sortTopicSuggestions(suggestions = []) {
  return [...suggestions].sort((a, b) => {
    const dateA = Date.parse(a.created_at || a.createdAt || a.updated_at || a.updatedAt || "") || 0;
    const dateB = Date.parse(b.created_at || b.createdAt || b.updated_at || b.updatedAt || "") || 0;
    if (dateA !== dateB) return dateB - dateA;
    return Number(a.rank || 999) - Number(b.rank || 999);
  });
}

function topicQueueRows(queue = []) {
  return queue.map((topic) => `<tr>
    <td><strong>${escapeHtml(topic.title || "-")}</strong><small>${escapeHtml(topic.subline || topic.reason || "")}</small></td>
    <td>${escapeHtml(topic.category || "-")}</td>
    <td>${Number(topic.actuality_score || 0)}</td>
    <td>${badge(topic.status || "in Queue")}</td>
    <td>${escapeHtml(formatShortDate(topic.created_at || topic.createdAt || ""))}</td>
  </tr>`).join("");
}

function logRows(logs) {
  return logs.map((log) => `<tr>
    <td>${escapeHtml(formatDateTime(log.created_at || log.createdAt || ""))}</td>
    <td>${escapeHtml(log.task_name || log.taskName || "KI_Redaktion_Taeglicher_Beitrag")}</td>
    <td>${badge(log.status || "-")}</td>
    <td>${escapeHtml(log.message || "-")}</td>
  </tr>`).join("");
}

function isAiEditorialArticle(item = {}) {
  return item.author_type === "ai"
    || item.authorType === "ai"
    || item.aiGenerated === true
    || Boolean(item.source_snapshot_json)
    || Boolean(item.sourceSnapshotJson)
    || Boolean(item.ai_log_json)
    || Boolean(item.aiLogJson)
    || Boolean(item.duplicate_check_json)
    || Boolean(item.final_check_json)
    || Boolean(item.source_status)
    || Boolean(item.duplicate_status)
    || Boolean(item.ai_check_status)
    || Boolean(item.publication_status);
}

function articleOrigin(article = {}) {
  const log = article.ai_log_json || article.aiLogJson || {};
  const origin = article.generation_origin || article.generationOrigin || log.origin || "";
  const researchMode = article.research_mode || article.researchMode || log.research_mode || "";
  if (log.localPreview || origin === "demo_topic_pool" || researchMode === "local_demo") {
    return {
      label: "Demo-Themenpool",
      shortNote: "Lokale Vorschau",
      note: "Lokaler Vorschauartikel: Die Themen kommen aus einem festen Demo-Pool. Es findet keine Live-Recherche im Web statt."
    };
  }
  if (article.author_type === "ai" || article.authorType === "ai" || article.aiGenerated === true || log.mode || origin) {
    return {
      label: "Produktive KI",
      shortNote: "KI-Lauf",
      note: "Produktiver KI-Beitrag: Herkunft aus dem serverseitigen KI-Lauf. Quellen und Belege muessen vor Freigabe bestanden sein."
    };
  }
  return {
    label: "Manuell",
    shortNote: "Redaktion",
    note: "Manuell angelegter Beitrag: Er hat Vorrang vor KI-Vorschlaegen und ist nicht Teil des automatischen KI-Faktenchecks."
  };
}

function normalizeArticleSources(article, sources) {
  const storedSources = sources.filter((source) => source.article_id === article.id || source.articleId === article.id);
  if (storedSources.length) return storedSources;
  const snapshot = Array.isArray(article.source_snapshot_json)
    ? article.source_snapshot_json
    : Array.isArray(article.sourceSnapshotJson)
      ? article.sourceSnapshotJson
      : [];
  return snapshot.map((source, index) => ({
    id: `${article.id}-snapshot-source-${index}`,
    article_id: article.id,
    title: source.title || source.name || source.publisher || "Quelle",
    publisher: source.publisher || source.name || source.title || "Quelle",
    domain: source.domain || "",
    url: source.url || "#",
    source_type: source.source_type || source.sourceType || "Quelle",
    relevance_note: source.relevance_note || source.relevanceNote || "Aus dem gespeicherten Quellen-Snapshot des Artikels.",
    claim_reference: source.claim_reference || source.claimReference || "Noch nicht zugeordnet",
    trust_score: source.trust_score ?? source.trustScore ?? 0,
    check_status: source.check_status || source.checkStatus || "geprueft",
    accessed_at: source.accessed_at || source.accessedAt || article.createdAt || ""
  }));
}

function editor(article, sources, keywords, logs) {
  const articleSources = normalizeArticleSources(article, sources);
  const articleKeywords = keywords.filter((keyword) => keyword.article_id === article.id || keyword.articleId === article.id);
  const articleLogs = logs.filter((log) => log.article_id === article.id || log.articleId === article.id);
  const displayHeadline = String(article.headline || article.title || "KI-Beitrag").replace(/^Themenvorschlag:\s*/i, "");
  const displayTitle = String(article.title || article.headline || "").replace(/^Themenvorschlag:\s*/i, "");
  const origin = articleOrigin(article);
  const publicationTarget = article.publication_target || article.publicationTarget || "news";
  const publicationTargetLabel = publicationTarget === "monthly_topic" ? "Thema des Monats" : publicationTarget === "topic" ? "Langfristiges Thema" : "Daily News";
  const createLabel = localPreviewMode() ? "Demo-Beitrag erzeugen" : "Neu erzeugen";
  const thumbnailUrl = article.thumbnail_url || article.thumbnailUrl || article.imageUrl || "";
  const audioUrl = article.audioUrl || article.audio_url || "";
  const canPublish = article.source_status === "geprueft"
    && !String(article.duplicate_status || "").toLowerCase().includes("dublette")
    && article.ai_check_status === "bestanden"
    && ["freigegeben", "geplant", "published", "veroeffentlicht"].includes(article.publication_status || article.status);
  return `<div class="ai-editor-shell ai-editor-shell--news-layout">
    <div class="ai-editor-main">
      <div class="ai-editor-head">
        <div><p class="eyebrow">Beitraege &gt; Artikel bearbeiten</p><h2>${escapeHtml(displayHeadline)}</h2></div>
        <div class="ai-status-stack">${badge(origin.label)}${badge(article.publication_status || article.status || "Entwurf")}</div>
      </div>
      <div class="ai-editor-actions">
        ${pictogram("+", createLabel, 'data-ai-editorial-run="manual"')}
        ${pictogram("O", "Vorschau", `data-ai-article-action="preview" data-article-id="${escapeHtml(article.id)}"`)}
        ${pictogram("OK", "Pruefen & freigeben", `data-ai-article-action="reviewRelease" data-article-id="${escapeHtml(article.id)}"`)}
        ${pictogram("!", "Beitrag sperren", `data-ai-article-action="block" data-article-id="${escapeHtml(article.id)}"`)}
      </div>
      <div id="ai-editorial-run-result"></div>
      <div id="ai-article-action-result"></div>
      <section class="panel ai-editor-panel" id="ai-editor-section-content" data-ai-editor-section="content">
        <form id="ai-article-edit-form" data-article-id="${escapeHtml(article.id)}" class="form-grid">
          <div class="editorial-workspace editorial-workspace--text-editor ai-newslike-editor">
            <div class="editorial-workspace__main">
              <div class="field editorial-text-field editorial-text-field--compact"><div class="editorial-field-head"><label>Titel / Headline</label><div class="ai-field-actions">${pictogram("+", "Headline erzeugen", `data-ai-article-action="headline" data-article-id="${escapeHtml(article.id)}"`)}</div></div><textarea name="headline" rows="2">${escapeHtml(displayHeadline || displayTitle)}</textarea></div>
              <div class="field editorial-text-field editorial-text-field--compact"><div class="editorial-field-head"><label>Subline</label><div class="ai-field-actions">${pictogram("=", "Subline erzeugen", `data-ai-article-action="summary" data-article-id="${escapeHtml(article.id)}"`)}</div></div><textarea name="subline" rows="2" maxlength="90">${escapeHtml(article.subline || article.subtitle || "")}</textarea></div>
              <div class="field editorial-text-field editorial-text-field--body"><div class="editorial-field-head"><label>Haupttext</label><div class="ai-field-actions">${pictogram("+", "Text vorbereiten", `data-ai-article-action="draftText" data-article-id="${escapeHtml(article.id)}"`)}${pictogram("R", "Text optimieren", `data-ai-article-action="optimizeText" data-article-id="${escapeHtml(article.id)}"`)}</div></div><textarea name="bodyText">${escapeHtml(article.body || article.bodyText || "")}</textarea></div>
              <div class="field editorial-text-field"><div class="editorial-field-head"><label>Shorttext / Intro</label><div class="ai-field-actions">${pictogram("=", "Kurztext erzeugen", `data-ai-article-action="summary" data-article-id="${escapeHtml(article.id)}"`)}</div></div><textarea name="introText">${escapeHtml(article.introText || article.shortText || article.teaserText || "")}</textarea></div>
            </div>
            <aside class="editorial-tools">
              <section class="editorial-meta-panel">
                <div class="editorial-tools__head"><p class="eyebrow">Meta</p><h3>Veroeffentlichung</h3></div>
                <div class="field"><label>Kategorie</label><input name="category" value="${escapeHtml(article.category || "")}"></div>
                <div class="field"><label>Status</label><select name="publication_status"><option value="Entwurf" ${article.publication_status === "Entwurf" ? "selected" : ""}>Entwurf</option><option value="pruefpflichtig" ${article.publication_status === "pruefpflichtig" ? "selected" : ""}>Pruefpflichtig</option><option value="freigegeben" ${article.publication_status === "freigegeben" ? "selected" : ""}>Freigegeben</option><option value="veroeffentlicht" ${article.publication_status === "veroeffentlicht" ? "selected" : ""}>Veroeffentlicht</option></select></div>
                <div class="field"><label>Redaktionelles Format</label><select name="publication_target"><option value="news" ${publicationTarget === "news" ? "selected" : ""}>Daily News</option><option value="topic" ${publicationTarget === "topic" ? "selected" : ""}>Langfristiges Thema</option><option value="monthly_topic" ${publicationTarget === "monthly_topic" ? "selected" : ""}>Thema des Monats</option></select></div>
                <div class="meta-date-row"><div class="field"><label>Geplant fuer</label><input type="date" name="scheduled_date" value="${escapeHtml((article.scheduled_at || article.scheduledAt || "").slice(0, 10))}"></div><div class="field"><label>Veroeffentlicht</label><input type="date" name="published_date" value="${escapeHtml((article.published_at || article.publishedAt || "").slice(0, 10))}"></div></div>
                <div class="ai-picto-row">${pictogram("UP", "Veroeffentlichen", `data-ai-article-action="publish" data-article-id="${escapeHtml(article.id)}"`, !canPublish)}</div>
              </section>
              <details class="editorial-tool-details"${thumbnailUrl ? " open" : ""} id="ai-editor-section-thumbnail" data-ai-editor-section="thumbnail">
                <summary><span>Medien</span><strong>Bild / Thumb</strong><small class="editorial-tool-state ${thumbnailUrl ? "editorial-tool-state--ready" : ""}">${thumbnailUrl ? "Thumb vorhanden" : "Kein Thumb"}</small></summary>
                <div class="editor-tool-section editor-tool-section--thumb">
                  <div class="ai-thumbnail-box">
                    <div class="ai-thumbnail-preview ${thumbnailUrl ? "has-image" : ""}">${thumbnailUrl ? `<img src="${escapeHtml(thumbnailUrl)}" alt="${escapeHtml(displayHeadline || "Thumbnail")}">` : `<span>Noch kein Thumbnail erzeugt</span>`}</div>
                    <div class="field ai-thumb-text-field"><label>Thumbnail-Idee</label><textarea name="thumbnail_idea" rows="3">${escapeHtml(article.thumbnail_idea || article.thumbnailIdea || "")}</textarea></div>
                    <div class="field ai-thumb-text-field"><label>Thumbnail-Prompt</label><textarea name="thumbnail_prompt" rows="3" placeholder="Optionaler Prompt fuer diesen Artikel. Ueberschreibt den Default-Prompt.">${escapeHtml(article.thumbnail_prompt || article.thumbnailPrompt || "")}</textarea></div>
                    <div class="ai-picto-row">${pictogram("IMG", "Thumbnail erzeugen", `data-ai-article-action="thumbnail" data-article-id="${escapeHtml(article.id)}"`)}</div>
                  </div>
                </div>
              </details>
              <details class="editorial-tool-details"${audioUrl ? " open" : ""} id="ai-editor-section-audio" data-ai-editor-section="audio">
                <summary><span>Audio</span><strong>Vorlesen</strong><small class="editorial-tool-state ${audioUrl ? "editorial-tool-state--ready" : ""}">${audioUrl ? "Audio vorhanden" : "Kein Audio"}</small></summary>
                <div class="editor-tool-section editor-tool-section--audio audio-generation-panel">
                  <p class="muted">${audioUrl ? "Audio ist gespeichert und kann im Frontend verwendet werden." : "Noch kein Audio gespeichert. Bitte Text speichern, dann Audio erzeugen."}</p>
                  ${audioUrl ? `<audio controls preload="none" src="${escapeHtml(audioUrl)}"></audio>` : ""}
                  <div class="ai-picto-row"><button type="button" class="ai-picto-button" data-generate-article-speech data-collection="editorialContent" data-record-id="${escapeHtml(article.id)}" data-audio-url="${escapeHtml(audioUrl)}"><span aria-hidden="true">A</span><strong>${audioUrl ? "Audio neu erzeugen" : "Audio erzeugen"}</strong></button></div>
                  <div data-speech-result></div>
                </div>
              </details>
              <details class="editorial-tool-details" id="ai-editor-section-seo" data-ai-editor-section="seo">
                <summary><span>SEO</span><strong>Meta / Keywords</strong><small class="editorial-tool-state ${article.seoTitle || article.seo_title ? "editorial-tool-state--ready" : ""}">${article.seoTitle || article.seo_title ? "SEO vorhanden" : "SEO offen"}</small></summary>
                <div class="editor-tool-section">
                  <div class="field"><label>Primaerkeyword</label><input name="primary_keyword" value="${escapeHtml(article.primary_keyword || article.primaryKeyword || "")}"></div>
                  <div class="field"><label>Slug</label><input name="slug" value="${escapeHtml(article.slug || "")}" placeholder="barrierefreiheit-streaming-anbieter"></div>
                  <div class="field"><label>SEO-Titel</label><input name="seoTitle" maxlength="70" value="${escapeHtml(article.seoTitle || article.seo_title || "")}"></div>
                  <div class="field"><label>Meta-Beschreibung</label><textarea name="seoDescription">${escapeHtml(article.seoDescription || article.seo_description || "")}</textarea></div>
                  <div class="field"><label>SEO-Keywords</label><input name="seoKeywords" value="${escapeHtml(article.seoKeywords || article.seo_keywords || "")}" placeholder="Keyword 1, Keyword 2, Keyword 3"></div>
                  <div class="ai-picto-row">${pictogram("SEO", "SEO erzeugen", `data-ai-article-action="seo" data-article-id="${escapeHtml(article.id)}"`)}${pictogram("+", "Keywords erzeugen", `data-ai-article-action="keywords" data-article-id="${escapeHtml(article.id)}"`)}</div>
                </div>
              </details>
            </aside>
          </div>
          <div class="actions"><button class="button button--primary" type="submit">Aenderungen speichern</button><span class="muted">Speichern setzt den Beitrag wieder auf pruefpflichtig.</span></div>
          <div id="ai-article-save-result"></div>
        </form>
      </section>
      <section class="panel" id="ai-editor-section-sources" data-ai-editor-section="sources">
        <h2>Quellen</h2>
        <div class="alert alert--warning">Keine Freigabe ohne mindestens zwei belastbare, gepruefte Quellen. URLs duerfen nicht erfunden werden.</div>
        <div class="ai-picto-row">${pictogram("OK", "Quellen pruefen", `data-ai-article-action="sources" data-article-id="${escapeHtml(article.id)}"`)}${pictogram("Q", "Belege bestaetigen", `data-ai-article-action="confirmClaims" data-article-id="${escapeHtml(article.id)}"`)}</div>
        ${articleSources.length ? `<div class="ai-source-grid">${sourceCards(articleSources)}</div>` : `<p class="muted">Noch keine Quellen gespeichert. Bitte echte Quellen mit erreichbarer URL erfassen.</p>`}
        <form id="ai-article-source-form" data-article-id="${escapeHtml(article.id)}" class="form-grid ai-source-entry-form">
          <h3>Quelle hinzufuegen</h3>
          <div class="form-grid--two">
            <div class="field"><label>Titel</label><input name="title" required placeholder="z. B. European Accessibility Act"></div>
            <div class="field"><label>Herausgeber</label><input name="publisher" required placeholder="z. B. EU-Kommission"></div>
            <div class="field"><label>URL</label><input name="url" type="url" required placeholder="https://..."></div>
            <div class="field"><label>Quellentyp</label><select name="source_type"><option>Primaerquelle</option><option>Behoerde</option><option>Verband</option><option>Fachmedium</option><option>Unternehmensmeldung</option><option>Standard / Spezifikation</option><option>Studie</option></select></div>
            <div class="field"><label>Trust-Score</label><input name="trust_score" type="number" min="0" max="100" value="70"></div>
            <div class="field"><label>Pruefstatus</label><select name="check_status"><option value="geprueft">geprueft</option><option value="teilweise geprueft">teilweise geprueft</option><option value="ungeprueft">ungeprueft</option></select></div>
          </div>
          <div class="field"><label>Belegte Aussage</label><textarea name="claim_reference" placeholder="Welche zentrale Aussage im Artikel wird durch diese Quelle belegt?"></textarea></div>
          <div class="field"><label>Relevanznotiz</label><textarea name="relevance_note" placeholder="Warum ist diese Quelle belastbar und relevant?"></textarea></div>
          <div class="actions"><button class="button button--primary">Quelle speichern</button></div>
          <div id="ai-source-save-result"></div>
        </form>
        <div class="table-wrap"><table class="table"><thead><tr><th>Quelle</th><th>Typ</th><th>Status</th><th>Trust</th><th>Link</th></tr></thead><tbody>${articleSources.length ? sourceRows(articleSources) : `<tr><td colspan="5">Noch keine Quellen gespeichert.</td></tr>`}</tbody></table></div>
      </section>
      <section class="panel" id="ai-editor-section-keywords" data-ai-editor-section="keywords"><h2>Keywords</h2><div class="ai-picto-row">${pictogram("+", "Keywords erzeugen", `data-ai-article-action="keywords" data-article-id="${escapeHtml(article.id)}"`)}${pictogram("SEO", "SEO erzeugen", `data-ai-article-action="seo" data-article-id="${escapeHtml(article.id)}"`)}</div><div class="ai-keyword-cloud">${articleKeywords.length ? articleKeywords.map((keyword) => `<span>${escapeHtml(keyword.keyword)} <strong>${Number(keyword.relevance_score || 0)}</strong></span>`).join("") : `<p class="muted">Noch keine Keywords gespeichert.</p>`}</div></section>
      <section class="panel" id="ai-editor-section-status" data-ai-editor-section="status"><h2>Status & Pruefung</h2><div class="ai-status-stack">${badge(article.source_status || "-")}${badge(article.duplicate_status || "-")}${badge(article.ai_check_status || "-")}${badge(article.legal_check_status || "offen")}${badge(article.publication_status || article.status || "Entwurf")}</div></section>
      <section class="panel" id="ai-editor-section-history" data-ai-editor-section="history"><h2>Verlauf</h2><div class="table-wrap"><table class="table"><thead><tr><th>Zeit</th><th>Aufgabe</th><th>Status</th><th>Meldung</th></tr></thead><tbody>${articleLogs.length ? logRows(articleLogs) : `<tr><td colspan="4">Noch kein Verlauf.</td></tr>`}</tbody></table></div></section>
    </div>
  </div>`;
}

function settingsForm(settings) {
  return `<form id="ai-editorial-settings-form" class="form-grid">
    <label class="checkbox"><input type="checkbox" name="automationEnabled" ${settings.automationEnabled ? "checked" : ""}> Automatisierung aktiv</label>
    <div class="form-grid--two">
      <div class="field"><label>Ausfuehrung</label><input name="scheduleLabel" value="${escapeHtml(settings.scheduleLabel || "Taeglich 06:00 Uhr")}"></div>
      <div class="field"><label>Publikationsmodus</label><select name="publicationMode">${Object.entries(publicationModes).map(([value, label]) => `<option value="${value}" ${settings.publicationMode === value ? "selected" : ""}>${label}</option>`).join("")}</select></div>
      <div class="field"><label>Mindestanzahl Quellen</label><input name="minimumSources" type="number" min="2" value="${Number(settings.minimumSources || 2)}"></div>
      <div class="field"><label>Mindest-Trust-Score</label><input name="minimumTrustScore" type="number" min="0" max="100" value="${Number(settings.minimumTrustScore || 70)}"></div>
    </div>
    <label class="checkbox"><input type="checkbox" name="allowAutoPublish" ${settings.allowAutoPublish ? "checked" : ""}> Automatisch veroeffentlichen nur bei vollstaendig bestandener Pruefung erlauben</label>
    <div class="alert alert--warning">Schutzregeln sind fest verdrahtet: keine Halluzinationen, keine erfundenen Quellen, keine Veroeffentlichung bei Dubletten oder unklarer Quellenlage.</div>
    <div class="actions"><button class="button button--primary">Einstellungen speichern</button></div>
    <div id="ai-editorial-settings-result"></div>
  </form>`;
}

function promptForm(currentPrompt = null) {
  const prompt = currentPrompt || {};
  const promptType = prompt.prompt_type || prompt.promptType || "Themenrecherche";
  const promptText = prompt.prompt_text || prompt.promptText || "";
  const systemInstructions = prompt.system_instructions || prompt.systemInstructions || "";
  return `<form id="ai-prompt-form" class="form-grid">
    <input type="hidden" name="prompt_id" value="${escapeHtml(prompt.id || "")}">
    <input type="hidden" name="name" value="${escapeHtml(prompt.name || "")}">
    <input type="hidden" name="prompt_type" value="${escapeHtml(promptType)}">
    <input type="hidden" name="description" value="${escapeHtml(prompt.description || "")}">
    <input type="hidden" name="model" value="${escapeHtml(prompt.model || "gpt-4.1-mini")}">
    <input type="hidden" name="temperature" value="${Number(prompt.temperature ?? 0.2)}">
    <input type="hidden" name="max_tokens" value="${Number(prompt.max_tokens || prompt.maxTokens || 1200)}">
    <input type="hidden" name="output_format" value="${escapeHtml(prompt.output_format || prompt.outputFormat || "json")}">
    <input type="hidden" name="prompt_seed_mode" value="free_text">
    <input type="hidden" name="prompt_chat_template" value="">
    <input type="hidden" name="prompt_seed_text" value="${escapeHtml(promptText || prompt.description || "")}">
    <input type="hidden" name="test_input_json" value='{"THEMA":"Barrierefreiheit in Streaming-Angeboten","QUELLEN":"EU-Kommission, W3C","TEXTLAENGE":"250 bis 350 Woerter"}'>
    <section class="prompt-simple-editor">
      <div class="prompt-simple-editor__meta">
        <div><span>Name</span><strong data-prompt-meta-name>${escapeHtml(prompt.name || "Neuer Prompt")}</strong></div>
        <div><span>Typ</span><strong data-prompt-meta-type>${escapeHtml(promptType)}</strong></div>
        <div><span>System</span><strong data-prompt-meta-system>${escapeHtml(prompt.model || "gpt-4.1-mini")} · Temp. ${Number(prompt.temperature ?? 0.2)} · ${Number(prompt.max_tokens || prompt.maxTokens || 1200)} Tokens</strong></div>
      </div>
      <div class="field"><label>Prompt-Text</label><textarea name="prompt_text" placeholder="Nutze Platzhalter wie {{THEMA}}, {{QUELLEN}}, {{HEUTIGES_DATUM}}">${escapeHtml(promptText)}</textarea></div>
      <div class="field prompt-system-field"><label>System-Instruktionen</label><textarea name="system_instructions" placeholder="Feste redaktionelle Leitplanken, z. B. keine Halluzinationen, keine erfundenen Quellen, keine Freigabe bei Dubletten.">${escapeHtml(systemInstructions)}</textarea></div>
      <div class="form-grid--two">
        <div class="field"><label>Status</label><select name="status">${["Entwurf", "wartet auf Freigabe", "freigegeben", "aktiv", "archiviert", "gesperrt"].map((status) => `<option ${status === (prompt.status || "aktiv") ? "selected" : ""}>${status}</option>`).join("")}</select></div>
        <div class="field"><label>Aenderungsnotiz</label><input name="change_note" placeholder="Was wurde am Prompt geaendert?"></div>
      </div>
    </section>
    <label class="checkbox"><input type="checkbox" name="is_active" ${prompt.is_active ? "checked" : ""}> Als aktiven Prompt verwenden</label>
    <div class="actions"><button class="button button--primary">Prompt speichern</button><button class="button button--secondary" type="button" data-ai-prompt-test>Prompt testen</button></div>
    <div id="ai-prompt-result"></div>
  </form>`;
}

function demoModeNotice() {
  if (!localPreviewMode()) return "";
  return `<div class="alert alert--warning ai-demo-mode-notice"><strong>Lokale Vorschau:</strong> Die Themenrecherche nutzt hier einen festen Demo-Themenpool. Echte Themenrecherche, Quellenabruf und produktive KI-Pruefung laufen erst ueber die deployte Cloud Function.</div>`;
}

export async function aiEditorialPage(section = "dashboard", query = new URLSearchParams()) {
  const active = section || "dashboard";
  let user = currentUser();
  if (!canUseCms(user)) user = await waitForAuthReady();
  if (!canUseCms(user)) user = await refreshAuthToken(true);
  if (!canUseCms(user)) return protect("");
  let [articles, sources, prompts, promptTests, keywords, logs, settingsRecord, topicSuggestions, topicQueue] = await Promise.all([
    list("editorialContent"),
    list("verified_sources"),
    list("ai_prompts"),
    list("ai_prompt_tests"),
    list("article_keywords"),
    list("ai_editorial_logs"),
    getOne("settings", "aiEditorial"),
    list("ai_topic_suggestions"),
    list("ai_topic_queue")
  ]);
  prompts = await ensureSystemPrompts(prompts);
  const aiArticles = articles.filter(isAiEditorialArticle);
  const sourceSuggestions = sources.filter((source) => source.suggested_by_ai || ["vorgeschlagen", "in Pruefung", "neu", "ungeprueft"].includes(source.review_status));
  const settings = {
    automationEnabled: false,
    publicationMode: "draft_only",
    minimumSources: 2,
    minimumTrustScore: 70,
    scheduleLabel: "Taeglich 06:00 Uhr",
    ...(settingsRecord || {})
  };
  const latestArticle = latest(aiArticles);
  const latestLog = latest(logs, "created_at");
  const openSuggestions = sortTopicSuggestions(topicSuggestions.filter((topic) => !["uebernommen", "abgelehnt", "ersetzt", "archiviert"].includes(topic.queue_status || topic.status)));
  const queuedTopics = topicQueue.filter((topic) => !["erledigt", "abgelehnt"].includes(topic.status));
  const editorId = query.get("id");
  const loadedArticle = editorId ? aiArticles.find((item) => item.id === editorId) || await getOne("editorialContent", editorId) : null;
  const articleForEditor = loadedArticle && isAiEditorialArticle(loadedArticle) ? loadedArticle : null;
  if (active === "editor" && articleForEditor) {
    return protect(cmsShell("cms/ai-editorial/articles", `${cmsTitle("KI-Redaktion", "Artikel-Editor", `<a class="button button--secondary button--small" href="#/cms/ai-editorial/articles">Zurueck</a>`)}${nav("articles")}${editor(articleForEditor, sources, keywords, logs)}`));
  }
  const createLabel = localPreviewMode() ? "Demo-Beitrag erzeugen" : "KI-Beitrag jetzt erzeugen";
  const headerActions = "";
  const topicResearchPanel = `<section class="panel ai-topic-research-panel"><h2>Themenrecherche</h2><p class="muted">Die KI erstellt zuerst 10 Themenvorschlaege mit Aktualitaetsbewertung. Quellen- und Dublettenpruefung erfolgen automatisch im Editor nach Auswahl eines Beitrags.</p><div class="form-grid--two ai-topic-research-controls"><div class="field"><label>Kategorie</label><select id="ai-topic-research-category">${topicResearchCategories.map((category) => `<option value="${category === "Alle Themenbereiche" ? "" : escapeHtml(category)}">${escapeHtml(category)}</option>`).join("")}</select></div><div class="field"><label>Stichworte</label><input id="ai-topic-research-keywords" placeholder="z. B. FAST, GEMA, Voice-Cloning"></div></div><div class="ai-picto-row">${pictogram("?", "Recherche starten", "data-ai-topic-research")}</div><div id="ai-topic-research-result"></div>${openSuggestions.length ? `<form id="ai-topic-suggestions-form"><div class="table-wrap"><table class="table table--topic-suggestions"><thead><tr><th>Thema</th><th>Kategorie</th><th>Aktualitaet</th><th>Status</th></tr></thead><tbody>${topicSuggestionRows(openSuggestions.slice(0, 10))}</tbody></table></div><div class="actions"><button class="button button--primary">OK - ausgewaehlte als Beitraege anlegen</button></div></form>` : `<div class="alert">Noch keine offenen Themenvorschlaege. Starte eine Themenrecherche.</div>`}</section><section class="panel"><h2>Themen-Queue</h2><div class="table-wrap"><table class="table"><thead><tr><th>Thema</th><th>Kategorie</th><th>Aktualitaet</th><th>Status</th><th>Datum</th></tr></thead><tbody>${queuedTopics.length ? topicQueueRows(queuedTopics) : `<tr><td colspan="5">Noch keine Themen in der Queue.</td></tr>`}</tbody></table></div></section>`;
  const content = {
    dashboard: `${cmsTitle("KI-Redaktion", "Themenliste")}
      ${nav(active)}
      ${demoModeNotice()}
      ${topicResearchPanel}
      <div id="ai-editorial-run-result"></div>`,
    articles: `${cmsTitle("KI-Redaktion", "Beitraege")}${nav(active)}${demoModeNotice()}<section class="panel"><div class="table-wrap"><table class="table table--editorial"><thead><tr><th>Beitrag</th><th>Herkunft</th><th>Kategorie</th><th>Quellen</th><th>Dubletten</th><th>KI-Pruefung</th><th>Status</th><th>Datum</th></tr></thead><tbody>${aiArticles.length ? articleRows(aiArticles) : `<tr><td colspan="8">Noch keine KI-Beitraege.</td></tr>`}</tbody></table></div></section><div id="ai-editorial-run-result"></div>`,
    sources: `${cmsTitle("KI-Redaktion", "Verifizierte Quellen")}${nav(active)}<section class="panel"><div class="table-wrap"><table class="table"><thead><tr><th>Quelle</th><th>Typ</th><th>Status</th><th>Trust</th><th>Link</th></tr></thead><tbody>${sources.length ? sourceRows(sources) : `<tr><td colspan="5">Noch keine Quellen erfasst.</td></tr>`}</tbody></table></div></section>`,
    suggestions: `${cmsTitle("KI-Redaktion", "Quellenvorschlaege")}${nav(active)}<section class="panel"><div class="table-wrap"><table class="table"><thead><tr><th>Quelle</th><th>Typ</th><th>Status</th><th>Trust</th><th>Aktion</th></tr></thead><tbody>${sourceSuggestions.length ? sourceSuggestions.map((source) => `<tr><td><strong>${escapeHtml(source.name || source.title || "-")}</strong><small>${escapeHtml(source.suggestion_reason || source.domain || "")}</small></td><td>${escapeHtml(source.source_type || "-")}</td><td>${badge(source.review_status || "vorgeschlagen")}</td><td>${Number(source.suggested_trust_score || source.trust_score || 0)}</td><td><button class="button button--secondary button--small" data-ai-source-review="${escapeHtml(source.id)}" data-review-status="in Pruefung">in Pruefung</button></td></tr>`).join("") : `<tr><td colspan="5">Keine neuen Quellenvorschlaege.</td></tr>`}</tbody></table></div></section><div id="ai-source-review-result"></div>`,
    prompts: `${cmsTitle("KI-Redaktion", "Prompt-Verwaltung")}${nav(active)}<section class="panel prompt-navigation-panel"><h2>Prompt-Navigation</h2>${promptNameNavigation(prompts)}</section><section class="panel prompt-edit-panel"><h2>Prompt anlegen / bearbeiten</h2>${promptForm(prompts.find((prompt) => !isArchivedPrompt(prompt)) || null)}</section><section class="panel"><h2>System-Prompts</h2><div class="table-wrap"><table class="table table--prompts"><thead><tr><th>Name</th><th>Typ</th><th>Aktueller Prompt</th><th>Status</th><th>Aktiv</th><th>Version</th><th>Geaendert</th><th>Aktion</th></tr></thead><tbody>${promptCatalogRows(prompts)}</tbody></table></div></section><section class="panel"><h2>Letzte Prompt-Tests</h2><div class="table-wrap"><table class="table"><thead><tr><th>Zeit</th><th>Prompt</th><th>Status</th><th>Warnungen</th></tr></thead><tbody>${promptTests.length ? promptTestRows([...promptTests].reverse().slice(0, 8)) : `<tr><td colspan="4">Noch keine Prompt-Tests.</td></tr>`}</tbody></table></div></section>`,
    keywords: `${cmsTitle("KI-Redaktion", "Keywords")}${nav(active)}<section class="panel"><div class="ai-keyword-cloud">${keywords.length ? keywords.map((keyword) => `<span>${escapeHtml(keyword.keyword)} <strong>${Number(keyword.relevance_score || 0)}</strong></span>`).join("") : `<p class="muted">Noch keine KI-Keywords gespeichert.</p>`}</div></section>`,
    automation: `${cmsTitle("KI-Redaktion", "Automatisierung")}${nav(active)}${demoModeNotice()}<div class="cms-columns"><section class="panel"><h2>Status</h2><div class="setup-steps"><div class="setup-step"><span>Automatisierung</span>${badge(settings.automationEnabled ? "Automatik aktiv" : "inaktiv")}</div><div class="setup-step"><span>Letzter Lauf</span><strong>${escapeHtml(formatDateTime(latestLog?.created_at || latestLog?.createdAt || "")) || "-"}</strong></div><div class="setup-step"><span>Letzte Warnung</span><strong>${escapeHtml(logs.find((log) => String(log.status || "").toLowerCase().includes("warn"))?.message || "-")}</strong></div></div><div class="ai-picto-row">${pictogram(">", "Automatik aktivieren", 'data-ai-editorial-automation="start"')}${pictogram("||", "Automatik pausieren", 'data-ai-editorial-automation="pause"')}</div><div id="ai-editorial-run-result"></div></section><section class="panel"><h2>Einstellungen</h2>${settingsForm(settings)}</section></div>`,
    logs: `${cmsTitle("KI-Redaktion", "Logs / Pruefberichte")}${nav(active)}<section class="panel"><div class="table-wrap"><table class="table"><thead><tr><th>Zeit</th><th>Aufgabe</th><th>Status</th><th>Meldung</th></tr></thead><tbody>${logs.length ? logRows([...logs].reverse()) : `<tr><td colspan="4">Noch keine KI-Redaktionslogs.</td></tr>`}</tbody></table></div></section>`,
    settings: `${cmsTitle("KI-Redaktion", "Einstellungen")}${nav(active)}<section class="panel">${settingsForm(settings)}</section>`
  }[active] || "";
  return protect(cmsShell(`cms/ai-editorial/${active}`, content));
}
