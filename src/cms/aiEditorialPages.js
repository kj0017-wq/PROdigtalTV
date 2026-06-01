import { cmsShell, cmsTitle } from "./cmsLayout.js";
import { list, getOne } from "../firebase/dataService.js";
import { localPreviewMode } from "../firebase/firebaseClient.js";
import { currentUser, canUseCms } from "../firebase/authService.js";
import { escapeHtml, formatDateTime, formatShortDate } from "../utils/format.js";

const sections = [
  ["dashboard", "Dashboard"],
  ["articles", "Beitraege"],
  ["sources", "Quellen"],
  ["suggestions", "Quellenvorschlaege"],
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

function protect(content) {
  const user = currentUser();
  if (!canUseCms(user)) {
    return `<section class="login-wrap"><div class="form-card login-card"><p class="eyebrow">Zugriff geschuetzt</p><h1>CMS-Login erforderlich</h1><p style="margin:14px 0 24px">Die KI-Redaktion steht Administratoren und Redakteuren zur Verfuegung.</p><a class="button button--primary" href="#/login">Anmelden</a></div></section>`;
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
    const matches = prompts.filter((prompt) => (prompt.prompt_type || prompt.promptType) === type && !isArchivedPrompt(prompt));
    const prompt = latest(matches, "updated_at");
    if (!prompt) {
      return `<tr>
        <td><strong>${escapeHtml(label)}</strong><small>Kein eigener aktiver Prompt. System-Fallback bleibt als Sicherheitsnetz aktiv.</small></td>
        <td>${escapeHtml(type)}</td>
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
      <td>${badge(prompt.status || "Entwurf")}</td>
      <td>${prompt.is_active ? badge("aktiv") : badge("inaktiv")}</td>
      <td>v${Number(prompt.version || 1)}</td>
      <td>${escapeHtml(formatShortDate(prompt.updated_at || prompt.updatedAt || prompt.created_at || ""))}</td>
      <td class="table-actions table-actions--icons">${iconButton(iconEdit, `${label} bearbeiten`, `data-ai-prompt-edit="${escapeHtml(prompt.id)}"`)}${iconButton(iconTrash, `${label} loeschen`, `data-ai-prompt-delete="${escapeHtml(prompt.id)}"` )}</td>
    </tr>`;
  }).join("");
}

function promptTestRows(tests) {
  return tests.map((test) => `<tr>
    <td>${escapeHtml(formatDateTime(test.created_at || test.createdAt || "")) || "-"}</td>
    <td>${escapeHtml(test.prompt_name || test.promptName || test.prompt_id || "-")}</td>
    <td>${badge(test.test_status || test.testStatus || "-")}</td>
    <td>${escapeHtml((test.warnings_json || test.warningsJson || []).join(", ") || "Keine Warnungen")}</td>
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
  const createLabel = localPreviewMode() ? "Demo-Beitrag erzeugen" : "Neu erzeugen";
  const thumbnailUrl = article.thumbnail_url || article.thumbnailUrl || article.imageUrl || "";
  const canPublish = article.source_status === "geprueft"
    && !String(article.duplicate_status || "").toLowerCase().includes("dublette")
    && article.ai_check_status === "bestanden"
    && ["freigegeben", "geplant", "published", "veroeffentlicht"].includes(article.publication_status || article.status);
  return `<div class="ai-editor-shell">
    <div class="ai-editor-main">
      <div class="ai-editor-head">
        <div><p class="eyebrow">Beitraege &gt; Artikel bearbeiten</p><h2>${escapeHtml(displayHeadline)}</h2></div>
        <div class="ai-status-stack">${badge(origin.label)}${badge(article.publication_status || article.status || "Entwurf")}</div>
      </div>
      <div class="ai-editor-actions">
        ${pictogram("+", createLabel, 'data-ai-editorial-run="manual"')}
        ${pictogram("O", "Vorschau", `data-ai-article-action="preview" data-article-id="${escapeHtml(article.id)}"`)}
        ${pictogram("OK", "KI-Pruefung", `data-ai-article-action="check" data-article-id="${escapeHtml(article.id)}"`)}
        ${pictogram("Q", "Belege bestaetigen", `data-ai-article-action="confirmClaims" data-article-id="${escapeHtml(article.id)}"`)}
        ${pictogram("OK", "Freigeben", `data-ai-article-action="approve" data-article-id="${escapeHtml(article.id)}"`)}
        ${pictogram("UP", "Veroeffentlichen", `data-ai-article-action="publish" data-article-id="${escapeHtml(article.id)}"`, !canPublish)}
        ${pictogram("!", "Beitrag sperren", `data-ai-article-action="block" data-article-id="${escapeHtml(article.id)}"`)}
      </div>
      <div id="ai-editorial-run-result"></div>
      <div id="ai-article-action-result"></div>
      <nav class="tabs ai-editor-tabs">${[
        ["content", "Inhalt"],
        ["sources", "Quellen"],
        ["keywords", "Keywords"],
        ["seo", "SEO / Meta"],
        ["thumbnail", "Thumbnail"],
        ["status", "Status & Pruefung"],
        ["history", "Verlauf"]
      ].map(([target, label], index) => `<button class="${index === 0 ? "active" : ""}" type="button" data-ai-editor-tab="${target}">${escapeHtml(label)}</button>`).join("")}</nav>
      <section class="panel ai-editor-panel" id="ai-editor-section-content" data-ai-editor-section="content">
        <form id="ai-article-edit-form" data-article-id="${escapeHtml(article.id)}" class="form-grid">
          <div class="field"><label>Titel / Headline</label><input name="headline" value="${escapeHtml(displayHeadline || displayTitle)}"></div>
          <div class="field"><label>Subline / Thubline</label><input name="subline" maxlength="90" value="${escapeHtml(article.subline || article.subtitle || "")}"></div>
          <div class="form-grid--two">
            <div class="field"><label>Kategorie</label><input name="category" value="${escapeHtml(article.category || "")}"></div>
            <div class="field"><label>Primaerkeyword</label><input name="primary_keyword" value="${escapeHtml(article.primary_keyword || article.primaryKeyword || "")}"></div>
          </div>
          <div class="field"><label>Beitragstext</label><textarea name="bodyText">${escapeHtml(article.body || article.bodyText || "")}</textarea></div>
          <div class="ai-picto-row ai-text-tools">
            ${pictogram("+", "Text vorbereiten", `data-ai-article-action="draftText" data-article-id="${escapeHtml(article.id)}"`)}
            ${pictogram("OK", "Text pruefen", `data-ai-article-action="check" data-article-id="${escapeHtml(article.id)}"`)}
            ${pictogram("R", "Text optimieren", `data-ai-article-action="optimizeText" data-article-id="${escapeHtml(article.id)}"`)}
            ${pictogram("=", "Zusammenfassung", `data-ai-article-action="summary" data-article-id="${escapeHtml(article.id)}"`)}
          </div>
          <div class="form-grid--two" id="ai-editor-section-thumbnail" data-ai-editor-section="thumbnail">
            <div class="field"><label>Thumbnail-Idee</label><textarea name="thumbnail_idea">${escapeHtml(article.thumbnail_idea || article.thumbnailIdea || "")}</textarea></div>
            <div class="field"><label>Thumbnail-Prompt</label><textarea name="thumbnail_prompt" placeholder="Optional: eigener Prompt fuer genau diesen Artikel. Ueberschreibt den Default-Prompt.">${escapeHtml(article.thumbnail_prompt || article.thumbnailPrompt || "")}</textarea></div>
          </div>
          <div class="form-grid--two" id="ai-editor-section-seo" data-ai-editor-section="seo">
            <div class="field"><label>Slug</label><input name="slug" value="${escapeHtml(article.slug || "")}" placeholder="barrierefreiheit-streaming-anbieter"></div>
            <div class="field"><label>SEO-Titel</label><input name="seoTitle" maxlength="70" value="${escapeHtml(article.seoTitle || article.seo_title || "")}"></div>
          </div>
          <div class="field"><label>Meta-Beschreibung</label><textarea name="seoDescription">${escapeHtml(article.seoDescription || article.seo_description || "")}</textarea></div>
          <div class="ai-picto-row">${pictogram("SEO", "SEO erzeugen", `data-ai-article-action="seo" data-article-id="${escapeHtml(article.id)}"`)}</div>
          <div class="ai-thumbnail-box">
            <div class="ai-thumbnail-preview ${thumbnailUrl ? "has-image" : ""}">${thumbnailUrl ? `<img src="${escapeHtml(thumbnailUrl)}" alt="${escapeHtml(displayHeadline || "Thumbnail")}">` : `<span>Noch kein Thumbnail erzeugt</span>`}</div>
            <div class="ai-picto-row">${pictogram("IMG", "Thumbnail erzeugen", `data-ai-article-action="thumbnail" data-article-id="${escapeHtml(article.id)}"`)}</div>
          </div>
          <div class="actions"><button class="button button--primary" type="submit">Aenderungen speichern</button><span class="muted">Speichern setzt den Beitrag wieder auf pruefpflichtig.</span></div>
          <div id="ai-article-save-result"></div>
        </form>
      </section>
      <section class="panel" id="ai-editor-section-sources" data-ai-editor-section="sources"><h2>Quellen</h2><div class="ai-picto-row">${pictogram("OK", "Quellen pruefen", `data-ai-article-action="sources" data-article-id="${escapeHtml(article.id)}"`)}${pictogram("Q", "Belege zuordnen", `data-ai-article-action="mapClaims" data-article-id="${escapeHtml(article.id)}"`)}</div>${articleSources.length ? `<div class="ai-source-grid">${sourceCards(articleSources)}</div>` : `<p class="muted">Noch keine Quellen gespeichert.</p>`}<div class="table-wrap"><table class="table"><thead><tr><th>Quelle</th><th>Typ</th><th>Status</th><th>Trust</th><th>Link</th></tr></thead><tbody>${articleSources.length ? sourceRows(articleSources) : `<tr><td colspan="5">Noch keine Quellen gespeichert.</td></tr>`}</tbody></table></div></section>
      <section class="panel" id="ai-editor-section-keywords" data-ai-editor-section="keywords"><h2>Keywords</h2><div class="ai-picto-row">${pictogram("+", "Keywords erzeugen", `data-ai-article-action="keywords" data-article-id="${escapeHtml(article.id)}"`)}</div><div class="ai-keyword-cloud">${articleKeywords.length ? articleKeywords.map((keyword) => `<span>${escapeHtml(keyword.keyword)} <strong>${Number(keyword.relevance_score || 0)}</strong></span>`).join("") : `<p class="muted">Noch keine Keywords gespeichert.</p>`}</div></section>
      <section class="panel" id="ai-editor-section-status" data-ai-editor-section="status"><h2>Status & Pruefung</h2><div class="ai-status-stack">${badge(article.source_status || "-")}${badge(article.duplicate_status || "-")}${badge(article.ai_check_status || "-")}${badge(article.legal_check_status || "offen")}${badge(article.publication_status || article.status || "Entwurf")}</div></section>
      <section class="panel" id="ai-editor-section-history" data-ai-editor-section="history"><h2>Verlauf</h2><div class="table-wrap"><table class="table"><thead><tr><th>Zeit</th><th>Aufgabe</th><th>Status</th><th>Meldung</th></tr></thead><tbody>${articleLogs.length ? logRows(articleLogs) : `<tr><td colspan="4">Noch kein Verlauf.</td></tr>`}</tbody></table></div></section>
    </div>
    <aside class="ai-editor-side">
      <section class="panel"><h2>Herkunft</h2><div class="ai-status-stack">${badge(origin.label)}</div><p class="muted">${escapeHtml(origin.note)}</p></section>
      <section class="panel"><h2>Veroeffentlichung</h2><div class="fact"><label>Status</label><strong>${escapeHtml(article.publication_status || article.status || "Entwurf")}</strong></div><div class="fact"><label>Geplant fuer</label><strong>${escapeHtml(article.scheduled_at || "-")}</strong></div><div class="fact"><label>Artikel-ID</label><strong>${escapeHtml(article.id || "-")}</strong></div></section>
      <section class="panel"><h2>Pruefstatus</h2><div class="ai-status-stack">${badge(article.source_status || "-")}${badge(article.duplicate_status || "-")}${badge(article.ai_check_status || "-")}${badge(article.legal_check_status || "offen")}</div></section>
      <section class="panel"><h2>Quellenuebersicht</h2><p>${articleSources.length} Quellen</p>${articleSources.slice(0, 3).map((source) => `<div class="fact"><label>${escapeHtml(source.publisher || source.name || source.title || "Quelle")}</label><strong>${Number(source.trust_score || 0)}</strong></div>`).join("")}</section>
      <section class="panel"><h2>Keywords</h2><p>${escapeHtml(article.primary_keyword || article.primaryKeyword || "-")}</p><div class="ai-keyword-cloud">${articleKeywords.slice(0, 5).map((keyword) => `<span>${escapeHtml(keyword.keyword)}</span>`).join("")}</div></section>
    </aside>
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

function promptForm() {
  return `<form id="ai-prompt-form" class="form-grid">
    <input type="hidden" name="prompt_id" value="">
    <section class="ai-inline-builder">
      <h3>Einfacher Assistent</h3>
      <div class="form-grid--two">
        <div class="field"><label>Was soll die KI tun?</label><select name="prompt_chat_template"><option value="">Eigene Aufgabe</option><option value="article_text">Artikeltext schreiben</option><option value="source_check">Quellen pruefen</option><option value="duplicate_check">Dubletten erkennen</option><option value="final_check">Beitrag vor Freigabe pruefen</option><option value="thumbnail">Thumbnail-Idee erstellen</option><option value="thumbnail_generation">Thumbnail erstellen</option><option value="keywords">Keywords erzeugen</option><option value="seo">SEO-Daten vorbereiten</option></select></div>
        <div class="field"><label>Ausgangspunkt</label><select name="prompt_seed_mode"><option value="free_text">Normale Beschreibung</option><option value="chat">Beispiel-Chat / Ablauf</option></select></div>
      </div>
      <div class="field"><label>Beschreibe die Aufgabe in normaler Sprache</label><textarea name="prompt_seed_text" placeholder="Beispiel: Die KI soll einen fertigen Artikel vor der Freigabe pruefen. Sie soll kontrollieren, ob mindestens zwei gepruefte Quellen vorhanden sind, keine Dublette vorliegt, alle wichtigen Aussagen belegbar sind und keine erfundenen Angaben enthalten sind."></textarea></div>
      <div class="actions">${iconButton(">", "Eingaben vorbereiten", "data-ai-prompt-generate-from-source")}</div>
    </section>
    <details class="ai-advanced-prompt-fields">
      <summary>Technische Details anzeigen</summary>
    <div class="form-grid--two">
      <div class="field"><label>Name</label><input name="name" placeholder="z. B. Endpruefung Quellen und Dubletten"></div>
      <div class="field"><label>Prompt-Typ</label><select name="prompt_type">${promptTypes.map((type) => `<option>${escapeHtml(type)}</option>`).join("")}</select></div>
    </div>
    <div class="field"><label>Beschreibung</label><input name="description"></div>
    <div class="field"><label>System-Instruktionen</label><textarea name="system_instructions" placeholder="Feste redaktionelle Leitplanken..."></textarea></div>
    <div class="field"><label>Prompt-Text</label><textarea name="prompt_text" placeholder="Nutze Platzhalter wie {{THEMA}}, {{QUELLEN}}, {{HEUTIGES_DATUM}}"></textarea></div>
    <div class="field"><label>Testdaten JSON</label><textarea name="test_input_json" placeholder='{"THEMA":"Barrierefreiheit in Streaming-Angeboten","QUELLEN":"EU-Kommission, W3C","TEXTLAENGE":"250 bis 350 Woerter"}'></textarea></div>
    <div class="form-grid--two">
      <div class="field"><label>Modell</label><input name="model" value="gpt-4.1-mini"></div>
      <div class="field"><label>Temperatur</label><input name="temperature" type="number" step="0.1" min="0" max="1" value="0.2"></div>
      <div class="field"><label>Max Tokens</label><input name="max_tokens" type="number" min="100" value="1200"></div>
      <div class="field"><label>Output-Format</label><input name="output_format" value="json"></div>
      <div class="field"><label>Status</label><select name="status"><option>Entwurf</option><option>wartet auf Freigabe</option><option>freigegeben</option><option>aktiv</option><option>archiviert</option><option>gesperrt</option></select></div>
      <div class="field"><label>Aenderungsnotiz</label><input name="change_note" placeholder="Warum wurde der Prompt angelegt oder geaendert?"></div>
    </div>
    </details>
    <label class="checkbox"><input type="checkbox" name="is_active"> Als aktiven Prompt verwenden</label>
    <div class="actions"><button class="button button--primary">Prompt speichern</button><button class="button button--secondary" type="button" data-ai-prompt-test>Prompt testen</button></div>
    <div id="ai-prompt-result"></div>
  </form>`;
}

function demoModeNotice() {
  if (!localPreviewMode()) return "";
  return `<div class="alert alert--warning ai-demo-mode-notice"><strong>Lokale Vorschau:</strong> Neue KI-Beitraege werden hier aus einem festen Demo-Themenpool erzeugt. Echte Themenrecherche, Quellenabruf und produktive KI-Pruefung laufen erst ueber die deployte Cloud Function.</div>`;
}

export async function aiEditorialPage(section = "dashboard", query = new URLSearchParams()) {
  const active = section || "dashboard";
  if (!canUseCms(currentUser())) return protect("");
  const [articles, sources, prompts, promptTests, keywords, logs, settingsRecord] = await Promise.all([
    list("editorialContent"),
    list("verified_sources"),
    list("ai_prompts"),
    list("ai_prompt_tests"),
    list("article_keywords"),
    list("ai_editorial_logs"),
    getOne("settings", "aiEditorial")
  ]);
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
  const editorId = query.get("id");
  const loadedArticle = editorId ? aiArticles.find((item) => item.id === editorId) || await getOne("editorialContent", editorId) : null;
  const articleForEditor = loadedArticle && isAiEditorialArticle(loadedArticle) ? loadedArticle : null;
  if (active === "editor" && articleForEditor) {
    return protect(cmsShell("cms/ai-editorial/articles", `${cmsTitle("KI-Redaktion", "Artikel-Editor", `<a class="button button--secondary button--small" href="#/cms/ai-editorial/articles">Zurueck</a>`)}${nav("articles")}${editor(articleForEditor, sources, keywords, logs)}`));
  }
  const createLabel = localPreviewMode() ? "Demo-Beitrag erzeugen" : "KI-Beitrag jetzt erzeugen";
  const headerActions = `${pictogram("+", createLabel, 'data-ai-editorial-run="manual"')}${linkPictogram("=", "Logs oeffnen", "#/cms/ai-editorial/logs")}`;
  const content = {
    dashboard: `${cmsTitle("KI-Redaktion", "Dashboard", headerActions)}
      ${nav(active)}
      ${demoModeNotice()}
      <div class="ai-picto-row ai-picto-row--large">${pictogram("+", createLabel, 'data-ai-editorial-run="manual"')}${pictogram("OK", "Quellen pruefen")}${pictogram("O", "Dubletten pruefen")}${linkPictogram("T", "Prompt testen", "#/cms/ai-editorial/prompts")}${pictogram(">", "Automatik starten", 'data-ai-editorial-automation="start"')}${pictogram("||", "Automatik pausieren", 'data-ai-editorial-automation="pause"')}${linkPictogram("=", "Logs oeffnen", "#/cms/ai-editorial/logs")}</div>
      <div class="ai-dashboard-grid">
        <section class="panel"><h2>Automatisierung</h2><div class="setup-steps"><div class="setup-step"><span>Status</span>${badge(settings.automationEnabled ? "Automatik aktiv" : "inaktiv")}</div><div class="setup-step"><span>Letzter Lauf</span><strong>${escapeHtml(formatDateTime(latestLog?.created_at || latestLog?.createdAt || "")) || "-"}</strong></div><div class="setup-step"><span>Naechster Lauf</span><strong>${escapeHtml(settings.scheduleLabel || "Taeglich 06:00 Uhr")}</strong></div></div></section>
        <section class="panel"><h2>Letzter KI-Beitrag</h2>${latestArticle ? `<h3>${escapeHtml(latestArticle.headline || latestArticle.title)}</h3><p class="muted">${escapeHtml(articleOrigin(latestArticle).note)}</p><div class="ai-status-stack">${badge(articleOrigin(latestArticle).label)}${badge(latestArticle.source_status || "-")}${badge(latestArticle.duplicate_status || "-")}${badge(latestArticle.publication_status || latestArticle.status || "-")}</div>` : `<p>Noch kein KI-Beitrag gespeichert.</p>`}</section>
        <section class="panel"><h2>Pruefpflichtige Beitraege</h2><strong class="ai-big-number">${aiArticles.filter((item) => String(item.publication_status || item.status || "").includes("pruef")).length}</strong><a class="button button--secondary button--small" href="#/cms/ai-editorial/articles">anzeigen</a></section>
        <section class="panel"><h2>Neue Quellenvorschlaege</h2><strong class="ai-big-number">${sourceSuggestions.length}</strong><a class="button button--secondary button--small" href="#/cms/ai-editorial/suggestions">pruefen</a></section>
        <section class="panel"><h2>Warnungen / Sperren</h2><div class="setup-steps"><div class="setup-step"><span>Dubletten</span><strong>${aiArticles.filter((item) => String(item.duplicate_status || "").toLowerCase().includes("dublette")).length}</strong></div><div class="setup-step"><span>Quellenwarnungen</span><strong>${aiArticles.filter((item) => String(item.source_status || "").toLowerCase().includes("unzureichend")).length}</strong></div><div class="setup-step"><span>Fehler</span><strong>${logs.filter((log) => String(log.status || "").toLowerCase().includes("fehler")).length}</strong></div></div></section>
        <section class="panel"><h2>Prompt-Verwaltung</h2><div class="setup-steps"><div class="setup-step"><span>Aktive Prompts</span><strong>${prompts.filter((prompt) => prompt.is_active).length}</strong></div><div class="setup-step"><span>Letzte Aenderung</span><strong>${escapeHtml(formatShortDate(latest(prompts, "updated_at")?.updated_at || "")) || "-"}</strong></div></div><a class="button button--secondary button--small" href="#/cms/ai-editorial/prompts">bearbeiten</a></section>
      </div>
      <div id="ai-editorial-run-result"></div>`,
    articles: `${cmsTitle("KI-Redaktion", "Beitraege", headerActions)}${nav(active)}${demoModeNotice()}<section class="panel"><div class="table-wrap"><table class="table table--editorial"><thead><tr><th>Beitrag</th><th>Herkunft</th><th>Kategorie</th><th>Quellen</th><th>Dubletten</th><th>KI-Pruefung</th><th>Status</th><th>Datum</th></tr></thead><tbody>${aiArticles.length ? articleRows(aiArticles) : `<tr><td colspan="8">Noch keine KI-Beitraege.</td></tr>`}</tbody></table></div></section><div id="ai-editorial-run-result"></div>`,
    sources: `${cmsTitle("KI-Redaktion", "Verifizierte Quellen")}${nav(active)}<section class="panel"><div class="table-wrap"><table class="table"><thead><tr><th>Quelle</th><th>Typ</th><th>Status</th><th>Trust</th><th>Link</th></tr></thead><tbody>${sources.length ? sourceRows(sources) : `<tr><td colspan="5">Noch keine Quellen erfasst.</td></tr>`}</tbody></table></div></section>`,
    suggestions: `${cmsTitle("KI-Redaktion", "Quellenvorschlaege")}${nav(active)}<section class="panel"><div class="table-wrap"><table class="table"><thead><tr><th>Quelle</th><th>Typ</th><th>Status</th><th>Trust</th><th>Aktion</th></tr></thead><tbody>${sourceSuggestions.length ? sourceSuggestions.map((source) => `<tr><td><strong>${escapeHtml(source.name || source.title || "-")}</strong><small>${escapeHtml(source.suggestion_reason || source.domain || "")}</small></td><td>${escapeHtml(source.source_type || "-")}</td><td>${badge(source.review_status || "vorgeschlagen")}</td><td>${Number(source.suggested_trust_score || source.trust_score || 0)}</td><td><button class="button button--secondary button--small" data-ai-source-review="${escapeHtml(source.id)}" data-review-status="in Pruefung">in Pruefung</button></td></tr>`).join("") : `<tr><td colspan="5">Keine neuen Quellenvorschlaege.</td></tr>`}</tbody></table></div></section><div id="ai-source-review-result"></div>`,
    prompts: `${cmsTitle("KI-Redaktion", "Prompt-Verwaltung")}${nav(active)}<div class="cms-columns"><section class="panel"><h2>System-Prompts</h2><div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Typ</th><th>Status</th><th>Aktiv</th><th>Version</th><th>Geaendert</th><th>Aktion</th></tr></thead><tbody>${promptCatalogRows(prompts)}</tbody></table></div><h2>Letzte Prompt-Tests</h2><div class="table-wrap"><table class="table"><thead><tr><th>Zeit</th><th>Prompt</th><th>Status</th><th>Warnungen</th></tr></thead><tbody>${promptTests.length ? promptTestRows([...promptTests].reverse().slice(0, 8)) : `<tr><td colspan="4">Noch keine Prompt-Tests.</td></tr>`}</tbody></table></div></section><section class="panel"><h2>Prompt anlegen / bearbeiten</h2>${promptForm()}</section></div>`,
    keywords: `${cmsTitle("KI-Redaktion", "Keywords")}${nav(active)}<section class="panel"><div class="ai-keyword-cloud">${keywords.length ? keywords.map((keyword) => `<span>${escapeHtml(keyword.keyword)} <strong>${Number(keyword.relevance_score || 0)}</strong></span>`).join("") : `<p class="muted">Noch keine KI-Keywords gespeichert.</p>`}</div></section>`,
    automation: `${cmsTitle("KI-Redaktion", "Automatisierung", headerActions)}${nav(active)}${demoModeNotice()}<div class="cms-columns"><section class="panel"><h2>Status</h2><div class="setup-steps"><div class="setup-step"><span>Automatisierung</span>${badge(settings.automationEnabled ? "Automatik aktiv" : "inaktiv")}</div><div class="setup-step"><span>Letzter Lauf</span><strong>${escapeHtml(formatDateTime(latestLog?.created_at || latestLog?.createdAt || "")) || "-"}</strong></div><div class="setup-step"><span>Letzte Warnung</span><strong>${escapeHtml(logs.find((log) => String(log.status || "").toLowerCase().includes("warn"))?.message || "-")}</strong></div></div><div class="ai-picto-row">${pictogram(">", "Automatik aktivieren", 'data-ai-editorial-automation="start"')}${pictogram("||", "Automatik pausieren", 'data-ai-editorial-automation="pause"')}${pictogram("+", createLabel, 'data-ai-editorial-run="manual"')}${pictogram("OK", "Quellen jetzt pruefen")}${pictogram("O", "Dubletten jetzt pruefen")}</div><div id="ai-editorial-run-result"></div></section><section class="panel"><h2>Einstellungen</h2>${settingsForm(settings)}</section></div>`,
    logs: `${cmsTitle("KI-Redaktion", "Logs / Pruefberichte")}${nav(active)}<section class="panel"><div class="table-wrap"><table class="table"><thead><tr><th>Zeit</th><th>Aufgabe</th><th>Status</th><th>Meldung</th></tr></thead><tbody>${logs.length ? logRows([...logs].reverse()) : `<tr><td colspan="4">Noch keine KI-Redaktionslogs.</td></tr>`}</tbody></table></div></section>`,
    settings: `${cmsTitle("KI-Redaktion", "Einstellungen")}${nav(active)}<section class="panel">${settingsForm(settings)}</section>`
  }[active] || "";
  return protect(cmsShell(`cms/ai-editorial/${active}`, content));
}
