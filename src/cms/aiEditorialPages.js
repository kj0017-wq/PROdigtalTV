import { cmsShell, cmsTitle } from "./cmsLayout.js?v=470";
import { list, getOne, upsert } from "../firebase/dataService.js?v=488";
import { authDebugState, currentUser, canUseCms } from "../firebase/authService.js?v=471";
import { aiSourceCatalog } from "../data/aiSourceCatalog.js";
import { escapeHtml, formatDateTime, formatShortDate } from "../utils/format.js";

const sections = [
  ["dashboard", "Themenliste"],
  ["news-import", "News importieren"],
  ["morning-briefing", "Morgenbriefing"],
  ["press", "Presse"],
  ["articles", "Beitraege"],
  ["sources", "Quellen"],
  ["prompts", "Prompts"],
  ["keywords", "Keywords"],
  ["automation", "Automatisierung"],
  ["logs", "Logs"],
  ["settings", "Einstellungen"]
];

const publicationModes = {
  draft_only: "nur Entwurf erstellen",
  review_release: "nach Prüfung freigeben",
  auto_publish: "automatisch veroeffentlichen bei bestandener Prüfung"
};

const promptTypes = [
  "Themenrecherche",
  "Quellenhinweise",
  "Headline",
  "Subline / Thubline",
  "Morgenbriefing",
  "Beitragstext",
  "Sprachstil",
  "Thumbnail-Idee",
  "Thumbnail-Prompt",
  "Thumbnail-Erstellung",
  "Keywords",
  "SEO / Meta"
];

const systemPromptCatalog = [
  ["Themenrecherche", "Themenrecherche"],
  ["Quellenhinweise", "Quellenhinweise"],
  ["Morgenbriefing", "Morgenbriefing"],
  ["Headline", "Headline-Erstellung"],
  ["Subline / Thubline", "Subline-/Thubline-Erstellung"],
  ["Beitragstext", "Texterstellung"],
  ["Sprachstil", "Sprachstil-Prüfung"],
  ["Thumbnail-Idee", "Thumbnail-Idee"],
  ["Thumbnail-Prompt", "Thumbnail-Prompt"],
  ["Thumbnail-Erstellung", "Thumbnail-Erstellung"],
  ["Keywords", "Keyword-Erstellung"],
  ["SEO / Meta", "SEO-/Meta-Erstellung"]
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
      "Aufgabe: Erzeuge fuer die PROdigitalTV KI-Redaktion nur belastbare redaktionelle Nachrichtenthemen fuer die Themenliste.",
      "Strategie: Dies ist Stufe 1. Es entstehen keine fertigen Artikel. Die Ausgabe ist eine redaktionelle Auswahl echter aktueller Nachrichtenfunde. Der vollstaendige Beitrag wird erst in Stufe 2 nach manueller Auswahl im Editor erzeugt.",
      "Wenn aus den Quellen nur wenige ausreichend belegbare aktuelle Nachrichtenthemen ableitbar sind, liefere wenige. Keine Luecken mit schwachen, generischen oder technischen Crawler-Funden auffuellen.",
      "Jeder Eintrag braucht eine journalistische Headline, eine kurze Subline und einen Themenabsatz mit 4 bis 6 Saetzen.",
      "Der Themenabsatz erklaert: worum es geht, warum es aktuell ist, welche Akteure oder Bereiche betroffen sind und welche Bedeutung das Thema fuer die Medienbranche hat.",
      "Keine redaktionelle Bewertung durch KI: keine Punktwerte, keine Rangliste, keine Freigabeempfehlung und keine Relevanzurteile.",
      "Keine Meta-Sprache in sichtbaren Feldern: nicht Themenkandidat, nicht Vorschlag, nicht redaktionell prüfen, nicht Quellenfund, nicht erklaeren wie der Fund entstanden ist.",
      "Jeder Vorschlag muss ein konkretes Thema aus TV, Streaming, Digitalmedien, Medienrecht, Produktion, KI, Distribution, Vermarktung, HbbTV, OTT, FAST-Channels, Barrierefreiheit oder Plattformregulierung sein.",
      "Keine Boulevardmeldungen, keine reinen Personenmeldungen, keine Programmhinweise, keine Navigationstexte, keine Sitemaps, keine Presseportal-Startseiten, keine generischen Quellenbeschreibungen.",
      "Gib zusaetzlich Kategorie, 5-8 Keywords, Quellenhinweis, Quellenstatus, Quellenkandidaten und Veroeffentlichungsdatum der Quelle falls bekannt aus.",
      "Nur Themen, die ein Redakteur auswaehlt, duerfen in die Themen-Queue uebernommen und danach als Beitrag erzeugt werden.",
      "Keine Quellen, Zahlen, Studien, URLs oder Fakten erfinden. Wenn Live-Quellen fehlen, Quellenstatus als Recherche erforderlich kennzeichnen.",
      "Ausgabeformat: JSON-Array mit maximal 10 Objekten: title, headline, subline, themenabsatz, keywords, quellenhinweis, quellenstatus, category, priority, thumbnail_idea, source_status, source_candidates, source_publication_date."
    ].join("\n")
    : type === "Beitragstext"
      ? [
        "Aufgabe: Erstelle einen echten redaktionellen Nachrichtenbeitrag fuer PROdigitalTV aus dem ausgewaehlten Thema und den gelieferten Quelleninhalten.",
        "Ziel: Der Text soll wie ein von einem Redakteur geschriebener Branchenartikel wirken: konkrete Nachricht zuerst, danach Einordnung. Keine Platzhalter, keine allgemeinen Branchenfloskeln, kein Text ueber den Redaktionsprozess.",
        "Nutze nur die gelieferten Daten aus {{THEMA}}, {{KATEGORIE}}, {{QUELLEN}}, {{HEADLINE}}, {{SUBLINE}}, {{KEYWORDS}}, {{SPRACHSTIL}}, {{TEXTLAENGE}}, {{HEUTIGES_DATUM}} und vorhandene Quellenauszuege.",
        "Arbeite quellenorientiert: Identifiziere zuerst den Nachrichtenkern aus der Quelle. Uebernimm konkrete Akteure, Orte, Termine, Produkte, Entscheidungen, Zahlen, Verfahren, Zitate oder Rechtsfragen nur dann, wenn sie in den gelieferten Quellen stehen.",
        "Wenn die Quellen nur Titel, URL oder Quellenname ohne inhaltlichen Auszug liefern, schreibe keinen scheinbar fertigen Beitrag. Gib dann nur den belegten Nachrichtenkern aus und lasse fehlende Abschnitte weg.",
        "Keine Fakten, Zahlen, Zitate, Namen, Studien, Quellen oder URLs erfinden. Wenn eine Information nicht belegbar ist, lasse sie weg. Nicht mit Saetzen wie Medienanbieter muessen einordnen oder die Entwicklung ist fuer die Branche relevant auffuellen, wenn kein konkreter Befund folgt.",
        "Keine pauschalen Einschaetzungen und keine Fuellphrasen: nicht 'relevant fuer PROdigitalTV', nicht 'Einordnungsbedarf', nicht 'fuer die Branche wichtig', nicht 'Medienunternehmen sollten'. Nur konkrete Folgen nennen, wenn sie aus der Quelle belegbar sind.",
        "Der fertige Beitrag hat 300 bis 400 Woerter, aber nur wenn die Quellen genug Substanz liefern. Er beantwortet konkret: Was ist passiert? Wer ist beteiligt? Wann oder wo passiert es? Was aendert sich? Warum ist das fuer TV, Streaming, Produktion, Plattformen, Verlage oder digitale Distribution relevant?",
        "Den Haupttext eigenstaendig redaktionell strukturieren: Lead mit Nachricht, zweiter Absatz mit Quellenfakten, danach Einordnung und Folgen. Keine Satz-fuer-Satz-Paraphrase, aber auch keine abstrakte Nacherzaehlung.",
        "Beim Neuformulieren den Kern der Aussagen bewahren: konkrete Akteure, Daten, Verfahren, Zahlen, Rechtsfragen, Marktfolgen und zentrale Ursache-Wirkung-Beziehungen nicht verwässern und nicht durch allgemeine Branchenfloskeln ersetzen.",
        "Verwende deutsche Umlaute und ß in sichtbaren deutschen Texten: ä, ö, ü, Ä, Ö, Ü, ß. Nicht ae, oe, ue oder ss schreiben, wenn ein deutscher Umlaut gemeint ist.",
        "Headline, Subline und Beitragstext haben unterschiedliche Aufgaben und duerfen nicht dasselbe in anderer Reihenfolge wiederholen. Headline: Kern der Nachricht. Subline: zusaetzlicher Kontext oder Bedeutung. Beitragstext: neue Einstiegsformulierung, Hintergruende, Einordnung und Folgen.",
        "Headline und Subline duerfen im Wortlaut keine identischen Phrasen enthalten. Die Subline muss einen neuen Aspekt liefern: Zeitraum, Akteure, Folgen, Einordnung, Konflikt, Marktbezug oder Bedeutung fuer die Branche.",
        "Subline immer als vollstaendigen, sauber endenden Satz formulieren. Nicht mitten im Satz abbrechen, keine abgeschnittenen Nebensaetze.",
        "Keywords: genau 4 Keywords pro Beitrag. Jedes Keyword besteht aus genau einem fachlichen Wort, keine Satzteile, keine Mehrwort-Phrasen, keine Halbsätze, keine Wortfragmente wie gepr. Keine Funktionswoerter wie wird, werden, ist, sind, eine, der, die, das, mit, fuer, auf.",
        "Vermeide Wiederholungen gleicher Aussagen, gleicher Satzanfaenge und gleicher Woerter direkt nacheinander.",
        "Sprache: sachlich, journalistisch, klar, nicht werblich, nicht reisserisch, keine langen Schachtelsaetze. Fachbegriffe nur verwenden, wenn sie noetig sind, und kurz erklaeren.",
        "Keine Meta-Sprache im Beitrag: nicht Arbeitsentwurf, nicht Themenkandidat, nicht Vorschlag, nicht Quellenfund, nicht redaktionell prüfen, nicht Freischaltung, nicht CMS, nicht Redakteur.",
        "Keine technischen oder organisatorischen Hinweise an die Redaktion. Die Aufgabe ist die Information des Beitrags, nicht die Beschreibung eines Workflows.",
        "Ausgabeformat: Headline, Subline, Beitragstext, Kategorie, Keywords, Thumbnail-Idee.",
        "Wenn die Informationen duenn sind, schreibe keinen aufgeblasenen Artikel. Kuerze den Beitrag auf die belegten Fakten statt mit allgemeinen Bewertungen oder Recherchehinweisen aufzufuellen."
      ].join("\n")
    : [
      `Aufgabe: ${label} fuer die PROdigitalTV KI-Redaktion.`,
      "Arbeite nur mit den gelieferten Platzhaltern und CMS-Daten.",
      "Nutze {{THEMA}}, {{KATEGORIE}}, {{QUELLEN}}, {{BESTEHENDE_BEITRAEGE}}, {{SPRACHSTIL}}, {{TEXTLAENGE}}, {{HEUTIGES_DATUM}}, {{VERIFIZIERTE_QUELLEN}}, {{BEITRAGSTEXT}}, {{HEADLINE}}, {{SUBLINE}} und {{KEYWORDS}}, sofern vorhanden.",
      "Keine Fakten, Zahlen, Quellen, URLs, Personen oder Organisationen erfinden.",
      "Wenn die Quellenlage nicht reicht, gib nur einen sachlichen Hinweis auf fehlende Belege aus."
    ].join("\n");
  return {
    id,
    name: label,
    prompt_type: type,
    description: `Standardprompt fuer ${label}. Kann redaktionell angepasst werden.`,
    prompt_text: promptText,
    system_instructions: "Feste Schutzregeln: keine Halluzinationen, keine erfundenen Quellen, keine KI-Bewertung, keine Score-Vergabe. Fuer die Themenliste reicht eine valide Quelle.",
    output_format: ["Themenrecherche", "Quellenhinweise", "Keywords", "SEO / Meta"].includes(type) ? "json" : "text",
    model: "gpt-4.1-mini",
    temperature: ["Headline", "Subline / Thubline", "Thumbnail-Idee", "Thumbnail-Prompt", "Thumbnail-Erstellung"].includes(type) ? 0.3 : 0.2,
    max_tokens: type === "Beitragstext" ? 1400 : 900,
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
  const topicSystemPrompt = prompts.find((prompt) => (prompt.prompt_type || prompt.promptType) === "Themenrecherche" && prompt.id === "ai-prompt-system-themenrecherche" && !isArchivedPrompt(prompt));
  const topicDefault = defaultSystemPrompt("Themenrecherche", "Themenrecherche");
  const shouldUpdateTopicPrompt = topicSystemPrompt
    && String(topicSystemPrompt.created_by || topicSystemPrompt.createdBy || "").toLowerCase() === "system"
    && String(topicSystemPrompt.updated_by || topicSystemPrompt.updatedBy || "System").toLowerCase() === "system"
    && !String(topicSystemPrompt.prompt_text || topicSystemPrompt.promptText || "").includes("redaktionelle Nachrichtenthemen");
  if (shouldUpdateTopicPrompt) {
    const updated = {
      ...topicSystemPrompt,
      prompt_text: topicDefault.prompt_text,
      system_instructions: topicDefault.system_instructions,
      output_format: topicDefault.output_format,
      version: Number(topicSystemPrompt.version || 1) + 1,
      updated_at: new Date().toISOString(),
      updated_by: "System"
    };
    await upsert("ai_prompts", updated);
    await upsert("ai_prompt_versions", {
      id: `${updated.id}-v${updated.version}`,
      prompt_id: updated.id,
      version: updated.version,
      prompt_text: updated.prompt_text,
      system_instructions: updated.system_instructions,
      output_format: updated.output_format,
      model: updated.model || topicDefault.model,
      temperature: Number(updated.temperature ?? topicDefault.temperature),
      max_tokens: Number(updated.max_tokens || topicDefault.max_tokens),
      change_note: "Systemprompt auf zweistufige Nachrichtenthemen-Strategie aktualisiert.",
      status: updated.status || "aktiv",
      created_at: updated.updated_at,
      created_by: "System"
    });
    prompts = prompts.map((prompt) => prompt.id === updated.id ? updated : prompt);
  }
  const articleSystemPrompt = prompts.find((prompt) => (prompt.prompt_type || prompt.promptType) === "Beitragstext" && prompt.id === "ai-prompt-system-beitragstext" && !isArchivedPrompt(prompt));
  const articleDefault = defaultSystemPrompt("Beitragstext", "Texterstellung");
  const shouldUpdateArticlePrompt = articleSystemPrompt
    && String(articleSystemPrompt.created_by || articleSystemPrompt.createdBy || "").toLowerCase() === "system"
    && String(articleSystemPrompt.updated_by || articleSystemPrompt.updatedBy || "System").toLowerCase() === "system"
    && (!String(articleSystemPrompt.prompt_text || articleSystemPrompt.promptText || "").includes("echten redaktionellen Nachrichtenbeitrag")
      || /CMS-Status|Freischaltung|redaktionell prüfen|Prüfung erforderlich|Redakteur/i.test(String(articleSystemPrompt.prompt_text || articleSystemPrompt.promptText || "")));
  if (shouldUpdateArticlePrompt) {
    const updated = {
      ...articleSystemPrompt,
      prompt_text: articleDefault.prompt_text,
      system_instructions: articleDefault.system_instructions,
      output_format: "text",
      version: Number(articleSystemPrompt.version || 1) + 1,
      updated_at: new Date().toISOString(),
      updated_by: "System"
    };
    await upsert("ai_prompts", updated);
    await upsert("ai_prompt_versions", {
      id: `${updated.id}-v${updated.version}`,
      prompt_id: updated.id,
      version: updated.version,
      prompt_text: updated.prompt_text,
      system_instructions: updated.system_instructions,
      output_format: updated.output_format,
      model: updated.model || articleDefault.model,
      temperature: Number(updated.temperature ?? articleDefault.temperature),
      max_tokens: Number(updated.max_tokens || articleDefault.max_tokens),
      change_note: "Systemprompt auf CMS-fertige redaktionelle Kurzbeitraege aktualisiert.",
      status: updated.status || "aktiv",
      created_at: updated.updated_at,
      created_by: "System"
    });
    prompts = prompts.map((prompt) => prompt.id === updated.id ? updated : prompt);
  }
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
  if (["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)) return content;
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

async function optionalList(collectionName) {
  try {
    return await list(collectionName);
  } catch (error) {
    console.warn(`KI-Redaktion: ${collectionName} konnte nicht geladen werden`, error);
    return [];
  }
}

async function optionalGetOne(collectionName, id) {
  try {
    return await getOne(collectionName, id);
  } catch (error) {
    console.warn(`KI-Redaktion: ${collectionName}/${id} konnte nicht geladen werden`, error);
    return null;
  }
}

function badge(value = "") {
  const normalized = String(value || "Entwurf").toLowerCase();
  const tone = normalized.includes("gesperrt") || normalized.includes("dublette") || normalized.includes("fehler") || normalized.includes("unzureichend")
    ? "danger"
    : normalized.includes("pruef") || normalized.includes("warn") || normalized.includes("teilweise") || normalized.includes("neu")
      ? "warning"
      : normalized.includes("geprüft") || normalized.includes("freigegeben") || normalized.includes("veroeffentlicht") || normalized.includes("aktiv") || normalized.includes("bestanden") || normalized.includes("beitrag vorhanden") || normalized.includes("beitrag erstellt")
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

function sourceRows(sources, options = {}) {
  return sources.map((source, index) => `<tr>
    ${options.numbered ? `<td>${index + 1}</td>` : ""}
    <td><strong>${escapeHtml(source.name || source.title || "-")}</strong><small>${escapeHtml(source.domain || "")}</small></td>
    <td>${escapeHtml(source.source_type || source.sourceType || "-")}</td>
    <td>${badge(source.source_status || source.check_status || source.review_status || "neu")}</td>
    <td><a class="link" href="${escapeHtml(source.url || "#")}" target="_blank" rel="noreferrer">oeffnen</a></td>
    ${options.manageable ? `<td><button class="button button--danger button--small" type="button" data-ai-source-delete="${escapeHtml(source.id)}">Loeschen</button></td>` : ""}
  </tr>`).join("");
}

function uniqueSources(sources = []) {
  const seen = new Set();
  return sources.filter((source) => !source.deleted_at && !source.deletedAt && !["geloescht", "gesperrt"].includes(normalizeText(source.review_status || source.source_status || ""))).filter((source) => {
    const key = normalizeText(source.domain || source.url || source.name || source.id || "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sourcesForCategory(category = "", sources = []) {
  const categoryKey = normalizeText(category);
  const matching = sources
    .filter((source) => sourceMatchesTopic(source, { category, title: category, keywords: [category] }))
    .sort((a, b) => String(a.name || a.title || a.domain || "").localeCompare(String(b.name || b.title || b.domain || ""), "de"));
  const fallback = sources
    .filter((source) => !matching.some((match) => match.id === source.id))
    .filter((source) => !normalizeText(source.source_status || "").includes("gesperrt"))
    .sort((a, b) => {
      const aCategoryHit = sourceCategories(a).some((item) => item.includes(categoryKey) || categoryKey.includes(item));
      const bCategoryHit = sourceCategories(b).some((item) => item.includes(categoryKey) || categoryKey.includes(item));
      return Number(bCategoryHit) - Number(aCategoryHit)
        || Number(a.priority || 99) - Number(b.priority || 99)
        || String(a.name || a.title || a.domain || "").localeCompare(String(b.name || b.title || b.domain || ""), "de");
    });
  return uniqueSources([...matching, ...fallback]).slice(0, 20);
}

function sourceCategoryBlocks(sources = []) {
  return topicResearchCategories
    .filter((category) => category !== "Alle Themenbereiche")
    .map((category) => {
      const categorySources = sourcesForCategory(category, sources);
      return `<details class="source-category-block" open>
        <summary><strong>${escapeHtml(category)}</strong><span>${categorySources.length} Quellen</span></summary>
        <div class="source-category-grid">${categorySources.map((source) => `<a class="source-category-card" href="${escapeHtml(source.url || "#")}" target="_blank" rel="noreferrer">
          <strong>${escapeHtml(source.name || source.title || source.domain || "Quelle")}</strong>
          <span>${escapeHtml(source.domain || "")}</span>
          <small>${escapeHtml(source.source_type || "-")}</small>
        </a>`).join("")}</div>
      </details>`;
    }).join("");
}

function verifiedSourceForm() {
  return `<form id="ai-verified-source-form" class="form-grid source-management-form">
    <div class="form-grid--two">
      <div class="field"><label>Name</label><input name="name" required placeholder="z. B. HbbTV Association"></div>
      <div class="field"><label>URL</label><input name="url" type="url" required placeholder="https://..."></div>
      <div class="field"><label>Typ</label><input name="source_type" placeholder="Behoerde, Standard, Verband, Fachmedium"></div>
      <div class="field"><label>Kategorie</label><select name="category">${topicResearchCategories.filter((category) => category !== "Alle Themenbereiche").map((category) => `<option>${escapeHtml(category)}</option>`).join("")}</select></div>
      <input name="trust_score" type="hidden" value="70">
      <div class="field"><label>Status</label><select name="source_status"><option>erlaubt</option><option>bevorzugt</option><option>pruefpflichtig</option><option>gesperrt</option></select></div>
    </div>
    <div class="field"><label>Notiz</label><textarea name="notes" placeholder="Warum ist diese Quelle fuer die Redaktion relevant?"></textarea></div>
    <div class="actions"><button class="button button--primary">Quelle hinzufuegen</button><button class="button button--secondary" type="button" data-ai-source-auto-expand>Quellenliste automatisch erweitern</button></div>
    <div id="ai-source-management-result"></div>
  </form>`;
}

function sourceCards(sources) {
  return sources.map((source) => `<article class="ai-source-card">
    <div>
      <h3>${escapeHtml(source.publisher || source.name || source.title || "Quelle")}</h3>
      <p>${escapeHtml(source.title || source.relevance_note || "")}</p>
    </div>
    <div class="ai-status-stack">${badge(source.check_status || source.source_status || "neu")}</div>
    <dl>
      <div><dt>Belegte Aussage</dt><dd>${escapeHtml(source.claim_reference || "Noch nicht zugeordnet")}</dd></div>
      <div><dt>Notiz</dt><dd>${escapeHtml(source.relevance_note || "Keine Notiz")}</dd></div>
      <div><dt>Domain</dt><dd>${escapeHtml(source.domain || "-")}</dd></div>
      <div><dt>Abruf</dt><dd>${escapeHtml(formatShortDate(source.accessed_at || source.accessedAt || "")) || "-"}</dd></div>
    </dl>
    <a class="button button--secondary button--small" href="${escapeHtml(source.url || "#")}" target="_blank" rel="noreferrer">Quelle oeffnen</a>
  </article>`).join("");
}

function compactSourceLabel(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const host = raw.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0];
  const base = host || raw;
  return base
    .replace(/\.(de|com|org|net|eu|co\.uk)$/i, "")
    .split(".")
    .filter(Boolean)
    .pop()
    ?.replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) || raw;
}

function articleSourceLabel(article = {}) {
  const sources = Array.isArray(article.source_snapshot_json)
    ? article.source_snapshot_json
    : Array.isArray(article.sourceSnapshotJson)
      ? article.sourceSnapshotJson
      : Array.isArray(article.sources)
        ? article.sources
        : [];
  const primary = sources.find((source) => source?.publisher || source?.name || source?.source || source?.domain || source?.url) || {};
  return primary.publisher
    || primary.name
    || primary.source
    || compactSourceLabel(primary.domain || primary.url || article.source || article.publisher || article.original_url || article.source_url)
    || "-";
}

function articleShortSummary(article = {}) {
  const value = article.shortText || article.introText || article.subline || article.subtitle || article.summary || article.teaser || article.bodyText || article.body || "";
  const clean = cleanPressDisplayText(value);
  return clean.length > 220 ? `${clean.slice(0, 220).trim()}...` : clean;
}

function articleRows(articles, options = {}) {
  if (options.compactArticles) {
    return articles.map((article) => `<tr>
      <td><a class="link editorial-title-link" href="#/cms/ai-editorial/editor?id=${encodeURIComponent(article.id)}">${escapeHtml(article.headline || article.title || "-")}</a><small>${escapeHtml(articleShortSummary(article))}</small></td>
      <td><strong>${escapeHtml(articleSourceLabel(article))}</strong><small>${escapeHtml(articleOrigin(article).label)}</small></td>
      <td>${escapeHtml(article.category || "-")}</td>
      <td>${escapeHtml(formatShortDate(articleDisplayDate(article)))}</td>
      <td><div class="actions ai-morning-row-actions"><a class="button button--secondary button--small" href="#/cms/ai-editorial/editor?id=${encodeURIComponent(article.id)}">Beitrag oeffnen</a><button class="icon-button icon-button--danger" type="button" data-delete-record="editorialContent" data-record-id="${escapeHtml(article.id)}" title="Entfernen" aria-label="Entfernen">${iconTrash}</button></div></td>
    </tr>`).join("");
  }
  if (options.compactMorning) {
    return articles.map((article) => `<tr>
      <td><a class="link editorial-title-link" href="#/cms/edit?module=editorialContent&id=${encodeURIComponent(article.id)}&section=news">${escapeHtml(article.headline || article.title || "-")}</a><small>${escapeHtml(articleShortSummary(article))}</small></td>
      <td><strong>${escapeHtml(articleSourceLabel(article))}</strong></td>
      <td>${escapeHtml(article.category || "-")}</td>
      <td>${escapeHtml(formatShortDate(articleDisplayDate(article)))}</td>
      <td><div class="actions ai-morning-row-actions"><a class="button button--secondary button--small" href="#/cms/edit?module=editorialContent&id=${encodeURIComponent(article.id)}&section=news">Briefing oeffnen</a><button class="icon-button icon-button--danger" type="button" data-ai-morning-article-delete="${escapeHtml(article.id)}" title="Entfernen" aria-label="Entfernen">${iconTrash}</button></div></td>
    </tr>`).join("");
  }
  return articles.map((article) => `<tr>
    <td><a class="link editorial-title-link" href="#/cms/ai-editorial/editor?id=${encodeURIComponent(article.id)}">${escapeHtml(article.headline || article.title || "-")}</a><small>${escapeHtml(cleanPressDisplayText(article.subline || article.subtitle || ""))}</small></td>
    <td>${badge(articleOrigin(article).label)}<small>${escapeHtml(articleOrigin(article).shortNote)}</small></td>
    <td>${escapeHtml(article.category || "-")}</td>
    <td>${badge(article.source_status || article.sourceStatus || "-")}</td>
    <td>${badge(article.duplicate_status || article.duplicateStatus || "-")}</td>
    <td>${badge(article.ai_check_status || article.aiCheckStatus || "-")}</td>
    <td>${badge(article.publication_status || article.status || "-")}</td>
    <td>${escapeHtml(formatShortDate(articleDisplayDate(article)))}</td>
  </tr>`).join("");
}

function dateSortTime(value) {
  if (!value) return 0;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? 0 : value.getTime();
  if (typeof value.toDate === "function") {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }
  if (typeof value === "object" && typeof value.seconds === "number") return value.seconds * 1000;
  const raw = String(value || "").trim();
  const german = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (german) return Date.UTC(Number(german[3]), Number(german[2]) - 1, Number(german[1]));
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function articleDisplayDate(article = {}) {
  return article.published_at
    || article.publishedAt
    || article.publishDate
    || article.original_published_at
    || article.originalPublishedAt
    || article.scheduled_at
    || article.scheduledAt
    || article.created_at
    || article.createdAt
    || article.updated_at
    || article.updatedAt
    || "";
}

function articleSortTime(article = {}) {
  return dateSortTime(articleDisplayDate(article));
}

function sortArticlesNewestFirst(articles = []) {
  return [...articles].sort((a, b) => articleSortTime(b) - articleSortTime(a) || String(b.id || "").localeCompare(String(a.id || "")));
}

function pressReleaseRows(releases = [], options = {}) {
  return releases.map((release) => `<tr>
    <td><a class="link editorial-title-link" href="${escapeHtml(release.url || "#")}" target="_blank" rel="noreferrer">${escapeHtml(release.title || "-")}</a>${pressSummaryMarkup(release.summary || release.full_text || "")}</td>
    <td><strong>${escapeHtml(release.source_name || release.source_domain || "-")}</strong><small>${escapeHtml(release.source_domain || "")}</small></td>
    <td>${escapeHtml(formatShortDate(release.published_at || ""))}</td>
    <td>${Number(release.text_length || String(release.full_text || "").length || 0).toLocaleString("de-DE")}</td>
    <td>${options.readonly ? `<span class="muted">${escapeHtml(options.readonlyLabel || "Nicht in Arbeitsliste")}</span>` : `<button class="button button--primary button--small" type="button" data-ai-press-create-article="${escapeHtml(release.id)}">Beitrag erstellen</button>`}</td>
  </tr>`).join("");
}

function pressSummaryMarkup(value = "") {
  const text = cleanPressDisplayText(value);
  if (!text) return "";
  const sentences = text
    .split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ0-9])/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .slice(0, 3);
  const summary = sentences.length ? sentences : [text.slice(0, 420)];
  return `<div class="press-summary">${summary.map((sentence) => `<p>${escapeHtml(sentence)}</p>`).join("")}</div>`;
}

function pressSourceStatusRows(items = []) {
  return items.map((item) => `<tr>
    <td><strong>${escapeHtml(item.source_name || item.source_domain || "-")}</strong><small>${escapeHtml(item.source_domain || item.source_url || "")}</small></td>
    <td>${badge(item.status || "-")}</td>
    <td>${Number(item.last_result_count || 0)}</td>
    <td>${Number(item.consecutive_empty_scans || 0)}</td>
    <td>${escapeHtml(formatShortDate(item.skip_until || "")) || "-"}</td>
    <td>${escapeHtml(item.reason || "")}</td>
  </tr>`).join("");
}

function isMorningBriefingItem(item = {}) {
  const marker = normalizeText([item.workflow, item.content_type, item.contentType, item.origin, item.source].join(" "));
  return marker.includes("morning") || marker.includes("morgenbriefing");
}

function isMorningBriefingArticle(item = {}) {
  const marker = normalizeText([item.content_type, item.contentType, item.editorialType, item.generation_origin, item.origin, item.category].join(" "));
  return marker.includes("morning") || marker.includes("morgenbriefing");
}

function morningBriefingStatus(item = {}) {
  return item.morning_status || item.briefing_status || item.status || "Neu";
}

function morningBriefingSourceUrl(item = {}) {
  const candidates = [
    item.original_url,
    item.originalUrl,
    item.source_url,
    item.sourceUrl,
    item.url,
    ...(topicSourceCandidates(item).map((source) => source.url))
  ].filter(Boolean);
  return candidates.find((url) => /^https?:\/\//i.test(String(url || ""))) || "";
}

function morningBriefingRows(items = [], articles = []) {
  const articleByItem = new Map(articles.filter(isMorningBriefingArticle).map((article) => [article.morning_briefing_item_id || article.topic_suggestion_id || article.source_item_id || "", article]));
  return items.map((item) => {
    const sourceUrl = morningBriefingSourceUrl(item);
    const status = morningBriefingStatus(item);
    const article = articleByItem.get(item.id) || articles.find((candidate) => candidate.id === item.article_id || candidate.id === item.articleId);
    const headline = escapeHtml(item.headline || item.title || "-");
    return `<tr>
      <td><strong>${sourceUrl ? `<a class="link editorial-title-link" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noreferrer">${headline}</a>` : headline}</strong><small>${escapeHtml(item.summary || item.teaser || item.subline || "")}</small>${topicKeywordChips(item)}</td>
      <td>${sourceUrl ? `<a class="link" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(item.source || item.source_name || item.sourceName || item.publisher || "Quelle")}</a>` : escapeHtml(item.source || item.source_name || item.sourceName || "-")}<small>${escapeHtml(item.source_type || item.sourceType || "")}</small></td>
      <td>${escapeHtml(item.category || item.relevance || "-")}</td>
      <td>${badge(status)}${item.duplicate_of || item.duplicateOf ? `<small>Dublette: ${escapeHtml(item.duplicate_of || item.duplicateOf)}</small>` : ""}</td>
      <td><div class="actions ai-morning-row-actions">
        ${article
          ? `<a class="button button--primary button--small" href="#/cms/edit?module=editorialContent&id=${encodeURIComponent(article.id)}&section=news">News erstellen</a>`
          : sourceUrl
            ? `<a class="button button--primary button--small" href="#/cms/ai-editorial/news-import?sourceUrl=${encodeURIComponent(sourceUrl)}&morningId=${encodeURIComponent(item.id)}&autoImport=1">News erstellen</a>`
            : `<button class="button button--primary button--small" type="button" data-ai-morning-create-article="${escapeHtml(item.id)}">News erstellen</button>`}
        <button class="icon-button icon-button--danger" type="button" data-ai-morning-delete="${escapeHtml(item.id)}" title="Verwerfen" aria-label="Verwerfen">${iconTrash}</button>
      </div></td>
    </tr>`;
  }).join("");
}

function morningBriefingPipeExample() {
  return "Bundesnetzagentur wird zentrale KI-Aufsicht in Deutschland|Bundestag setzt EU-KI-Verordnung national um; BNetzA koordiniert Marktaufsicht.|Regulierung & Compliance|bundestag.de|https://www.bundestag.de/dokumente/textarchiv/2026/kw24-de-ki-1183820|2026-06-16T09:00:00Z|regulator";
}

function morningBriefingPanel({ items = [], articles = [], sources = [], logs = [], settings = {} } = {}) {
  const usableItems = items.filter((item) => !["archiviert", "ignoriert"].includes(normalizeText(morningBriefingStatus(item))));
  const latestBriefing = sortArticlesNewestFirst(articles.filter(isMorningBriefingArticle))[0];
  const approvedSources = sources.filter((source) => ["bevorzugt", "erlaubt"].includes(normalizeText(source.source_status || source.review_status || source.check_status)));
  const latestMorningLog = latest(logs.filter((log) => normalizeText([log.task_name, log.taskName, log.message].join(" ")).includes("morgenbriefing")), "created_at");
  return `${cmsTitle("KI-Redaktion", "Morgenbriefing")}
    ${nav("morning-briefing")}
    
    <section class="panel ai-morning-briefing-panel">
      <div class="editorial-field-head">
        <div>
          <h2>Morgenbriefing & KI-Redaktion</h2>
          <p class="muted">Tägliche Themenauswahl aus freigegebenen Quellen. Meldungen bleiben Arbeitsdaten der KI-Redaktion; Artikel entstehen als normale Redaktionsbeiträge im vorhandenen Editor.</p>
        </div>
        <div class="actions ai-morning-main-actions">
          <button class="button button--primary" type="button" data-ai-morning-briefing-run>Morgenbriefing erzeugen</button>
          <button class="button button--secondary" type="button" data-ai-morning-reset>Arbeitsliste resetten</button>
        </div>
      </div>
      <div class="setup-steps">
        <div class="setup-step"><span>Freigegebene Quellen</span><strong>${approvedSources.length}</strong><small>nur erlaubt / bevorzugt</small></div>
        <div class="setup-step"><span>Arbeitsliste</span><strong>${usableItems.length}</strong><small>5 bis 10 fuer Briefing vorgesehen</small></div>
        <div class="setup-step"><span>Zusammenfassungen</span><strong>${articles.filter(isMorningBriefingArticle).length}</strong><small>Morgenbriefings</small></div>
        <div class="setup-step"><span>Redaktion</span><strong>100%</strong><small>entscheidet selbst</small></div>
      </div>
      <div id="ai-morning-briefing-result"></div>
      ${latestBriefing ? `<p class="muted">Letztes Briefing: <a class="link" href="#/cms/edit?module=editorialContent&id=${encodeURIComponent(latestBriefing.id)}&section=news">${escapeHtml(latestBriefing.title || latestBriefing.headline || latestBriefing.id)}</a></p>` : ""}
      ${latestMorningLog ? `<p class="muted">Letzter Lauf: ${escapeHtml(formatDateTime(latestMorningLog.created_at || latestMorningLog.createdAt || ""))} - ${escapeHtml(latestMorningLog.message || "")}</p>` : ""}
    </section>
    <section class="panel">
      <h2>Pipe-Import fuer Meldungen</h2>
      <p class="muted">Format: headline|summary|thema|source|original_url|first_seen|meta. Neue Eintraege werden als Morgenbriefing-Meldungen gespeichert und koennen direkt als News-Entwurf geoeffnet werden.</p>
      <form id="ai-morning-briefing-import-form" class="form-grid">
        <div class="field editorial-text-field editorial-text-field--body"><label>Meldungen einfuegen</label><textarea name="pipeText" rows="6" placeholder="${escapeHtml(morningBriefingPipeExample())}"></textarea></div>
        <div class="actions"><button class="button button--primary">Meldungen importieren</button></div>
      </form>
    </section>
    <section class="panel">
      <div class="editorial-field-head"><h2>NewsFeed / Morgenbriefing</h2><span class="tag">${usableItems.length} Meldungen</span></div>
      <div class="table-wrap"><table class="table table--topic-suggestions"><thead><tr><th>Meldung</th><th>Quelle</th><th>Kategorie</th><th>Status</th><th>Aktion</th></tr></thead><tbody>${usableItems.length ? morningBriefingRows(usableItems.slice(0, 120), articles) : `<tr><td colspan="5">Noch keine Morgenbriefing-Meldungen vorhanden.</td></tr>`}</tbody></table></div>
    </section>
    <section class="panel">
      <h2>Vorhandene Morgenbriefings</h2>
      <div class="table-wrap"><table class="table table--editorial"><thead><tr><th>Briefing / Short Text</th><th>Quelle</th><th>Kategorie</th><th>Datum</th><th>Aktion</th></tr></thead><tbody>${articles.filter(isMorningBriefingArticle).length ? articleRows(sortArticlesNewestFirst(articles.filter(isMorningBriefingArticle)).slice(0, 40), { compactMorning: true }) : `<tr><td colspan="5">Noch keine Morgenbriefing-Zusammenfassungen.</td></tr>`}</tbody></table></div>
    </section>`;
}

function cleanPressDisplayText(value = "") {
  return String(value || "")
    .replace(/\bpressrelease\b/gi, "")
    .replace(/-->/g, " ")
    .replace(/&[a-z0-9#]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function toList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => {
    if (typeof item === "object" && item) return item.name || item.title || item.domain || item.url || "";
    return String(item || "").trim();
  }).filter((item) => item && item !== "[object Object]");
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return toList(parsed);
    } catch {
      return value.split(/[,;\n]/).map((item) => item.trim()).filter((item) => item && item !== "[object Object]");
    }
  }
  return [];
}

function normalizeText(value = "") {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function sourceCategories(source = {}) {
  return toList(source.default_for_categories || source.defaultForCategories)
    .concat(toList(source.category))
    .map(normalizeText);
}

function sourceMatchesTopic(source = {}, topic = {}) {
  const sourceStatus = normalizeText(source.source_status || source.sourceStatus || "");
  if (sourceStatus.includes("gesperrt")) return false;
  const topicCategory = normalizeText(topic.category || "");
  const topicWords = [
    topic.title,
    topic.headline,
    topic.subline,
    topic.reason,
    ...toList(topic.keywords || topic.tags)
  ].map(normalizeText).join(" ");
  const sourceText = [
    source.name,
    source.title,
    source.domain,
    source.source_type,
    source.category,
    source.notes,
    ...sourceCategories(source)
  ].map(normalizeText).join(" ");
  if (topicCategory && (sourceText.includes(topicCategory) || sourceCategories(source).some((category) => topicCategory.includes(category) || category.includes(topicCategory)))) return true;
  return topicWords.split(/\s+/).filter((word) => word.length > 3).some((word) => sourceText.includes(word));
}

function sourceLooksGerman(source = {}) {
  const text = normalizeText([source.id, source.name, source.title, source.domain, source.url, source.country, source.language, source.notes].join(" "));
  const domain = normalizeText(source.domain || source.url || "");
  if (/(c2pa\.org|w3\.org|smpte\.org|etsi\.org|iabtechlab\.com|tech\.ebu\.ch|access-board\.gov)/.test(domain)) return false;
  const country = normalizeText(source.country || "");
  const language = normalizeText(source.language || "");
  const germanNamed = /(ard|zdf|deutschlandradio|vaunet|bitkom|anga|agf|agma|gema|bsi|fraunhofer|medienanstalten|dwdl|meedia|prosieben|seven one|kress|funke|horizont|wuv|telekom|vodafone deutschland|medienboard|ffa|produzentenallianz|golem|heise|digital fernsehen|infosat|netzpolitik|medienpolitik)/.test(text);
  const germanDomain = domain.endsWith(".de") || domain.includes(".de/") || /(bund\.de|bundes|deutschland|gema\.de|zdf\.de|ard\.de)/.test(domain);
  const germanCountry = /^(de|deutschland|germany|at|oesterreich|osterreich|austria|ch|schweiz|switzerland)$/.test(country);
  if (/\b(france|franzoesisch|franzosisch|french|usa|u s |uk |british|global|international|world)\b/.test(text) && !germanNamed && !germanDomain && !germanCountry) return false;
  return germanNamed || germanDomain || germanCountry || (language.includes("deutsch") && (germanNamed || germanDomain || germanCountry));
}

function verifiedSourceLinks(topic = {}, verifiedSources = []) {
  const sources = verifiedSources
    .filter((source) => sourceMatchesTopic(source, topic))
    .sort((a, b) => String(a.name || a.title || a.domain || "").localeCompare(String(b.name || b.title || b.domain || ""), "de"))
    .slice(0, 3);
  if (sources.length) return sources;
  return verifiedSources
    .filter((source) => !normalizeText(source.source_status || "").includes("gesperrt"))
    .sort((a, b) => Number(a.priority || 99) - Number(b.priority || 99) || String(a.name || a.title || a.domain || "").localeCompare(String(b.name || b.title || b.domain || ""), "de"))
    .slice(0, 3);
}

function topicSourceCandidates(topic = {}) {
  const raw = topic.source_candidates || topic.sourceCandidates || topic.quellen || topic.sources;
  if (!Array.isArray(raw)) return [];
  return raw.map((source) => {
    if (typeof source === "string") return { name: source.trim(), url: "" };
    return {
      name: String(source?.name || source?.title || source?.publisher || source?.domain || "").trim(),
      url: String(source?.url || "").trim(),
      trust_score: source?.trust_score || source?.trustScore || "",
      note: String(source?.note || source?.relevance_note || source?.relevanceNote || "").trim()
    };
  }).filter((source) => source.name).slice(0, 4);
}

function topicSourceDate(topic = {}) {
  const date = topic.source_publication_date || topic.sourcePublicationDate || topic.source_published_at || topic.sourcePublishedAt || "";
  if (!date) return `<small class="topic-source-date topic-source-date--missing">Veroeffentlichungsdatum: nicht ermittelt</small>`;
  return `<small class="topic-source-date">Veroeffentlicht: ${escapeHtml(formatShortDate(date) || date)}</small>`;
}

function topicSourceSummary(topic = {}, verifiedSources = []) {
  const sourceHints = toList(topic.possible_sources || topic.possibleSources || topic.sources || topic.sources_json);
  const candidates = topicSourceCandidates(topic);
  const verified = candidates.length ? candidates : verifiedSourceLinks(topic, verifiedSources);
  const status = topic.source_status || topic.sourceStatus || "Quellenrecherche erforderlich";
  if (verified.length) {
    return `<div class="topic-source-list topic-source-list--verified">${verified.map((source) => {
      const label = escapeHtml(source.name || source.title || source.domain || "Quelle");
      return source.url
        ? `<a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${label}</a>`
        : `<span>${label}</span>`;
    }).join("")}</div>${topicSourceDate(topic)}${sourceHints.length ? `<small>Hinweis: ${escapeHtml(sourceHints.slice(0, 3).join(", "))}</small>` : ""}<small>${escapeHtml(status)}</small>`;
  }
  if (!sourceHints.length) return `<span class="topic-source-status">${escapeHtml(status)}</span>`;
  return `<div class="topic-source-list">${sourceHints.slice(0, 4).map((source) => `<span>${escapeHtml(source)}</span>`).join("")}</div>${topicSourceDate(topic)}<small>${escapeHtml(status)}</small>`;
}

function topicHasSource(topic = {}, verifiedSources = []) {
  return Boolean(topicPrimarySourceUrl(topic))
    || topicSourceCandidates(topic).length > 0
    || verifiedSourceLinks(topic, verifiedSources).length > 0
    || toList(topic.possible_sources || topic.possibleSources || topic.sources || topic.sources_json).length > 0;
}

function topicKeywordChips(topic = {}) {
  const keywords = toList(topic.keywords || topic.tags || topic.keyword_json);
  if (!keywords.length) return "";
  return `<div class="topic-keyword-chips">${keywords.slice(0, 6).map((keyword) => `<span>${escapeHtml(keyword)}</span>`).join("")}</div>`;
}

function topicPrimarySourceUrl(topic = {}) {
  const candidate = topicSourceCandidates(topic).find((source) => /^https?:\/\//i.test(source.url || ""));
  if (candidate?.url) return candidate.url;
  const rawUrl = topic.source_url || topic.sourceUrl || topic.url || "";
  return /^https?:\/\//i.test(rawUrl) ? rawUrl : "";
}

function topicHeadlineLink(topic = {}) {
  const label = escapeHtml(topic.title || topic.headline || "-");
  const url = topicPrimarySourceUrl(topic);
  if (!url) return `<strong>${label}</strong>`;
  return `<a class="topic-headline-link" href="${escapeHtml(url)}" target="_blank" rel="noreferrer" title="Quelle oeffnen" onclick="event.stopPropagation()"><strong>${label}</strong></a>`;
}

function sourceBasedNewsTeaser(topic = {}) {
  const title = String(topic.title || topic.headline || "").trim();
  const sources = topicSourceCandidates(topic).map((source) => source.name).filter(Boolean);
  const source = sources[0] || "";
  if (source) return `${source} meldet eine Entwicklung mit Bezug zur Medienbranche.`;
  return title ? (title.endsWith(".") ? title : `${title}.`) : "";
}

function topicTeaserText(topic = {}) {
  const explicit = topic.teaser || topic.teaser_text || topic.teaserText || topic.themenabsatz || topic.themen_absatz || topic.short_text || topic.shortText || topic.summary;
  const text = String(explicit || "").trim();
  if (text && !/themenkandidat|themenvorschlag|redaktionell prüfen|quellenfund|vorschlag basiert/i.test(text)) return text;
  return sourceBasedNewsTeaser(topic);
}

function topicDecision(topic = {}) {
  const stored = String(topic.editorial_decision || topic.review_status || topic.queue_status || "").toLowerCase();
  if (stored.includes("nicht") || stored.includes("abgelehnt")) return "not_recommended";
  if (stored.includes("pruef") || stored.includes("prüf") || stored.includes("ergaenz") || stored.includes("ergänz")) return "review";
  if (stored.includes("ok") || stored.includes("freigegeben")) return "ok";
  const sourceStatus = String(topic.source_status || "").toLowerCase();
  if (sourceStatus.includes("gesperrt") || sourceStatus.includes("unzureichend")) return "not_recommended";
  if (sourceStatus.includes("ungeprüft") || sourceStatus.includes("ungeprüft") || sourceStatus.includes("pruefpflichtig") || sourceStatus.includes("prüfpflichtig")) return "review";
  return "ok";
}

function topicSuggestionRows(suggestions = [], verifiedSources = [], options = {}) {
  const articles = options.articles || [];
  return suggestions.map((topic) => {
    const publicationState = topicPublicationState(topic, articles);
    const rowClasses = [
      "topic-suggestion-row",
      `topic-suggestion-row--${topicDecision(topic)}`,
      publicationState.hasArticle ? "topic-suggestion-row--article" : ""
    ].filter(Boolean).join(" ");
    const sourceUrl = topicPrimarySourceUrl(topic);
    const hasSource = topicHasSource(topic, verifiedSources);
    const importHref = sourceUrl ? `#/cms/ai-editorial/news-import?sourceUrl=${encodeURIComponent(sourceUrl)}&topicId=${encodeURIComponent(topic.id)}&autoImport=1` : "";
    const actionCell = options.readonly
      ? `<span class="muted">${publicationState.hasArticle ? "Beitrag vorhanden" : "Nicht in Arbeitsliste"}</span>`
      : publicationState.hasArticle
        ? `<span class="ai-status ai-status--success">Beitrag erstellt</span>`
        : importHref
          ? `<a class="button button--primary button--small" href="${escapeHtml(importHref)}">News importieren</a>`
          : `<button class="button button--primary button--small" type="button" data-ai-topic-create-article="${escapeHtml(topic.id)}">News importieren</button>`;
    return `<tr class="${rowClasses}">
    <td>
      ${options.readonly ? `${topicHeadlineLink(topic)}<small>${escapeHtml(topic.subline || topic.headline || "")}</small>` : `<label class="checkbox topic-checkbox"><input type="checkbox" name="topicSuggestionIds" value="${escapeHtml(topic.id)}"><span>${topicHeadlineLink(topic)}<small>${escapeHtml(topic.subline || topic.headline || "")}</small></span></label>`}
      <p class="topic-suggestion-reason">${escapeHtml(topicTeaserText(topic))}</p>
      ${topicKeywordChips(topic)}
    </td>
    <td><strong>${escapeHtml(topic.category || "-")}</strong>${topicSourceSummary(topic, verifiedSources)}</td>
    <td>${hasSource ? badge("Quelle vorhanden") : badge("Quelle fehlt")}</td>
    <td>${badge(publicationState.label)}${badge(topic.queue_status || topic.review_status || topic.status || (options.readonly ? "gespeichert" : "vorgeschlagen"))}</td>
    <td>${actionCell}</td>
  </tr>`;
  }).join("");
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
    <td>${topicHasSource(topic) ? "Quelle vorhanden" : "-"}</td>
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

function rawTopicRows(items = []) {
  return items.map((item) => `<tr>
    <td><strong>${escapeHtml(item.source_name || item.sourceName || "-")}</strong><small>${escapeHtml(item.source_domain || item.sourceDomain || "")}</small></td>
    <td><strong>${escapeHtml(item.title || "-")}</strong><small>${badge(item.raw_type === "source_scan" || item.rawType === "source_scan" ? "Quelle geparst" : "Veroeffentlichung")}</small><small>${escapeHtml(String(item.summary || "").replace(/Feed-\/News-\/Presse-Fund/g, "Feed-/News-Fund").replace(/Feed-\/News-\/Presse-Fund erkannt/g, "Feed-/News-Fund erkannt"))}</small></td>
    <td>${escapeHtml(formatShortDate(item.published_at || item.publishedAt || "") || "nicht ermittelt")}</td>
    <td>${item.url ? `<a class="link" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">oeffnen</a>` : "-"}</td>
    <td>${(item.suggested_topic_titles || item.suggestedTopicTitles || []).length ? (item.suggested_topic_titles || item.suggestedTopicTitles).map((title) => `<span class="ai-status ai-status--success">${escapeHtml(title)}</span>`).join(" ") : badge(item.assignment_status || item.assignmentStatus || "Rawfund")}</td>
  </tr>`).join("");
}

function isPressTopicRawItem(item = {}) {
  const title = normalizeText(item.title || "");
  const url = normalizeText(item.url || "");
  const source = normalizeText(`${item.source_name || item.sourceName || ""} ${item.source_domain || item.sourceDomain || ""}`);
  const explicit = `${title} ${url}`;
  if (/(pressemitteilung|pressemeldung|pressekontakt|pressebereich|presseportal|press release|pressmeldung)/.test(explicit)) return true;
  if (/(^|\s)presse(\s|$)/.test(title) && !title.includes("pressefreiheit")) return true;
  if (/(\/|-|_)presse(\/|-|_|$)|press-releases?|pressroom|newsroom\/press/.test(url)) return true;
  return /presseportal|press release/.test(source);
}

function topicKeywordStats(topics = []) {
  const stats = new Map();
  topics.forEach((topic) => {
    const topicKeywords = toList(topic.keywords || topic.tags || topic.keyword_json);
    topicKeywords.forEach((keyword) => {
      const label = String(keyword || "").trim();
      const key = normalizeText(label);
      if (!key || key.length < 2) return;
      const existing = stats.get(key) || {
        keyword: label,
        key,
        count: 0,
        latestDate: "",
        categories: new Set(),
        topics: []
      };
      existing.count += 1;
      existing.latestDate = [existing.latestDate, topic.updated_at, topic.updatedAt, topic.created_at, topic.createdAt].filter(Boolean).sort().pop() || existing.latestDate;
      if (topic.category) existing.categories.add(topic.category);
      if (topic.title || topic.headline) existing.topics.push(topic.title || topic.headline);
      stats.set(key, existing);
    });
  });
  return [...stats.values()].sort((a, b) => b.count - a.count || String(b.latestDate || "").localeCompare(String(a.latestDate || "")) || a.keyword.localeCompare(b.keyword));
}

function topicKeywordRows(items = []) {
  return items.map((item) => `<tr>
    <td><a class="editorial-title-link" href="#/cms/ai-editorial/keywords?keyword=${encodeURIComponent(item.key || normalizeText(item.keyword))}"><strong>${escapeHtml(item.keyword)}</strong></a><small>${escapeHtml([...item.categories].slice(0, 4).join(", ") || "ohne Kategorie")}</small></td>
    <td>${item.count}</td>
    <td>${escapeHtml(formatShortDate(item.latestDate || "") || "-")}</td>
    <td>${item.topics.slice(0, 3).map((topic) => `<span class="ai-status ai-status--neutral">${escapeHtml(topic)}</span>`).join(" ")}</td>
  </tr>`).join("");
}

function topicPublicationState(topic = {}) {
  const queueStatus = normalizeText(`${topic.queue_status || ""} ${topic.status || ""}`);
  const isNotTaken = queueStatus.includes("nicht uebernommen") || queueStatus.includes("nicht ubernommen");
  if (!isNotTaken && queueStatus.includes("uebernommen")) return { label: "Beitrag erstellt", tone: "success", hasArticle: true };
  if (queueStatus.includes("kandidat")) return { label: "in Beitragsliste", tone: "warning", hasArticle: false };
  if (queueStatus.includes("abgelehnt") || queueStatus.includes("zurueck")) return { label: "nicht empfohlen", tone: "danger", hasArticle: false };
  return { label: "nicht veroeffentlicht", tone: "neutral", hasArticle: false };
}

function topicSuggestionFilterReason(topic = {}) {
  const title = normalizeText(`${topic.title || ""} ${topic.headline || ""}`);
  const text = normalizeText([
    topic.title,
    topic.headline,
    topic.subline,
    topic.teaser,
    topic.reason,
    topic.category,
    topic.source_status,
    topic.source_url,
    topic.sourceUrl,
    ...(Array.isArray(topic.source_names) ? topic.source_names : []),
    ...(Array.isArray(topic.sourceNames) ? topic.sourceNames : [])
  ].filter(Boolean).join(" "));
  if (!title) return "ohne Titel";
  if (/skip to .*content|main content|zum inhalt springen|direkt zum seiteninhalt|ansprechpartner|redaktionelle fragen|presseportal|untermenue|hauptmenue|einstellungen ausblenden|winter olympics|olympics|software based environment|strengthening sovereignty|resilience/.test(title)) return "Navigation / technische Seite";
  if (/(presseimport|importierte presse|pressemitteilung|pressemeldung|pressekontakt|presseinformationen|pressebereich|presseportal|presse abonnieren|interner link|newsletter|anmeldung|registrierung|ticket|veranstaltung|veranstaltungen|termin|event|webinar|messe|konferenz|save the date|presseeinladung)/.test(text)) return "Presse/Event/Termin-Filter";
  if (/(passwort vergessen|hilfe bekommen|formel 1|rtl deutschland|rtl|mallorca|bachelor|dschungel|gzsz|alles was zaehlt|unter uns|lets dance|sport|olympics|winter olympics)/.test(text)) return "nicht passendes Thema";
  if (/(^|\s)(presse|aktuelles|newsroom|pressemitteilungen|presseinformationen|anmeldung|inhalt)(\s|$)/.test(title)) return "generische Rubrikseite";
  return "";
}

function isUsableTopicSuggestion(topic = {}) {
  if (topicSuggestionFilterReason(topic)) return false;
  return true;
}

function filteredTopicRows(topics = []) {
  return topics.map((topic) => `<tr>
    <td><strong>${escapeHtml(topic.title || topic.headline || "-")}</strong><small>${escapeHtml(topic.subline || topic.reason || "")}</small>${topicKeywordChips(topic)}</td>
    <td>${escapeHtml(topic.category || "-")}</td>
    <td>${badge(topicSuggestionFilterReason(topic) || "ausgefiltert")}</td>
    <td>${escapeHtml(formatShortDate(topic.created_at || topic.createdAt || topic.updated_at || topic.updatedAt || ""))}</td>
  </tr>`).join("");
}

function keywordTopicRows(topics = [], articles = []) {
  return topics.map((topic) => {
    const state = topicPublicationState(topic, articles);
    return `<tr>
      <td><strong>${escapeHtml(topic.title || topic.headline || "-")}</strong><small>${escapeHtml(topic.subline || topic.reason || "")}</small></td>
      <td>${escapeHtml(topic.category || "-")}</td>
      <td>${topicHasSource(topic) ? "Quelle vorhanden" : "-"}</td>
      <td>${badge(state.label)}</td>
    </tr>`;
  }).join("");
}

function isAiEditorialArticle(item = {}) {
  return item.author_type === "ai"
    || item.authorType === "ai"
    || item.author_type === "ki_news_import"
    || item.authorType === "ki_news_import"
    || item.generation_origin === "ki_news_import"
    || item.ai_log_json?.import_flow === "ki_news_import"
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

function isLowQualityPressImportArticle(item = {}) {
  if (!(item.imported_press_release_id || item.ai_log_json?.import_flow === "german_press_release_import" || item.category === "Presseimport")) return false;
  const title = normalizeText(item.title || item.headline || "");
  const text = normalizeText([item.title, item.headline, item.subline, item.introText, item.bodyText].join(" ")).slice(0, 1800);
  if (/^(aktuelles|kurzmeldung|pressemitteilungen?|pressemittelungen?|pressemiteilungen?|presseinformationen?|pressekontakt|anmeldung)\b/.test(title)) return true;
  if (/(^der .+verlagsgruppe$|pressekontakt|presseinformationen|pressemitteilungen und publikationen|pressemeldungen.*positionen.*publikationen|newsroom|unser newsroom|veranstaltung|filme und animationen|infomaterialien|broschueren|anmeldung|newsletter|pressetexte 20\d{2}|presse \| bpb|positionspapiere|unsere kopfe|unsere koepfe|aktuelles hier finden sie aktuelle veroffentlichungen|aktuelles hier finden sie aktuelle veroeffentlichungen)/.test(title)) return true;
  return /(cookie|newsletter abonnieren|zum inhalt springen|pressekontakt|ihre anmeldung|datenschutz|impressum|hauptnavigation|servicenavigation|suchfeld|presse fotos logos banner|filter themen alle anzeigen)/.test(text)
    && !/(pressemitteilung|pressemeldung).{20,}(medien|sender|streaming|produktion|digital|tv|plattform|ki|vermarktung)/.test(text);
}

function isLowQualityPressRelease(item = {}) {
  const title = normalizeText(item.title || "").replace(/[^a-z0-9]+/g, " ").trim();
  const text = normalizeText([item.title, item.summary, item.full_text, item.url].join(" ")).replace(/[^a-z0-9]+/g, " ").slice(0, 2600);
  const words = title.split(/\s+/).filter((word) => word.length > 2);
  if (words.length < 4) return true;
  if (/^pressemitteilung( vom| am| zu)?\b|^pressemittelung( vom| am| zu)?\b|^pressemiteilung( vom| am| zu)?\b|^pressemeldung( vom| am| zu)?\b|^presseinformation( vom| am| zu)?\b/.test(title)) return true;
  if (/^(aktuelles|kurzmeldung|presse|pressekontakt|pressemitteilungen?|pressemittelungen?|pressemiteilungen?|presseinformationen?|presse informationen|presseinformation|newsroom|veranstaltung|anmeldung)\b/.test(title)) return true;
  if (/^der .+verlagsgruppe$/.test(title)) return true;
  if (/(pressekontakt|presseinformationen|presse informationen|pressemitteilungen und publikationen|pressemeldungen.*positionen.*publikationen|newsroom|unser newsroom|veranstaltung|termin|event|messe|webinar|konferenz|fachtagung|kongress|presseeinladung|einladung|save the date|filme und animationen|infomaterialien|broschueren|anmeldung|newsletter|pressetexte 20\d{2}|presse bpb de|positionspapiere|unsere kopfe|unsere koepfe|aktuelles hier finden sie aktuelle veroffentlichungen|aktuelles hier finden sie aktuelle veroeffentlichungen)/.test(title)) return true;
  if (/\b(veranstaltung|veranstaltungen|termin|termine|event|messe|webinar|konferenz|fachtagung|kongress|presseeinladung|einladung|save the date|livestream|besuchen sie uns|findet am|findet vom|diskutieren auf der|auf der re publica|re publica 20\d{2})\b/.test(text)) return true;
  return /(cookie|newsletter abonnieren|zum inhalt springen|pressekontakt|ihre anmeldung|datenschutz|impressum|hauptnavigation|servicenavigation|suchfeld|presse fotos logos banner|filter themen alle anzeigen|download pdf)/.test(text)
    && !/(pressemitteilung|pressemeldung).{20,}(medien|sender|streaming|produktion|digital|tv|plattform|ki|vermarktung|audio|video|standard)/.test(text);
}

function isDuplicatePressRelease(item = {}) {
  const status = normalizeText([item.duplicate_status, item.duplicateStatus].join(" "));
  if (!status) return false;
  if (/(keine dublette|kein duplikat|no duplicate|not duplicate|unique)/.test(status)) return false;
  return /\b(dublette|duplikat|duplicate)\b/.test(status);
}

function articleOrigin(article = {}) {
  const log = article.ai_log_json || article.aiLogJson || {};
  const origin = article.generation_origin || article.generationOrigin || log.origin || "";
  const researchMode = article.research_mode || article.researchMode || log.research_mode || "";
  if (log.localPreview || String(origin || "").includes("topic_pool") || String(researchMode || "").includes("local")) {
    return {
      label: "Nicht-Live-Themenpool",
      shortNote: "Lokale Vorschau",
      note: "Dieser Alt-Datensatz stammt nicht aus der Live-Recherche."
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
    check_status: source.check_status || source.checkStatus || "geprüft",
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
  const createLabel = "Neu erzeugen";
  const thumbnailUrl = article.thumbnail_url || article.thumbnailUrl || article.imageUrl || "";
  const audioUrl = article.audioUrl || article.audio_url || "";
  const canPublish = true;
  return `<div class="ai-editor-shell ai-editor-shell--news-layout">
    <div class="ai-editor-main">
      <div class="ai-editor-head">
        <div><p class="eyebrow">Beitraege &gt; Artikel bearbeiten</p><h2>${escapeHtml(displayHeadline)}</h2></div>
        <div class="ai-status-stack">${badge(origin.label)}${badge(article.publication_status || article.status || "Entwurf")}</div>
      </div>
      <div class="ai-editor-actions">
        ${pictogram("+", createLabel, 'data-ai-editorial-run="manual"')}
        ${pictogram("O", "Vorschau", `data-ai-article-action="preview" data-article-id="${escapeHtml(article.id)}"`)}
        ${pictogram("OK", "Speichern", `data-ai-article-action="check" data-article-id="${escapeHtml(article.id)}"`)}
      </div>
      <div id="ai-editorial-run-result"></div>
      <div id="ai-article-action-result"></div>
      <section class="panel ai-editor-panel" id="ai-editor-section-content" data-ai-editor-section="content">
        <form id="ai-article-edit-form" data-article-id="${escapeHtml(article.id)}" class="form-grid">
          <div class="editorial-workspace editorial-workspace--text-editor ai-newslike-editor">
            <div class="editorial-workspace__main">
              <div class="field editorial-text-field editorial-text-field--compact"><div class="editorial-field-head"><label>Titel / Headline</label><div class="ai-field-actions">${pictogram("+", "Headline erzeugen", `data-ai-article-action="headline" data-article-id="${escapeHtml(article.id)}"`)}</div></div><textarea name="headline" rows="2">${escapeHtml(displayHeadline || displayTitle)}</textarea></div>
              <div class="field editorial-text-field editorial-text-field--compact"><div class="editorial-field-head"><label>Subline</label><div class="ai-field-actions">${pictogram("=", "Subline erzeugen", `data-ai-article-action="summary" data-article-id="${escapeHtml(article.id)}"`)}</div></div><textarea name="subline" rows="2" maxlength="90">${escapeHtml(article.subline || article.subtitle || "")}</textarea></div>
              <div class="field editorial-text-field editorial-text-field--body"><div class="editorial-field-head"><label>Haupttext</label><div class="ai-field-actions">${pictogram("R", "Text vorbereiten / vergleichen", `data-ai-article-action="compareRewrite" data-article-id="${escapeHtml(article.id)}"`)}</div></div><textarea name="bodyText">${escapeHtml(article.body || article.bodyText || "")}</textarea></div>
              <div class="field editorial-text-field"><div class="editorial-field-head"><label>Shorttext / Intro</label><div class="ai-field-actions">${pictogram("=", "Kurztext erzeugen", `data-ai-article-action="summary" data-article-id="${escapeHtml(article.id)}"`)}</div></div><textarea name="introText">${escapeHtml(article.introText || article.shortText || article.teaserText || "")}</textarea></div>
            </div>
            <aside class="editorial-tools">
              <section class="editorial-meta-panel">
                <div class="editorial-tools__head"><p class="eyebrow">Meta</p><h3>Veroeffentlichung</h3></div>
                <div class="field"><label>Kategorie</label><input name="category" value="${escapeHtml(article.category || "")}"></div>
                <div class="field"><label>Status</label><select name="publication_status"><option value="Entwurf" ${article.publication_status === "Entwurf" ? "selected" : ""}>Entwurf</option><option value="freigegeben" ${article.publication_status === "freigegeben" ? "selected" : ""}>Freigegeben</option><option value="veroeffentlicht" ${article.publication_status === "veroeffentlicht" ? "selected" : ""}>Veroeffentlicht</option></select></div>
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
          <div class="actions"><button class="button button--primary" type="submit">Aenderungen speichern</button><span class="muted">Speichern aktualisiert den Entwurf.</span></div>
          <div id="ai-article-save-result"></div>
        </form>
      </section>
      <section class="panel" id="ai-editor-section-sources" data-ai-editor-section="sources">
        <h2>Quellen</h2>
        <div class="alert">Quellen sind redaktionelle Hinweise. Fehlende oder unklare Quellen bitte im Editor prüfen.</div>
        <div class="ai-picto-row">${pictogram("OK", "Quellen prüfen", `data-ai-article-action="sources" data-article-id="${escapeHtml(article.id)}"`)}${pictogram("Q", "Belege bestaetigen", `data-ai-article-action="confirmClaims" data-article-id="${escapeHtml(article.id)}"`)}</div>
        ${articleSources.length ? `<div class="ai-source-grid">${sourceCards(articleSources)}</div>` : `<p class="muted">Noch keine Quellen gespeichert. Bitte echte Quellen mit erreichbarer URL erfassen.</p>`}
        <form id="ai-article-source-form" data-article-id="${escapeHtml(article.id)}" class="form-grid ai-source-entry-form">
          <h3>Quelle hinzufuegen</h3>
          <div class="form-grid--two">
            <div class="field"><label>Titel</label><input name="title" required placeholder="z. B. European Accessibility Act"></div>
            <div class="field"><label>Herausgeber</label><input name="publisher" required placeholder="z. B. EU-Kommission"></div>
            <div class="field"><label>URL</label><input name="url" type="url" required placeholder="https://..."></div>
            <div class="field"><label>Quellentyp</label><select name="source_type"><option>Primaerquelle</option><option>Behoerde</option><option>Verband</option><option>Fachmedium</option><option>Unternehmensmeldung</option><option>Standard / Spezifikation</option><option>Studie</option></select></div>
            <input name="trust_score" type="hidden" value="70">
            <div class="field"><label>Pruefstatus</label><select name="check_status"><option value="geprüft">geprüft</option><option value="teilweise geprüft">teilweise geprüft</option><option value="ungeprüft">ungeprüft</option></select></div>
          </div>
          <div class="field"><label>Belegte Aussage</label><textarea name="claim_reference" placeholder="Welche zentrale Aussage im Artikel wird durch diese Quelle belegt?"></textarea></div>
          <div class="field"><label>Quellennotiz</label><textarea name="relevance_note" placeholder="Welche Information wird durch diese Quelle belegt?"></textarea></div>
          <div class="actions"><button class="button button--primary">Quelle speichern</button></div>
          <div id="ai-source-save-result"></div>
        </form>
        <div class="table-wrap"><table class="table"><thead><tr><th>Quelle</th><th>Typ</th><th>Status</th><th>Link</th></tr></thead><tbody>${articleSources.length ? sourceRows(articleSources) : `<tr><td colspan="4">Noch keine Quellen gespeichert.</td></tr>`}</tbody></table></div>
      </section>
      <section class="panel" id="ai-editor-section-keywords" data-ai-editor-section="keywords"><h2>Keywords</h2><div class="ai-picto-row">${pictogram("+", "Keywords erzeugen", `data-ai-article-action="keywords" data-article-id="${escapeHtml(article.id)}"`)}${pictogram("SEO", "SEO erzeugen", `data-ai-article-action="seo" data-article-id="${escapeHtml(article.id)}"`)}</div><div class="ai-keyword-cloud">${articleKeywords.length ? articleKeywords.map((keyword) => `<span>${escapeHtml(keyword.keyword)}</span>`).join("") : `<p class="muted">Noch keine Keywords gespeichert.</p>`}</div></section>
      <section class="panel" id="ai-editor-section-status" data-ai-editor-section="status"><h2>Status</h2><div class="ai-status-stack">${badge(article.source_status || "-")}${badge(article.ai_check_status || "-")}${badge(article.publication_status || article.status || "Entwurf")}</div></section>
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
      <div class="field"><label>Mindestanzahl Quellen</label><input name="minimumSources" type="number" min="1" value="${Number(settings.minimumSources || 1)}"></div>
      <input name="minimumTrustScore" type="hidden" value="${Number(settings.minimumTrustScore || 70)}">
    </div>
    <label class="checkbox"><input type="checkbox" name="allowAutoPublish" disabled> Automatische Veroeffentlichung bleibt deaktiviert</label>
    <div class="alert alert--warning">Schutzregeln sind fest verdrahtet: keine Halluzinationen, keine erfundenen Quellen, keine KI-Bewertung und keine Score-Vergabe. Fuer die Themenliste reicht eine valide Quelle.</div>
    <div class="actions"><button class="button button--primary">Einstellungen speichern</button></div>
    <div id="ai-editorial-settings-result"></div>
  </form>
  <section class="panel ai-reset-panel">
    <div class="editorial-field-head">
      <div>
        <h2>KI-Redaktion leeren</h2>
        <p class="muted">Leert Themenliste, Queue, Rawdaten, Presseimporte, Logs, Tests und erzeugte KI-/Morgenbriefing-Beitraege. Prompts, Quellen und Einstellungen bleiben erhalten.</p>
      </div>
      <button class="button button--danger" type="button" data-ai-editorial-reset>Inhalte leeren</button>
    </div>
    <div id="ai-editorial-reset-result"></div>
  </section>`;
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


function newsImportPageContent(active) {
  const hashQuery = String(window.location.hash || "").split("?")[1] || "";
  const query = new URLSearchParams(hashQuery);
  const prefillSourceUrl = query.get("sourceUrl") || "";
  return `${cmsTitle("KI-Redaktion", "News importieren")}
    ${nav(active)}
    <section class="panel ai-news-import-panel">
      <div class="ai-news-import-head">
        <div>
          <p class="eyebrow">Quellenimport</p>
          <h2>News importieren</h2>
          <p>Fuegen Sie Text ein, tragen Sie eine einzelne URL ein oder laden Sie Bild- und Textdateien hoch. Der Import holt das Material zuerst in diesen News-Importbereich. Erst danach wird daraus ein KI-News-Entwurf erstellt.</p>
        </div>
        <div class="ai-news-import-badge">News-Import</div>
      </div>
      <form id="ai-news-import-form" class="form-grid">
        <div class="field editorial-text-field editorial-text-field--body">
          <label>Textquelle einfuegen</label>
          <textarea name="sourceText" placeholder="Pressemitteilung, Webseiten-Text, Notizen, Interview, E-Mail oder andere Textquelle hier einfuegen ..."></textarea>
        </div>
        <div class="field">
          <label>Nur URL importieren</label>
          <input name="sourceUrl" type="url" placeholder="https://..." value="${escapeHtml(prefillSourceUrl)}">
          <p class="muted">Oeffnet die URL serverseitig und importiert den sichtbaren Beitragstext unveraendert als Quelle. Keine Interpretation, keine Umformulierung.</p>
        </div>
        <label class="ai-news-dropzone" data-ai-news-dropzone>
          <strong>Text- oder Bilddateien hier ablegen</strong>
          <span>PDF, DOCX, TXT, HTML, JPG, JPEG, PNG, WEBP</span>
          <input type="file" name="sourceFiles" accept=".pdf,.docx,.txt,.html,.htm,image/jpeg,image/png,image/webp" multiple hidden>
        </label>
        <div class="ai-news-file-list" data-ai-news-file-list>
          <p class="muted">Noch keine Dateien ausgewaehlt.</p>
        </div>
        <div class="actions">
          <button class="button button--secondary" type="button" data-ai-news-add-source>+ Quelle hinzufuegen</button>
          <button class="button button--primary" type="submit">News erstellen</button>
        </div>
        <div id="ai-news-import-result"></div>
      </form>
    </section>`;
}

export async function aiEditorialPage(section = "dashboard", query = new URLSearchParams()) {
  const active = section || "dashboard";
  const resetLocalTopics = query.get("resetTopics") === "1";
  if (resetLocalTopics) {
    
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#/cms/ai-editorial/dashboard`);
  }
  const user = currentUser();
  if (!canUseCms(user)) return protect("");
  let [articles, sources, prompts, promptTests, keywords, logs, settingsRecord, topicSuggestions, topicQueue, topicRawData, pressReleases, pressSourceStatus, pressImportRuns] = await Promise.all([
    optionalList("editorialContent"),
    optionalList("verified_sources"),
    optionalList("ai_prompts"),
    optionalList("ai_prompt_tests"),
    optionalList("article_keywords"),
    optionalList("ai_editorial_logs"),
    optionalGetOne("settings", "aiEditorial"),
    optionalList("ai_topic_suggestions"),
    optionalList("ai_topic_queue"),
    optionalList("ai_topic_raw_data"),
    optionalList("ai_press_releases"),
    optionalList("ai_press_source_status"),
    optionalList("ai_press_import_runs")
  ]);
  sources = uniqueSources([...sources, ...aiSourceCatalog]);
  prompts = await ensureSystemPrompts(prompts);
  const aiArticles = sortArticlesNewestFirst(articles.filter(isAiEditorialArticle).filter((article) => !isLowQualityPressImportArticle(article)));
  const morningBriefingItems = sortTopicSuggestions(topicSuggestions.filter(isMorningBriefingItem));
  const sourceSuggestions = sources.filter((source) => source.suggested_by_ai || ["vorgeschlagen", "in Prüfung", "neu", "ungeprüft"].includes(source.review_status));
  const settings = {
    automationEnabled: false,
    publicationMode: "draft_only",
    minimumSources: 1,
    minimumTrustScore: 70,
    scheduleLabel: "Taeglich 06:00 Uhr",
    ...(settingsRecord || {})
  };
  const latestArticle = latest(aiArticles);
  const latestLog = latest(logs, "created_at");
  const latestPressRun = latest(pressImportRuns, "updated_at");
  const visiblePressReleases = pressReleases.filter((release) => !isLowQualityPressRelease(release) && !isDuplicatePressRelease(release));
  const duplicatePressReleases = pressReleases.filter(isDuplicatePressRelease);
  const filteredPressReleases = pressReleases.filter((release) => isLowQualityPressRelease(release) && !isDuplicatePressRelease(release));
  const secondaryPressReleases = [...duplicatePressReleases, ...filteredPressReleases];
  const sortedPressReleases = [...visiblePressReleases].sort((a, b) => String(b.published_at || b.imported_at || "").localeCompare(String(a.published_at || a.imported_at || "")));
  const sortedSecondaryPressReleases = [...secondaryPressReleases].sort((a, b) => String(b.published_at || b.imported_at || "").localeCompare(String(a.published_at || a.imported_at || "")));
  const sortedPressSourceStatus = [...pressSourceStatus].sort((a, b) => {
    const aPaused = String(a.status || "").includes("pausiert") ? 0 : 1;
    const bPaused = String(b.status || "").includes("pausiert") ? 0 : 1;
    return aPaused - bPaused || Number(b.consecutive_empty_scans || 0) - Number(a.consecutive_empty_scans || 0) || String(a.source_name || "").localeCompare(String(b.source_name || ""), "de");
  });
  const openSuggestions = sortTopicSuggestions(topicSuggestions.filter((topic) => isUsableTopicSuggestion(topic) && !["abgelehnt", "archiviert"].includes(topic.queue_status || topic.status)));
  const openSuggestionIds = new Set(openSuggestions.map((topic) => topic.id));
  const secondaryTopicSuggestions = sortTopicSuggestions(topicSuggestions.filter((topic) => !openSuggestionIds.has(topic.id) && isUsableTopicSuggestion(topic)));
  const filteredTopicSuggestions = sortTopicSuggestions(topicSuggestions.filter((topic) => !isUsableTopicSuggestion(topic)));
  const queuedTopics = topicQueue.filter((topic) => !["erledigt", "abgelehnt"].includes(topic.status));
  const topicKeywords = topicKeywordStats([...topicSuggestions, ...topicQueue]);
  const selectedKeyword = normalizeText(query.get("keyword") || "");
  const selectedKeywordLabel = topicKeywords.find((keyword) => keyword.key === selectedKeyword)?.keyword || query.get("keyword") || "";
  const selectedKeywordTopics = selectedKeyword
    ? [...topicSuggestions, ...topicQueue].filter((topic) => toList(topic.keywords || topic.tags || topic.keyword_json).some((keyword) => normalizeText(keyword) === selectedKeyword))
    : [];
  const editorId = query.get("id");
  const loadedArticle = editorId ? aiArticles.find((item) => item.id === editorId) || await getOne("editorialContent", editorId) : null;
  const articleForEditor = loadedArticle && isAiEditorialArticle(loadedArticle) ? loadedArticle : null;
  if (active === "editor" && articleForEditor) {
    return protect(cmsShell("cms/ai-editorial/articles", `${cmsTitle("KI-Redaktion", "Artikel-Editor", `<a class="button button--secondary button--small" href="#/cms/ai-editorial/articles">Zurueck</a>`)}${nav("articles")}${editor(articleForEditor, sources, keywords, logs)}`));
  }
  const createLabel = "KI-Beitrag jetzt erzeugen";
  const headerActions = "";
  const topicRawDataForTopics = topicRawData.filter((item) => !isPressTopicRawItem(item));
  const rawTopicDataTable = `<details class="topic-raw-data-details"><summary><strong><span class="raw-toggle-label raw-toggle-label--show">Rawdaten anzeigen</span><span class="raw-toggle-label raw-toggle-label--hide">Rawdaten verbergen</span></strong><span>${topicRawDataForTopics.length} Rows aus Quellenrecherche</span></summary><div class="editorial-field-head"><p class="muted">Gespeicherte Rohdaten der Themenrecherche: geparste Quellen, gefundene Veroeffentlichungen und spaetere Zuordnung zu Themenvorschlaegen.</p>${topicRawData.length ? `<button class="button button--danger button--small" type="button" data-ai-topic-raw-clear>Rawdaten loeschen</button>` : ""}</div><div class="table-wrap"><table class="table table--topic-raw-data"><thead><tr><th>Quelle</th><th>Fund / Thema</th><th>Datum</th><th>Link</th><th>Zuordnung</th></tr></thead><tbody>${topicRawDataForTopics.length ? rawTopicRows([...topicRawDataForTopics].sort((a, b) => String(b.created_at || b.createdAt || "").localeCompare(String(a.created_at || a.createdAt || ""))).slice(0, 120)) : `<tr><td colspan="5">Noch keine Rawdaten gespeichert. Starte eine Themenrecherche.</td></tr>`}</tbody></table></div></details>`;
  const sourceOptions = sources
    .filter((source) => !String(source.source_status || source.review_status || "").toLowerCase().includes("gesperrt"))
    .filter(sourceLooksGerman)
    .sort((a, b) => String(a.name || a.title || a.domain || "").localeCompare(String(b.name || b.title || b.domain || ""), "de"))
    .map((source) => {
      const value = source.id || source.domain || source.url || source.name || "";
      const label = [source.name || source.title || source.domain || "Quelle", source.domain].filter(Boolean).join(" - ");
      return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
    }).join("");
  const secondaryTopicSection = secondaryTopicSuggestions.length ? `<details class="press-hidden-details topic-secondary-details"><summary><strong>Gespeicherte Themen ausserhalb der Arbeitsliste</strong><span>${secondaryTopicSuggestions.length} uebernommen oder zurueckgestellt</span></summary><p class="muted">Diese Themen bleiben gespeichert, werden aber nicht fuer die direkte Beitragserstellung angeboten.</p><div class="table-wrap"><table class="table table--topic-suggestions"><thead><tr><th>Thema / Quelle</th><th>Kategorie / Quellenhinweis</th><th>Beleg</th><th>Status</th><th>Aktion</th></tr></thead><tbody>${topicSuggestionRows(secondaryTopicSuggestions.slice(0, 120), sources, { readonly: true, articles: aiArticles })}</tbody></table></div></details>` : "";
  const filteredTopicSection = filteredTopicSuggestions.length ? `<details class="press-hidden-details topic-secondary-details"><summary><strong>Aus Keywords/Quellen vorhandene, aber ausgefilterte Themen</strong><span>${filteredTopicSuggestions.length} gespeichert</span></summary><p class="muted">Diese Eintraege sind nicht weg. Sie liegen in den gespeicherten Themenvorschlaegen, werden aber wegen Filterregeln nicht in der Arbeitsliste angezeigt, zum Beispiel Presse-, Event-, Termin-, Navigations- oder unpassende Treffer.</p><div class="table-wrap"><table class="table table--topic-suggestions"><thead><tr><th>Thema / Keywords</th><th>Kategorie</th><th>Filtergrund</th><th>Datum</th></tr></thead><tbody>${filteredTopicRows(filteredTopicSuggestions.slice(0, 160))}</tbody></table></div></details>` : "";
  const topicResearchPanel = `<section class="panel ai-topic-research-panel"><div class="ai-topic-research-hero"><div class="ai-topic-research-copy"><p class="eyebrow">KI-Redaktion</p><h2>Themenrecherche</h2><p>Erstellt Themenvorschlaege aus den hinterlegten Quellen. Die KI bereitet vor; die Redaktion entscheidet ueber Bearbeitung und Veroeffentlichung.</p><div class="ai-topic-research-facts"><span>Quellenhinweis</span><span>Themenfeld</span><span>Redaktion entscheidet</span></div></div><div class="ai-topic-research-card"><div class="ai-topic-research-controls ai-topic-research-controls--compact"><div class="field"><label>Themenbereich</label><select id="ai-topic-research-category">${topicResearchCategories.map((category) => `<option value="${category === "Alle Themenbereiche" ? "" : escapeHtml(category)}">${escapeHtml(category)}</option>`).join("")}</select></div><div class="field"><label>Quelle</label><select id="ai-topic-research-source"><option value="">Alle passenden Quellen</option>${sourceOptions}</select></div><div class="field"><label>Stichworte</label><input id="ai-topic-research-keywords" placeholder="z. B. FAST, GEMA, Voice-Cloning"></div><div class="ai-picto-row ai-topic-research-actions">${pictogram(">", "Recherche starten", "data-ai-topic-research")}</div></div></div></div><div id="ai-topic-research-result"></div><div class="ai-topic-subtools">${rawTopicDataTable}</div>${openSuggestions.length ? `<form id="ai-topic-suggestions-form"><div class="table-wrap"><table class="table table--topic-suggestions"><thead><tr><th>Thema / Quelle</th><th>Kategorie / Quellenhinweis</th><th>Beleg</th><th>Status</th><th>Aktion</th></tr></thead><tbody>${topicSuggestionRows(openSuggestions.slice(0, 120), sources, { articles: aiArticles })}</tbody></table></div><div class="actions"><button class="button button--primary">News erstellen</button></div></form>` : `<div class="alert">Noch keine offenen Themenvorschlaege. Starte eine Themenrecherche.</div>`}${secondaryTopicSection}${filteredTopicSection}</section><section class="panel"><h2>Themen-Queue</h2><div class="table-wrap"><table class="table"><thead><tr><th>Thema</th><th>Kategorie</th><th>Beleg</th><th>Status</th><th>Datum</th></tr></thead><tbody>${queuedTopics.length ? topicQueueRows(queuedTopics) : `<tr><td colspan="5">Noch keine Themen in der Queue.</td></tr>`}</tbody></table></div></section>`;
  const pressListNotice = sortedPressReleases.length
    ? duplicatePressReleases.length ? `<p class="muted">${duplicatePressReleases.length} Dubletten sind gespeichert, werden aber nicht in der verwertbaren Presseliste angezeigt.</p>` : ""
    : duplicatePressReleases.length ? `<p class="muted">Keine verwertbaren Pressemitteilungen in der Liste. ${duplicatePressReleases.length} gespeicherte Dubletten werden nicht angezeigt.</p>` : "";
  const secondaryPressSection = sortedSecondaryPressReleases.length ? `<details class="press-hidden-details" open><summary><strong>Gespeicherte Eintraege ausserhalb der Arbeitsliste</strong><span>${sortedSecondaryPressReleases.length} Dubletten oder ausgefilterte Treffer</span></summary><p class="muted">Diese Pressemitteilungen bleiben gespeichert, werden aber nicht fuer die redaktionelle Weiterverarbeitung angeboten.</p><div class="table-wrap"><table class="table table--press-releases"><thead><tr><th>Pressemitteilung</th><th>Quelle</th><th>Datum</th><th>Zeichen</th><th>Status</th></tr></thead><tbody>${pressReleaseRows(sortedSecondaryPressReleases.slice(0, 160), { readonly: true, readonlyLabel: "Dubletten/Filter" })}</tbody></table></div></details>` : "";
  const pressView = query.get("view") === "sources" ? "sources" : "releases";
  const pressTabs = `<div class="ai-subnav ai-press-subnav"><a class="button ${pressView === "releases" ? "button--primary" : "button--secondary"}" href="#/cms/ai-editorial/press?view=releases">Pressemitteilungen</a><a class="button ${pressView === "sources" ? "button--primary" : "button--secondary"}" href="#/cms/ai-editorial/press?view=sources">Quellenstatus</a></div>`;
  const pressReleasePanel = `<section class="panel ai-press-import-panel"><div><h2>Presseimport</h2><p>Eigene Tabelle fuer importierte Pressemitteilungen. Dubletten werden vor dem Speichern geprüft. Alte Pressemitteilungen bleiben erhalten; ungeeignete neue Treffer werden nur nicht importiert.</p>${latestPressRun ? `<small>Letzter Lauf: ${escapeHtml(latestPressRun.message || latestPressRun.status || "")}</small>` : ""}</div><div class="ai-picto-row">${pictogram("PR", "Presseimport starten", "data-ai-press-import")}</div></section><div id="ai-press-import-result"></div><section class="panel"><h2>Importierte Pressemitteilungen</h2>${pressListNotice}<div id="ai-press-delete-result"></div><div class="table-wrap"><table class="table table--press-releases"><thead><tr><th>Pressemitteilung</th><th>Quelle</th><th>Datum</th><th>Zeichen</th><th>Aktion</th></tr></thead><tbody>${sortedPressReleases.length ? pressReleaseRows(sortedPressReleases.slice(0, 120)) : `<tr><td colspan="5">Noch keine verwertbaren Pressemitteilungen importiert.</td></tr>`}</tbody></table></div>${secondaryPressSection}</section>`;
  const pressSourcesPanel = `<section class="panel"><h2>Quellenstatus Presse</h2><p class="muted">Quellen werden erst nach drei erfolglosen Scans fuer 14 Tage ausgespart. Ein Treffer aktiviert die Quelle wieder.</p><div class="table-wrap"><table class="table table--press-sources"><thead><tr><th>Portal</th><th>Status</th><th>Letzte Treffer</th><th>Leerscans</th><th>Skip bis</th><th>Grund</th></tr></thead><tbody>${sortedPressSourceStatus.length ? pressSourceStatusRows(sortedPressSourceStatus.slice(0, 120)) : `<tr><td colspan="6">Noch kein Presse-Quellenstatus gespeichert.</td></tr>`}</tbody></table></div></section>`;
  const pressPanel = `${cmsTitle("KI-Redaktion", "Presse")}${nav(active)}${pressTabs}${pressView === "sources" ? pressSourcesPanel : pressReleasePanel}`;
  const content = {
    dashboard: `${cmsTitle("KI-Redaktion", "Themenliste")}
      ${nav(active)}
      
      ${topicResearchPanel}
      <div id="ai-editorial-run-result"></div>`,
    "news-import": newsImportPageContent(active),
    "morning-briefing": morningBriefingPanel({ items: morningBriefingItems, articles, sources, logs, settings }),
    articles: `${cmsTitle("KI-Redaktion", "Beitraege")}${nav(active)}<section class="panel"><p class="muted">Neueste Beitraege zuerst.</p><div class="table-wrap"><table class="table table--editorial"><thead><tr><th>Beitrag / Short Text</th><th>Quelle</th><th>Kategorie</th><th>Datum</th><th>Aktion</th></tr></thead><tbody>${aiArticles.length ? articleRows(aiArticles, { compactArticles: true }) : `<tr><td colspan="5">Noch keine KI-Beitraege.</td></tr>`}</tbody></table></div></section><div id="ai-editorial-run-result"></div>`,
    press: pressPanel,
    sources: `${cmsTitle("KI-Redaktion", "Quellen")}${nav(active)}<section class="panel"><details class="source-management-details"><summary><strong>Quellen verwalten</strong><span>manuell hinzufuegen, automatisch erweitern, loeschen</span></summary><p class="muted">Quellen koennen manuell ergaenzt oder aus dem Systemkatalog automatisch in die verifizierte Quellenliste uebernommen werden.</p>${verifiedSourceForm()}</details></section><section class="panel"><h2>Quellen nach Themenbereich</h2><p class="muted">Orientierungsliste fuer die Themenrecherche. Die Quellen sind noch keine Belege fuer einen Artikel; die konkrete Belegpruefung erfolgt im Editor.</p>${sourceCategoryBlocks(sources)}</section><section class="panel"><h2>Alle verifizierten Quellen</h2><div class="table-wrap"><table class="table"><thead><tr><th>Nr.</th><th>Quelle</th><th>Typ</th><th>Status</th><th>Link</th><th>Aktion</th></tr></thead><tbody>${sources.length ? sourceRows(sources, { numbered: true, manageable: true }) : `<tr><td colspan="6">Noch keine Quellen erfasst.</td></tr>`}</tbody></table></div></section>`,
    suggestions: `${cmsTitle("KI-Redaktion", "Quellenvorschlaege")}${nav(active)}<section class="panel"><div class="table-wrap"><table class="table"><thead><tr><th>Quelle</th><th>Typ</th><th>Status</th><th>Aktion</th></tr></thead><tbody>${sourceSuggestions.length ? sourceSuggestions.map((source) => `<tr><td><strong>${escapeHtml(source.name || source.title || "-")}</strong><small>${escapeHtml(source.suggestion_reason || source.domain || "")}</small></td><td>${escapeHtml(source.source_type || "-")}</td><td>${badge(source.review_status || "vorgeschlagen")}</td><td><button class="button button--secondary button--small" data-ai-source-review="${escapeHtml(source.id)}" data-review-status="in Prüfung">in Prüfung</button></td></tr>`).join("") : `<tr><td colspan="4">Keine neuen Quellenvorschlaege.</td></tr>`}</tbody></table></div></section><div id="ai-source-review-result"></div>`,
    prompts: `${cmsTitle("KI-Redaktion", "Prompt-Verwaltung")}${nav(active)}<section class="panel prompt-navigation-panel"><h2>Prompt-Navigation</h2>${promptNameNavigation(prompts)}</section><section class="panel prompt-edit-panel"><h2>Prompt anlegen / bearbeiten</h2>${promptForm(prompts.find((prompt) => !isArchivedPrompt(prompt)) || null)}</section><section class="panel"><h2>System-Prompts</h2><div class="table-wrap"><table class="table table--prompts"><thead><tr><th>Name</th><th>Typ</th><th>Aktueller Prompt</th><th>Status</th><th>Aktiv</th><th>Version</th><th>Geaendert</th><th>Aktion</th></tr></thead><tbody>${promptCatalogRows(prompts)}</tbody></table></div></section><section class="panel"><h2>Letzte Prompt-Tests</h2><div class="table-wrap"><table class="table"><thead><tr><th>Zeit</th><th>Prompt</th><th>Status</th><th>Warnungen</th></tr></thead><tbody>${promptTests.length ? promptTestRows([...promptTests].reverse().slice(0, 8)) : `<tr><td colspan="4">Noch keine Prompt-Tests.</td></tr>`}</tbody></table></div></section>`,
    keywords: `${cmsTitle("KI-Redaktion", "Keywords")}${nav(active)}<section class="panel"><h2>Themen-Keywords</h2><p class="muted">Keywords aus allen gespeicherten Themenvorschlaegen und der Themen-Queue. Einige Treffer koennen im Dashboard ausgefiltert sein; dort stehen sie jetzt im Block "Aus Keywords/Quellen vorhandene, aber ausgefilterte Themen".</p><div class="ai-keyword-cloud ai-keyword-cloud--clickable">${topicKeywords.length ? topicKeywords.slice(0, 60).map((keyword) => `<a class="${keyword.key === selectedKeyword ? "is-active" : ""}" href="#/cms/ai-editorial/keywords?keyword=${encodeURIComponent(keyword.key)}">${escapeHtml(keyword.keyword)} <strong>${keyword.count}</strong></a>`).join("") : `<p class="muted">Noch keine Themen-Keywords vorhanden. Starte eine Themenrecherche.</p>`}</div>${selectedKeyword ? `<section class="keyword-topic-detail"><div class="editorial-field-head"><h3>Themen zu "${escapeHtml(selectedKeywordLabel)}"</h3><a class="button button--secondary button--small" href="#/cms/ai-editorial/keywords">Filter loeschen</a></div><div class="table-wrap"><table class="table table--keyword-topics"><thead><tr><th>Thema</th><th>Kategorie</th><th>Beleg</th><th>Status</th></tr></thead><tbody>${selectedKeywordTopics.length ? keywordTopicRows(selectedKeywordTopics, aiArticles) : `<tr><td colspan="4">Keine Themen fuer dieses Keyword gefunden.</td></tr>`}</tbody></table></div></section>` : `<div class="alert">Waehle ein Keyword aus, um die zugehoerigen Themen zu sehen.</div>`}<div class="table-wrap"><table class="table table--topic-keywords"><thead><tr><th>Keyword</th><th>Treffer</th><th>Letzte Aktivitaet</th><th>Themen</th></tr></thead><tbody>${topicKeywords.length ? topicKeywordRows(topicKeywords.slice(0, 80)) : `<tr><td colspan="4">Noch keine Themen-Keywords vorhanden.</td></tr>`}</tbody></table></div></section><section class="panel"><h2>Artikel-Keywords</h2><div class="ai-keyword-cloud">${keywords.length ? keywords.map((keyword) => `<span>${escapeHtml(keyword.keyword)}</span>`).join("") : `<p class="muted">Noch keine KI-Artikel-Keywords gespeichert.</p>`}</div></section>`,
    automation: `${cmsTitle("KI-Redaktion", "Automatisierung")}${nav(active)}<div class="cms-columns"><section class="panel"><h2>Status</h2><div class="setup-steps"><div class="setup-step"><span>Automatisierung</span>${badge(settings.automationEnabled ? "Automatik aktiv" : "inaktiv")}</div><div class="setup-step"><span>Letzter Lauf</span><strong>${escapeHtml(formatDateTime(latestLog?.created_at || latestLog?.createdAt || "")) || "-"}</strong></div><div class="setup-step"><span>Letzte Warnung</span><strong>${escapeHtml(logs.find((log) => String(log.status || "").toLowerCase().includes("warn"))?.message || "-")}</strong></div></div><div class="ai-picto-row">${pictogram(">", "Automatik aktivieren", 'data-ai-editorial-automation="start"')}${pictogram("||", "Automatik pausieren", 'data-ai-editorial-automation="pause"')}</div><div id="ai-editorial-run-result"></div></section><section class="panel"><h2>Einstellungen</h2>${settingsForm(settings)}</section></div>`,
    logs: `${cmsTitle("KI-Redaktion", "Logs")}${nav(active)}<section class="panel"><h2>Ausfuehrungslogs</h2><div class="table-wrap"><table class="table"><thead><tr><th>Zeit</th><th>Aufgabe</th><th>Status</th><th>Meldung</th></tr></thead><tbody>${logs.length ? logRows([...logs].reverse()) : `<tr><td colspan="4">Noch keine KI-Redaktionslogs.</td></tr>`}</tbody></table></div></section><section class="panel"><div class="editorial-field-head"><div><h2>Rawdaten Themenfunde</h2><p class="muted">Alle gespeicherten Quellenfunde der Themenrecherche. Diese Rohdaten sind noch keine freigegebenen Artikel, sondern die Grundlage fuer Themenvorschlaege und spaetere Quellenzuordnung.</p></div>${topicRawData.length ? `<button class="button button--danger button--small" type="button" data-ai-topic-raw-clear>Rawdaten loeschen</button>` : ""}</div><div class="table-wrap"><table class="table table--topic-raw-data"><thead><tr><th>Quelle</th><th>Fund / Thema</th><th>Datum</th><th>Link</th><th>Zuordnung</th></tr></thead><tbody>${topicRawDataForTopics.length ? rawTopicRows([...topicRawDataForTopics].sort((a, b) => String(b.created_at || b.createdAt || "").localeCompare(String(a.created_at || a.createdAt || ""))).slice(0, 120)) : `<tr><td colspan="5">Noch keine Rawdaten gespeichert. Starte eine Themenrecherche.</td></tr>`}</tbody></table></div></section>`,
    settings: `${cmsTitle("KI-Redaktion", "Einstellungen")}${nav(active)}<section class="panel">${settingsForm(settings)}</section>`
  }[active] || "";
  return protect(cmsShell(`cms/ai-editorial/${active}`, content));
}
