import { getFirebaseServices, localPreviewMode } from "../firebase/firebaseClient.js";
import { currentUser, refreshAuthToken, waitForAuthReady } from "../firebase/authService.js?v=470";
import { upsert } from "../firebase/dataService.js?v=487";
import { aiSourceCatalog } from "../data/aiSourceCatalog.js";

const ACTION_FUNCTIONS = {
  improveText: "improveText",
  shortenText: "shortenText",
  extendText: "extendText",
  generateSeoMeta: "generateSeoMeta",
  generateEventDescription: "generateEventDescription",
  generateEventInvitation: "generateEventInvitation",
  generateEventAgenda: "generateEventAgenda",
  generateEventFaq: "generateEventFaq",
  generateTopicDescription: "generateTopicDescription",
  generateEventTopicDescription: "generateEventTopicDescription",
  generateSpeakerTalkText: "generateSpeakerTalkText",
  generateSponsorText: "generateSponsorText",
  generateRegistrationMailText: "generateRegistrationMailText",
  generateEventSummary: "generateEventSummary",
  generateArchiveText: "generateArchiveText",
  generateGalleryIntro: "generateGalleryIntro",
  generateImageAltText: "generateImageAltText",
  generateDownloadDescription: "generateDownloadDescription",
  rewritePressRetrospective: "rewritePressRetrospective",
  analyzeEventPipelineQuality: "analyzeEventPipelineQuality"
};

const DEFAULT_AI_EDITORIAL_THUMBNAIL_PROMPT = "Fotorealistisches redaktionelles 16:9-Vorschaubild fuer PROdigitalTV: serioeser moderner Business-Look, TV-, Streaming- und digitale Medienbranche, klare Komposition, natuerliches Licht, keine echten Logos, keine realen Personen, keine Comic-Optik, keine irrefuehrenden Bildinhalte.";

async function ensureCallableLogin(label = "KI-Aktion") {
  await waitForAuthReady();
  const user = await refreshAuthToken(true);
  if (!user?.uid || user.idToken === "demo-token") {
    throw new Error(`${label}: Login erforderlich. Bitte im CMS neu anmelden und danach erneut starten.`);
  }
  return user;
}

function isLocalHost() {
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

const LOCAL_TOPIC_POOL = [
  { key: "barrierefreiheit-streaming", title: "Barrierefreiheit in Streaming-Angeboten", headline: "Barrierefreiheit wird fuer Streaming-Anbieter wichtiger", subline: "Accessibility wird zum festen Bestandteil digitaler Medienangebote.", category: "Barrierefreiheit", keywords: ["Barrierefreiheit", "Streaming", "Untertitel", "Plattformregulierung", "Medienrecht"], thumbnailIdea: "Streaming-Oberflaeche mit Untertitel-Symbolen und klarer Accessibility-Anmutung.", actuality_score: 86, industry_score: 88, reason: "Regulatorische Anforderungen und Nutzererwartungen machen Accessibility fuer Streaming-Anbieter dauerhaft relevant." },
  { key: "hbbtv-smart-tv", title: "HbbTV und Smart-TV-Strategien", headline: "HbbTV bleibt wichtig fuer Smart-TV-Strategien", subline: "Offene TV-Standards helfen Sendern bei Reichweite und Nutzerfuehrung.", category: "HbbTV / Smart-TV", keywords: ["HbbTV", "Smart-TV", "Distribution", "TV-Apps", "Streaming-Technologie"], thumbnailIdea: "Moderner Smart-TV mit App-Oberflaeche, HbbTV-Signal und klarer Medienplattform-Aesthetik.", actuality_score: 79, industry_score: 84, reason: "Smart-TV bleibt zentraler Zugangspunkt fuer TV- und Streamingangebote." },
  { key: "ki-redaktion-produktion", title: "KI in Redaktion und Produktion", headline: "KI veraendert redaktionelle Produktionsprozesse", subline: "Automatisierung braucht klare Kontrolle, Quellen und Verantwortlichkeit.", category: "KI / Produktion", keywords: ["KI", "Redaktion", "Produktion", "Automatisierung", "Quellenpruefung"], thumbnailIdea: "Redaktioneller Arbeitsplatz mit abstrakter KI-Assistenz, Datenlinien und Medienmonitoren.", actuality_score: 94, industry_score: 92, reason: "KI-Workflows werden praktisch eingesetzt, brauchen aber Governance und Pruefprozesse." },
  { key: "fast-channel-distribution", title: "FAST-Channels und digitale Distribution", headline: "FAST-Channels erweitern die digitale Distribution", subline: "Lineare Streaming-Kanaele schaffen neue Chancen fuer Reichweite und Vermarktung.", category: "Distribution / FAST-Channels", keywords: ["FAST-Channels", "Distribution", "OTT", "Streaming", "Vermarktung"], thumbnailIdea: "Mehrere lineare Streaming-Kanaele auf einem modernen Dashboard, serioeser Business-Look.", actuality_score: 83, industry_score: 87, reason: "FAST bleibt fuer Plattformen, Rechtehalter und Vermarkter ein relevantes Wachstumsfeld." },
  { key: "musikrechte-streaming", title: "Musikrechte in digitalen Medienangeboten", headline: "Musikrechte bleiben zentral fuer digitale Medienangebote", subline: "Rechteklaerung ist Voraussetzung fuer sichere Auswertung und Distribution.", category: "Musikrechte / Verwertungsrecht", keywords: ["Musikrechte", "GEMA", "Verwertungsrecht", "Rechteklaerung", "Streaming"], thumbnailIdea: "Abstrakte Verbindung von Audiowellen, Medienplayer und rechtlicher Dokumentation.", actuality_score: 77, industry_score: 82, reason: "Rechteklaerung ist ein wiederkehrender Engpass bei digitaler Distribution." },
  { key: "voice-cloning-synchron", title: "Voice-Cloning in der Synchronbranche", headline: "KI-Stimmen setzen die Synchronbranche unter Druck", subline: "Voice-Cloning veraendert Rechte, Verguetung und Produktion.", category: "KI / Synchron / Verwertungsrecht", keywords: ["Voice-Cloning", "Synchronbranche", "KI-Stimmen", "Sprecherrechte", "Verwertungsrecht"], thumbnailIdea: "Synchronstudio mit Mikrofon, abstrakter KI-Wellenform und dezenter rechtlicher Symbolik.", actuality_score: 91, industry_score: 89, reason: "KI-Stimmen betreffen Produktion, Rechte und Verguetungsmodelle direkt." },
  { key: "addressable-tv-vermarktung", title: "Addressable TV und Vermarktung", headline: "Addressable TV verlangt klare Daten- und Werbestrategien", subline: "Zielgruppenwerbung im TV braucht Technik, Reichweite und Vertrauen.", category: "Werbung / Addressable TV", keywords: ["Addressable TV", "Werbung", "Vermarktung", "Reichweite", "Smart-TV"], thumbnailIdea: "TV-Werbedashboard mit Zielgruppen-Segmenten und neutraler Datenvisualisierung.", actuality_score: 80, industry_score: 86, reason: "Adressierbare Werbung bleibt ein wichtiges Feld fuer Sender und Vermarkter." },
  { key: "cdn-distribution-streaming", title: "CDN und Streaming-Distribution", headline: "Streaming-Qualitaet haengt an robuster Distribution", subline: "CDN-Strategien entscheiden ueber Kosten, Stabilitaet und Nutzererlebnis.", category: "CDN / Distribution", keywords: ["CDN", "Streaming", "Distribution", "OTT", "QoE"], thumbnailIdea: "Netzwerkvisualisierung mit Videostreams, Serverknoten und moderner Medieninfrastruktur.", actuality_score: 75, industry_score: 84, reason: "Kosten und Qualitaet digitaler Ausspielung bleiben operative Kernthemen." },
  { key: "plattformregulierung-medien", title: "Plattformregulierung fuer Medienanbieter", headline: "Plattformregeln praegen digitale Medienstrategien", subline: "Regulierung beeinflusst Sichtbarkeit, Verantwortung und Zugang zu Nutzern.", category: "Plattformregulierung", keywords: ["Plattformregulierung", "Medienrecht", "Streaming", "Plattformen", "Branchenpolitik"], thumbnailIdea: "Medienplattform mit Regelwerk-Overlay, klarer Business-Look, keine Logos.", actuality_score: 88, industry_score: 85, reason: "Regulatorische Vorgaben beeinflussen Plattformen und Anbieter strukturell." },
  { key: "leichte-sprache-medien", title: "Leichte Sprache in Medienangeboten", headline: "Leichte Sprache wird fuer Medienangebote wichtiger", subline: "Verstaendliche Inhalte erweitern Zugang und Teilhabe.", category: "Barrierefreiheit / leichte Sprache", keywords: ["leichte Sprache", "Barrierefreiheit", "Mediatheken", "Accessibility", "Inklusion"], thumbnailIdea: "Klare Medienoberflaeche mit vereinfachten Textbausteinen und Accessibility-Symbolik.", actuality_score: 74, industry_score: 78, reason: "Verstaendliche Sprache gewinnt bei digitalen Services und oeffentlichen Angeboten an Bedeutung." }
];

function localSuggestion(action, payload) {
  const text = payload.originalText || payload.context?.description || "";
  if (action === "generateSeoMeta") {
    return {
      action,
      suggestedText: "",
      structured: {
        seoTitle: `${payload.context?.title || "PROdigitalTV Event"} | PROdigitalTV`,
        seoDescription: text ? text.slice(0, 155) : "Branchenevent von PROdigitalTV fuer die digitale Medienwirtschaft.",
        keywords: ["PROdigitalTV", "digitale Medienwirtschaft", "Event"],
        summary: "SEO-Vorschlag aus lokalen Daten. Fuer echte KI bitte Firebase Function mit OPENAI_API_KEY nutzen."
      },
      status: "suggested"
    };
  }
  if (action === "analyzeEventPipelineQuality") {
    return {
      action,
      suggestedText: "",
      structured: {
        blockers: [],
        warnings: text.length < 120 ? ["Der Eventtext ist sehr kurz."] : [],
        recommendations: ["Oeffentlichen Teaser, SEO-Daten und Mobile-Kurztext redaktionell pruefen."],
        optionalNotes: ["KI-Pruefung ist nur eine Empfehlung und blockiert keine Pipeline-Statuswechsel."],
        summary: "Lokale Vorschau der KI-Pruefung. Fuer echte OpenAI-Analyse bitte Cloud Function konfigurieren."
      },
      status: "suggested"
    };
  }
  if (action === "generateImageAltText") {
    const title = payload.context?.title || payload.context?.filename || "Bild";
    const text = `Bildanalyse ist lokal nicht verfuegbar. Bitte die Cloud-KI nutzen oder den sichtbaren Bildinhalt manuell beschreiben: ${title}.`;
    return {
      action,
      suggestedText: text,
      structured: {
        description: text,
        alt_text: title
      },
      status: "suggested"
    };
  }
  if (action === "rewritePressRetrospective") {
    const prompt = String(payload.prompt || payload.context?.retrospectivePrompt || "").trim();
    return {
      action,
      suggestedText: [
        prompt ? `Prompt:\n${prompt}` : "Prompt fuer Rueckblick fehlt.",
        "",
        "Ausgangstext:",
        text || "Keine Pressemitteilung im Haupttext vorhanden."
      ].join("\n"),
      structured: null,
      status: "suggested"
    };
  }
  return {
    action,
    suggestedText: text
      ? text
      : "Aus den vorhandenen Angaben laesst sich noch kein aussagekraeftiger Beitrag formulieren.",
    structured: null,
    status: "suggested"
  };
}

export async function callChatGptAction(action, payload = {}) {
  const functionName = ACTION_FUNCTIONS[action] || action;
  const firebase = await getFirebaseServices();
  if (!firebase) return localSuggestion(action, payload);
  const callable = firebase.functionsLib.httpsCallable(firebase.functions, functionName);
  try {
    const result = await callable(payload);
    return result.data;
  } catch (error) {
    const message = String(error?.message || "");
    const authBlocked = ["functions/unauthenticated", "functions/permission-denied", "unauthenticated", "permission-denied"]
      .some((code) => String(error?.code || message).includes(code)) || /login erforderlich/i.test(message);
    if (isLocalHost() && authBlocked) {
      return localSuggestion(action, payload);
    }
    throw error;
  }
}

export async function runAiEditorialTask(mode = "manual") {
  if (localPreviewMode()) {
    return runLocalAiEditorialTask(mode);
  }
  const firebase = await getFirebaseServices();
  if (!firebase) {
    return {
      ok: false,
      status: "blocked",
      message: "Lokaler Demomodus: Es wird kein KI-Beitrag erzeugt. Ohne serverseitige Quellenrecherche und Pruefung wird keine Veroeffentlichung vorbereitet.",
      publicationStatus: "gesperrt wegen Quellenlage"
    };
  }
  await ensureCallableLogin("KI-Redaktion");
  const callable = firebase.functionsLib.httpsCallable(firebase.functions, "runAiEditorialTask");
  try {
    const result = await callable({ mode });
    return result.data;
  } catch (error) {
    if (["functions/not-found", "functions/unavailable", "functions/internal"].includes(error.code)) {
      const fallback = await runLocalAiEditorialTask(mode);
      return {
        ...fallback,
        message: fallback.ok
          ? "Cloud Function ist noch nicht erreichbar. Es wurde ein sicherer interner KI-Entwurf mit CMS-Fallback erzeugt."
          : fallback.message
      };
    }
    throw error;
  }
}

export async function runMorningBriefingTask(options = {}) {
  const firebase = await getFirebaseServices();
  if (!firebase || localPreviewMode()) {
    return {
      ok: false,
      status: "blocked",
      message: "Morgenbriefing laeuft nur ueber die deployte Firebase Function oder ueber den manuellen Pipe-Import."
    };
  }
  await ensureCallableLogin("Morgenbriefing");
  const callable = firebase.functionsLib.httpsCallable(firebase.functions, "runMorningBriefingTask", { timeout: 600000 });
  const result = await callable(options);
  return result.data;
}

export async function generateAiTopicSuggestions(options = {}) {
  const categoryFilter = String(options.category || "").trim();
  const keywordFilter = String(options.keywords || "").trim();
  const sourceFilter = String(options.sourceId || options.source_id || "").trim();
  const requestedLimit = Math.max(1, Math.min(10, Number(options.limit || 6)));
  const requireLive = options.requireLive === true;
  const keywordParts = keywordFilter.toLowerCase().split(/[,;\s]+/).map((item) => item.trim()).filter(Boolean);
  const firebase = await getFirebaseServices();
  if (firebase && !localPreviewMode()) {
    try {
      const callable = firebase.functionsLib.httpsCallable(firebase.functions, "generateAiEditorialTopicSuggestions", { timeout: 600000 });
      const result = await callable({
        limit: requestedLimit,
        category: categoryFilter,
        keywords: keywordFilter,
        sourceId: sourceFilter,
        allSources: options.allSources === true,
        researchMode: options.researchMode || ""
      });
      if (isLocalHost() && Array.isArray(result.data?.suggestions)) {
        await Promise.all(result.data.suggestions.map((suggestion) => upsert("ai_topic_suggestions", suggestion)));
      }
      return result.data;
    } catch (error) {
      if (requireLive) throw error;
      if (!["functions/not-found", "functions/unavailable", "functions/internal", "functions/unauthenticated", "functions/permission-denied"].includes(error?.code)) throw error;
    }
  }
  if (requireLive) {
    throw new Error("Live-Quellenrecherche ist nicht erreichbar. Kein Demo- oder Fallback-Themenpool wird fuer das Morgenbriefing verwendet.");
  }
  const { list, upsert: localUpsert } = await import("../firebase/dataService.js?v=487");
  const now = new Date().toISOString();
  const [articles, existingSuggestions, verifiedSources] = await Promise.all([
    list("editorialContent"),
    list("ai_topic_suggestions"),
    list("verified_sources")
  ]);
  const localSources = sourceFilter
    ? [...verifiedSources, ...aiSourceCatalog].filter((source) => [source.id, source.domain, source.url, source.name, source.title].some((value) => String(value || "").trim() === sourceFilter))
    : [...verifiedSources, ...aiSourceCatalog];
  const sourcePool = rotateLocalSources(localSources, existingSuggestions, categoryFilter, keywordFilter);
  const articleText = articles.map((article) => `${article.title || ""} ${article.headline || ""} ${article.category || ""} ${(article.tags || []).join(" ")}`.toLowerCase()).join(" ");
  const scoredTopics = LOCAL_TOPIC_POOL.map((topic) => {
    const haystack = `${topic.title} ${topic.headline} ${topic.subline} ${topic.category} ${(topic.keywords || []).join(" ")} ${topic.reason}`.toLowerCase();
    const categoryHit = categoryFilter ? haystack.includes(categoryFilter.toLowerCase().split("/")[0].trim()) || categoryFilter.toLowerCase().split(/\s+/).some((part) => part.length > 3 && haystack.includes(part)) : true;
    const keywordHits = keywordParts.filter((part) => haystack.includes(part)).length;
    return { topic, score: (categoryHit ? 40 : 0) + keywordHits * 18 + Number(topic.actuality_score || 0) / 10 };
  }).sort((a, b) => b.score - a.score);
  const orderedTopics = [
    ...scoredTopics.filter((item) => item.score > Number(item.topic.actuality_score || 0) / 10).map((item) => item.topic),
    ...scoredTopics.filter((item) => item.score <= Number(item.topic.actuality_score || 0) / 10).map((item) => item.topic)
  ];
  const selectedTopics = orderedTopics.map((topic, index) => {
    const parts = topic.key.split("-").filter(Boolean);
    const duplicateRisk = parts.filter((part) => articleText.includes(part)).length >= 2 ? "aehnliches Thema vorhanden" : "neu";
    const contextBoost = (categoryFilter || keywordParts.length) && index < 5 ? 4 : 0;
    return {
      id: `ai-topic-suggestion-${topic.key}`,
      topic_key: topic.key,
      title: topic.title,
      headline: topic.headline,
      subline: topic.subline,
      category: topic.category,
      keywords: topic.keywords,
      thumbnail_idea: topic.thumbnailIdea,
      actuality_score: Math.max(0, Math.min(100, Number(topic.actuality_score || 75) + contextBoost - (duplicateRisk === "neu" ? 0 : 9))),
      industry_score: Number(topic.industry_score || 75),
      relevance_score: Math.round((Number(topic.actuality_score || 75) + Number(topic.industry_score || 75)) / 2),
      duplicate_status: duplicateRisk,
      source_status: "Quelle vorhanden",
      status: "vorgeschlagen",
      queue_status: "nicht uebernommen",
      rank: index + 1,
      reason: [topic.reason, categoryFilter || keywordFilter ? `Recherche gelenkt durch: ${[categoryFilter, keywordFilter].filter(Boolean).join(" / ")}.` : ""].filter(Boolean).join(" "),
      research_category: categoryFilter,
      research_keywords: keywordFilter,
      created_at: now,
      updated_at: now,
      origin: "local_topic_research"
    };
  }).filter((topic) => {
    if (Number(topic.industry_score || 0) < 78 || Number(topic.relevance_score || 0) < 76) return false;
    if (!categoryFilter) return true;
    const haystack = `${topic.title} ${topic.headline} ${topic.subline} ${topic.category} ${(topic.keywords || []).join(" ")}`.toLowerCase();
    const categoryTerms = categoryFilter.toLowerCase().split(/[^a-z0-9]+/i).filter((part) => part.length > 3);
    return !categoryTerms.length || categoryTerms.some((part) => haystack.includes(part));
  }).sort((a, b) => b.relevance_score - a.relevance_score || b.actuality_score - a.actuality_score).slice(0, requestedLimit);
  const suggestions = selectedTopics.map((suggestion, index) => {
    const source = sourcePool[index] || {};
    return {
      ...suggestion,
      primary_source_id: source.id || "",
      source_ids: [source.id || source.domain || source.name].filter(Boolean),
      source_names: [source.name || source.domain].filter(Boolean),
      source_publication_date: "",
      source_date_status: "Datum nicht ermittelt",
      quality_status: "lokaler Kandidat",
      quality_score: Math.round((Number(suggestion.actuality_score || 0) + Number(suggestion.industry_score || 0) + Number(suggestion.relevance_score || 0)) / 3),
      source_candidates: source.name ? [{
        id: source.id || "",
        name: source.name,
        publisher: source.name,
        url: source.url || "",
        note: "Aus der Quellenrotation fuer diese Themenrecherche zugeordnet. Veroeffentlichungsdatum muss aus der konkreten Quellenmeldung ermittelt werden."
      }] : []
    };
  });
  await Promise.all(suggestions.map((suggestion, index) => localUpsert("ai_topic_suggestions", { ...suggestion, rank: index + 1 })));
  await localUpsert("ai_editorial_logs", {
    id: `ai-editorial-log-${crypto.randomUUID()}`,
    article_id: "",
    task_name: "KI_Redaktion_Themenrecherche",
    status: suggestions.length ? "suggested" : "blocked",
    message: suggestions.length
      ? `${suggestions.length} qualitaetsgepruefte Themenvorschlaege erstellt${categoryFilter || keywordFilter ? ` fuer ${[categoryFilter, keywordFilter].filter(Boolean).join(" / ")}` : ""}. Redaktionelle Auswahl fuer Queue erforderlich.`
      : `Keine belastbaren Themenvorschlaege gefunden${categoryFilter || keywordFilter ? ` fuer ${[categoryFilter, keywordFilter].filter(Boolean).join(" / ")}` : ""}.`,
    found_topics_json: suggestions,
    rejected_topics_json: [],
    used_sources_json: [],
      source_check_json: { source_status: "Eine valide Quelle reicht fuer die Themenliste" },
    duplicate_check_json: {},
    keyword_result_json: {},
    ai_check_json: { status: "Vorschlag", publication_status: "nicht freigegeben" },
    error_json: {},
    created_at: now
  });
  return {
    ok: suggestions.length > 0,
    suggestions,
    message: suggestions.length
      ? `${suggestions.length} Themenvorschlag${suggestions.length === 1 ? "" : "e"} wurden qualitaetsgeprueft erstellt. Bitte auswaehlen und in die Queue uebernehmen.`
      : "Keine belastbaren Themenvorschlaege gefunden. Rawdaten oder Quellenfilter pruefen."
  };
}

function normalizeSourceText(value = "") {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function localSourceCategories(source = {}) {
  return [
    ...(Array.isArray(source.default_for_categories) ? source.default_for_categories : []),
    ...(Array.isArray(source.defaultForCategories) ? source.defaultForCategories : []),
    source.category || ""
  ].map(normalizeSourceText).filter(Boolean);
}

function localCategoryTokens(value = "") {
  return normalizeSourceText(value)
    .split(/[^a-z0-9]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2 && !["in", "und", "oder", "der", "die", "das", "fuer", "fur"].includes(item));
}

function localCategoryPartsMatch(sourceCategory = "", requestedCategory = "") {
  const sourceTokens = localCategoryTokens(sourceCategory);
  const requestedTokens = localCategoryTokens(requestedCategory);
  if (!sourceTokens.length || !requestedTokens.length) return false;
  return requestedTokens.every((token) => sourceTokens.includes(token))
    || sourceTokens.every((token) => requestedTokens.includes(token));
}

function localSourceMatchesCategory(source = {}, category = "") {
  const categoryKey = normalizeSourceText(category);
  if (!categoryKey) return true;
  return localSourceCategories(source).some((item) => (
    item.includes(categoryKey)
    || categoryKey.includes(item)
    || localCategoryPartsMatch(item, categoryKey)
  ));
}

function localSourceMatches(source = {}, category = "", keywords = "") {
  const categoryKey = normalizeSourceText(category);
  const keywordParts = normalizeSourceText(keywords).split(/[,;\s/]+/).filter((part) => part.length > 3);
  const text = [
    source.name,
    source.domain,
    source.source_type,
    source.category,
    source.notes,
    ...localSourceCategories(source)
  ].map(normalizeSourceText).join(" ");
  if (categoryKey && (text.includes(categoryKey) || localSourceMatchesCategory(source, categoryKey))) return true;
  if (keywordParts.length && keywordParts.some((part) => text.includes(part))) return true;
  return !categoryKey && !keywordParts.length;
}

function localSuggestionSourceKeys(suggestion = {}) {
  return [
    suggestion.primary_source_id,
    ...(Array.isArray(suggestion.source_ids) ? suggestion.source_ids : []),
    ...(Array.isArray(suggestion.source_candidates) ? suggestion.source_candidates.map((source) => source.id || source.name || source.domain) : [])
  ].map((item) => String(item || "").trim()).filter(Boolean);
}

function localSourceIsExcluded(source = {}) {
  const text = normalizeSourceText([source.id, source.name, source.domain, source.url].join(" "));
  return /\brtl\b|rtl deutschland|rtl\.com|rtl\.de/.test(text);
}

export async function importGermanPressReleases(options = {}) {
  const firebase = await getFirebaseServices();
  if (!firebase || localPreviewMode()) {
    return {
      ok: false,
      imported: 0,
      articles: 0,
      message: "Presseimport laeuft nur ueber die deployte Cloud Function mit echten Quellen."
    };
  }
  await ensureCallableLogin("Presseimport");
  const callable = firebase.functionsLib.httpsCallable(firebase.functions, "importGermanPressReleases", { timeout: 600000 });
  const result = await callable({
    runId: options.runId || "",
    months: Math.max(1, Math.min(12, Number(options.months || 2))),
    perSourceLimit: Math.max(1, Math.min(10, Number(options.perSourceLimit || 4)))
  });
  return result.data;
}

function compactSourceText(value = "", limit = 9000) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function firstSentence(text = "") {
  return compactSourceText(text).split(/(?<=[.!?])\s+/).find((part) => part.trim().length > 20) || "";
}

function textTokens(value = "") {
  return new Set(String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9Ã¤Ã¶Ã¼ÃŸ]+/gi, " ")
    .split(/\s+/)
    .filter((word) => word.length > 4)
    .filter((word) => !["diese", "dieser", "diesen", "einer", "einem", "einen", "werden", "wurde", "haben", "ueber", "fuer", "nicht", "auch"].includes(word)));
}

function textSimilarity(a = "", b = "") {
  const aTokens = textTokens(a);
  const bTokens = textTokens(b);
  if (!aTokens.size || !bTokens.size) return 0;
  const overlap = [...aTokens].filter((token) => bTokens.has(token)).length;
  return overlap / Math.min(aTokens.size, bTokens.size);
}

function singleWordKeywords(values = [], fallbackText = "") {
  const stop = new Set(["gepr", "pruef", "pruefen", "geprueft", "redaktionell", "wird", "sind", "sein", "eine", "eines", "einen", "einem", "einer", "diese", "dieser", "diesen", "werden", "wurde", "wurden", "haben", "hatte", "hatten", "ueber", "fuer", "nicht", "auch", "oder", "und", "der", "die", "das", "dem", "den", "des", "mit", "von", "zur", "zum", "aus", "bei", "auf", "als", "dass", "wenn", "weil", "nach", "vor", "wie", "was"]);
  const raw = [
    ...(Array.isArray(values) ? values : String(values || "").split(",")),
    ...String(fallbackText || "").split(/\s+/)
  ];
  const seen = new Set();
  return raw
    .flatMap((item) => String(item || "").split(/[^A-Za-z0-9-]+/))
    .map((word) => word.replace(/^-+|-+$/g, "").trim())
    .filter((word) => word.length >= 4 && word.length <= 22)
    .filter((word) => !stop.has(word.toLowerCase()))
    .filter((word) => !/^(gepr|pruef|redakt|quelle|quellen|status)$/i.test(word))
    .filter((word) => {
      const key = word.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 4);
}

function complementarySubline(headline = "", text = "") {
  const sentences = compactSourceText(text)
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 35);
  return cleanSublineEnd(sentences.find((sentence) => textSimilarity(headline, sentence) < 0.45 && sentence !== headline) || "", 180)
    || "Der Beitrag ordnet die Entwicklung fuer die digitale Medien- und Kreativwirtschaft ein.";
}

function cleanSublineEnd(value = "", maxLength = 180) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= maxLength) return /[.!?]$/.test(text) ? text : `${text}.`;
  const clipped = text.slice(0, maxLength + 1);
  const sentenceEnd = Math.max(clipped.lastIndexOf("."), clipped.lastIndexOf("!"), clipped.lastIndexOf("?"));
  if (sentenceEnd > 60) return clipped.slice(0, sentenceEnd + 1).trim();
  const wordEnd = clipped.lastIndexOf(" ");
  const clean = clipped.slice(0, wordEnd > 60 ? wordEnd : maxLength).replace(/[,:;â€“-]\s*$/, "").trim();
  return clean ? `${clean}.` : "";
}

function localWordCount(value = "") {
  return String(value || "").trim().split(/\s+/).filter((word) => /[A-Za-z0-9]/.test(word)).length;
}

function sourceSentences(value = "") {
  return compactSourceText(value, 9000)
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.replace(/^Pressemitteilung[:\s-]*/i, "").trim())
    .filter((part) => part.length > 45)
    .filter((part, index, list) => list.findIndex((item) => item.toLowerCase() === part.toLowerCase()) === index)
    .slice(0, 12);
}

function sentenceSubject(headline = "", tags = []) {
  return String(headline || tags[0] || "die Entwicklung").replace(/[.!?]+$/g, "").trim() || "die Entwicklung";
}

function reformulatedNewsBody({ headline = "", subline = "", combinedText = "", tags = [], targetWords = 300 } = {}) {
  const minimumWords = Math.max(180, Math.min(900, Number(targetWords || 300)));
  const sentences = sourceSentences(combinedText);
  const subject = sentenceSubject(headline, tags);
  if (!sentences.length) return "Aus den bereitgestellten Informationen laesst sich derzeit noch kein aussagekraeftiger Beitrag ableiten.";
  const facts = sentences.map((sentence) => sentence.replace(/\s+/g, " ").trim());
  const paragraphSeeds = [
    `Die aktuelle Entwicklung rund um ${subject} rueckt ein Thema in den Mittelpunkt, das fuer die digitale Medienwirtschaft spuerbar an Bedeutung gewinnt. ${subline || facts[0]} Fuer Unternehmen aus TV, Streaming, Produktion, Vermarktung und Plattformbetrieb geht es dabei nicht nur um eine einzelne Meldung, sondern um die Frage, welche Folgen sich fuer Geschaeftsmodelle, Rechte, Nutzung und Sichtbarkeit digitaler Inhalte ergeben.`,
    `Im Kern beschreibt der vorliegende Informationsstand, dass ${facts[0].replace(/^[A-ZÄÖÜ][^a-zäöüß]{0,20}[:\-]\s*/, "")} Daraus entsteht ein Branchenbezug, weil solche Entwicklungen zunehmend entscheiden, wie Inhalte produziert, verbreitet, finanziert oder rechtlich eingeordnet werden. Besonders relevant ist, ob daraus neue Standards, neue Marktbewegungen oder veraenderte Erwartungen an Anbieter entstehen.`,
    facts[1]
      ? `Ein weiterer Aspekt ist ${facts[1].replace(/^[A-ZÄÖÜ][^a-zäöüß]{0,20}[:\-]\s*/, "")} Fuer Medienanbieter bedeutet das, Entwicklungen frueh einzuordnen und nicht nur auf technische Neuerungen zu schauen. Entscheidend ist, wie sich Reichweite, Nutzerfuehrung, Lizenzierung, redaktionelle Verantwortung oder wirtschaftliche Planbarkeit veraendern.`
      : `Fuer Medienanbieter bedeutet das, die Entwicklung nicht isoliert zu betrachten. Entscheidend ist, wie sich Reichweite, Nutzerfuehrung, Lizenzierung, redaktionelle Verantwortung oder wirtschaftliche Planbarkeit veraendern.`,
    facts[2]
      ? `Hinzu kommt: ${facts[2]} Diese Einordnung ist wichtig, weil digitale Medienmaerkte immer staerker von Plattformlogik, Daten, Automatisierung, Regulierung und neuen Nutzungsformen gepraegt werden. Was heute als einzelnes Thema erscheint, kann schnell Auswirkungen auf Produktionsprozesse, Rechteklaerung, Vermarktung oder die strategische Positionierung von Anbietern haben.`
      : `Die Einordnung ist wichtig, weil digitale Medienmaerkte immer staerker von Plattformlogik, Daten, Automatisierung, Regulierung und neuen Nutzungsformen gepraegt werden. Was heute als einzelnes Thema erscheint, kann schnell Auswirkungen auf Produktionsprozesse, Rechteklaerung, Vermarktung oder die strategische Positionierung von Anbietern haben.`,
    `Fuer die Branche bleibt damit vor allem die praktische Frage, wie Unternehmen auf ${tags[0] || "diese Entwicklung"} reagieren. Professionelle Anbieter muessen Chancen erkennen, Risiken sauber bewerten und ihre Angebote so weiterentwickeln, dass technische Innovation, rechtliche Sicherheit und publizistische Qualitaet zusammenpassen. Genau darin liegt die Relevanz des Themas fuer PROdigitalTV: Es verbindet Marktbeobachtung mit konkreter Orientierung fuer digitale Medienanbieter.`
  ];
  let body = paragraphSeeds.join("\n\n");
  for (const fact of facts.slice(3)) {
    if (localWordCount(body) >= minimumWords) break;
    body += `\n\nZusaetzlich zeigt der Quellenstand: ${fact} Auch dieser Punkt unterstreicht, dass die Entwicklung nicht nur eine Detailfrage ist, sondern Teil eines groesseren Wandels in der digitalen Medienwirtschaft.`;
  }
  while (localWordCount(body) < minimumWords) {
    body += `\n\nIn der weiteren Einordnung wird deutlich, dass ${tags[1] || tags[0] || "das Thema"} fuer Medienunternehmen vor allem dort relevant wird, wo strategische Entscheidungen, technische Entwicklung und wirtschaftliche Rahmenbedingungen zusammenkommen. Anbieter muessen nicht jede Entwicklung sofort uebernehmen, sollten aber verstehen, welche Erwartungen sich daraus fuer Partner, Publikum und Marktakteure ergeben.`;
    if (localWordCount(body) > minimumWords + 90) break;
  }
  return body;
}

function sourceTitleFromFile(source = {}, index = 0) {
  return source.name || source.fileName || source.title || `Quelle ${index + 1}`;
}

function localImportedNewsDraft(payload = {}) {
  const textSources = Array.isArray(payload.textSources) ? payload.textSources : [];
  const imageSources = Array.isArray(payload.imageSources) ? payload.imageSources : [];
  const targetWords = Math.max(300, Math.min(900, Number(payload.targetWords || payload.rules?.targetWords || 300)));
  const combinedText = compactSourceText([payload.sourceText, ...textSources.map((source) => source.text || source.content || "")].filter(Boolean).join("\n\n"), 14000);
  const lead = firstSentence(combinedText);
  const words = combinedText.split(/\s+/).filter((word) => word.length > 3);
  const titleSeed = lead || combinedText.slice(0, 140) || "Neue Entwicklung in der digitalen Medienwirtschaft";
  const headline = titleSeed
    .replace(/^Pressemitteilung[:\s-]*/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 92)
    .replace(/[,:;]\s*$/, "");
  const tags = singleWordKeywords(words, combinedText);
  const subline = lead && lead !== headline && textSimilarity(headline, lead) < 0.45 ? cleanSublineEnd(lead, 180) : complementarySubline(headline, combinedText);
  const body = reformulatedNewsBody({ headline, subline, combinedText, tags, targetWords });
  const sources = textSources.map((source, index) => ({
    title: sourceTitleFromFile(source, index),
    url: source.url || "",
    source_type: source.type || source.mimeType || "Textquelle"
  }));
  return {
    headline: headline || "Neue Entwicklung in der digitalen Medienwirtschaft",
    subline,
    body,
    sources,
    tags,
    category: tags.find((tag) => /ki|streaming|tv|werbung|medien|plattform/i.test(tag)) || "News",
    relevance_score: combinedText ? 65 : 25,
    relevance_reason: combinedText ? "Aus lokal bereitgestellten Textquellen abgeleitet." : "Es liegt noch zu wenig extrahierbarer Text vor.",
    thumbnail_idea: imageSources.length ? `Redaktionelles Vorschaubild auf Basis der gelieferten Bildquelle: ${imageSources[0].name || imageSources[0].fileName || "Bildquelle"}.` : "Redaktionelles Motiv zur digitalen Medienwirtschaft.",
    thumbnail_prompt: "Serioeses redaktionelles 16:9-Vorschaubild fuer PROdigitalTV, digitale Medienwirtschaft, sachlich, modern, keine erfundenen Logos, keine realen Personen identifizieren.",
    thumbnail_alt: headline || "News-Motiv",
    gallery_suggestions: imageSources.map((image) => ({
      file_name: image.name || image.fileName || "",
      caption: image.caption || image.name || "Redaktionelles Bildmotiv",
      alt_text: image.altText || image.name || "Redaktionelles Bildmotiv"
    })),
    editorial_note: "Lokaler Import-Fallback: Text und Bilddaten wurden ohne Live-GPT verarbeitet."
  };
}

export async function importNewsFromSources(payload = {}) {
  const firebase = await getFirebaseServices();
  if (firebase && !localPreviewMode()) {
    try {
      const callable = firebase.functionsLib.httpsCallable(firebase.functions, "importNewsFromSources", { timeout: 600000 });
      const result = await callable(payload);
      return result.data;
    } catch (error) {
      if (!["functions/not-found", "functions/unavailable", "functions/internal", "functions/deadline-exceeded"].includes(error?.code)) throw error;
    }
  }
  return {
    ok: true,
    localOnly: true,
    article: localImportedNewsDraft(payload),
    message: "Lokaler redaktioneller Vorschlag wurde aus den gelieferten Quellen vorbereitet."
  };
}

export async function importNewsUrlText(url = "") {
  const cleanUrl = String(url || "").trim();
  if (!cleanUrl) throw new Error("URL fehlt.");
  const firebase = await getFirebaseServices();
  if (!firebase || localPreviewMode()) {
    throw new Error("URL-Import braucht die serverseitige Firebase Function, damit der Webseiten-Text abgerufen werden kann.");
  }
  await ensureCallableLogin("URL-Import");
  const callable = firebase.functionsLib.httpsCallable(firebase.functions, "importNewsUrlText", { timeout: 60000 });
  const result = await callable({ url: cleanUrl });
  return result.data;
}

function rotateLocalSources(sources = [], existingSuggestions = [], category = "", keywords = "") {
  const seen = new Set();
  const usage = new Map();
  existingSuggestions.forEach((suggestion) => {
    localSuggestionSourceKeys(suggestion).forEach((key) => usage.set(key, (usage.get(key) || 0) + 1));
  });
  return sources
    .filter((source) => source && !seen.has(source.id || source.domain || source.name) && seen.add(source.id || source.domain || source.name))
    .filter((source) => !localSourceIsExcluded(source))
    .filter((source) => !normalizeSourceText(source.source_status || "").includes("gesperrt") && Number(source.trust_score || 0) >= 70)
    .map((source) => {
      const key = source.id || source.domain || source.name;
      const used = usage.get(key) || usage.get(source.name) || usage.get(source.domain) || 0;
      return {
        source,
        score: (localSourceMatches(source, category, keywords) ? 80 : 0) + Number(source.trust_score || 0) - used * 60 - Number(source.priority || 3)
      };
    })
    .sort((a, b) => b.score - a.score)
    .map(({ source }) => source);
}

function cleanAiEditorialSentence(value = "") {
  return String(value || "")
    .replace(/\b(redaktioneller Themenkandidat|Themenkandidat|Vorschlag|Quellenfund|redaktionell pruefen|redaktionell prÃ¼fen)\b/gi, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
}

function localEditorialArticleBody(topic = {}, sources = []) {
  const headline = String(topic.headline || topic.title || "Medienthema").replace(/^Themenvorschlag:\s*/i, "");
  const category = topic.category || "Medienbranche";
  const keyword = Array.isArray(topic.keywords) && topic.keywords.length ? topic.keywords[0] : category;
  const teaser = cleanAiEditorialSentence(topic.teaser || topic.reason || topic.subline || "");
  const sourceNames = sources.slice(0, 3).map((source) => source.publisher || source.title || source.name || source.domain).filter(Boolean);
  const sourceSentence = sourceNames.length
    ? `Vorhandene Quellenhinweise: ${sourceNames.join(", ")}.`
    : "Es ist noch keine belastbare Quellenbasis mit inhaltlichem Auszug hinterlegt.";
  return [
    "Quelleninhalt fehlt fuer fertigen Beitrag.",
    teaser || headline,
    `${sourceSentence} Dieser Text ist ein redaktioneller Arbeitsentwurf und kein veroeffentlichungsfaehiger Beitrag.`,
    `Fuer einen echten Beitrag zu ${category} muessen aus der Quelle konkret ermittelt werden: Was ist passiert, wer ist beteiligt, wann oder wo passiert es, welche Zahlen oder Entscheidungen sind belegt und welche Folge ergibt sich fuer ${keyword}?`,
    "Erst danach kann daraus ein journalistischer Lead, ein Faktenabsatz und eine belastbare Einordnung entstehen."
  ].join("\n\n");
}

async function runLocalAiEditorialTask(mode = "manual") {
  const { list, upsert } = await import("../firebase/dataService.js?v=487");
  const { verified_sources: demoSources, ai_prompts: demoPrompts } = await import("../data/demoData.js");
  const now = new Date().toISOString();
  let [articles, sources, prompts, queuedTopics] = await Promise.all([
    list("editorialContent"),
    list("verified_sources"),
    list("ai_prompts"),
    list("ai_topic_queue")
  ]);
  if (!sources.length) {
    await Promise.all(demoSources.map((source) => upsert("verified_sources", source)));
    sources = await list("verified_sources");
  }
  if (!prompts.length) {
    await Promise.all(demoPrompts.map((prompt) => upsert("ai_prompts", prompt)));
    prompts = await list("ai_prompts");
  }
  const requiredPromptTypes = ["Endpruefung", "Keywords"];
  const missingPrompts = requiredPromptTypes.filter((type) => !prompts.some((prompt) => prompt.is_active && prompt.prompt_type === type));
  if (missingPrompts.length) {
    await upsert("ai_editorial_logs", {
      id: `ai-editorial-log-${crypto.randomUUID()}`,
      article_id: "",
      task_name: "KI_Redaktion_Taeglicher_Beitrag",
      status: "blocked",
      message: `Abbruch: aktive Prompts fehlen (${missingPrompts.join(", ")}).`,
      found_topics_json: [],
      rejected_topics_json: [],
      used_sources_json: [],
      source_check_json: {},
      duplicate_check_json: {},
      keyword_result_json: {},
      ai_check_json: { status: "nicht bestanden", missingPrompts },
      error_json: {},
      created_at: now
    });
    return { ok: false, status: "blocked", message: "Aktive Pflicht-Prompts fehlen. Kein Beitrag wurde erzeugt." };
  }

  const trustedSources = sources
    .filter((source) => ["bevorzugt", "erlaubt"].includes(source.source_status) && Number(source.trust_score || 0) >= 70)
    .slice(0, 3);
  const queueTopic = queuedTopics
    .filter((topic) => !["erledigt", "abgelehnt"].includes(topic.status))
    .sort((a, b) => Number(b.actuality_score || 0) - Number(a.actuality_score || 0))[0];
  const topicPool = queueTopic ? [{
    ...queueTopic,
    key: queueTopic.topic_key || queueTopic.key || queueTopic.id,
    thumbnailIdea: queueTopic.thumbnailIdea || queueTopic.thumbnail_idea || "Redaktionelles Medienbranchen-Motiv mit klarer Themenvisualisierung."
  }] : LOCAL_TOPIC_POOL;
  const isManualEditorialArticle = (article) => article.author_type !== "ai" && article.authorType !== "ai" && article.aiGenerated !== true;
  const articleSearchText = (article) => `${article.title || ""} ${article.headline || ""} ${article.category || ""} ${(article.tags || []).join(" ")}`.toLowerCase();
  const topicParts = (candidate) => candidate.key.split("-").filter(Boolean);
  const topicCoveredByArticle = (candidate, article) => {
    const text = articleSearchText(article);
    const parts = topicParts(candidate);
    const overlap = parts.filter((part) => text.includes(part)).length;
    return text.includes(candidate.key.replace(/-/g, " ")) || overlap >= Math.min(2, parts.length);
  };
  const topic = topicPool.find((candidate) => !articles.some((article) => topicCoveredByArticle(candidate, article)))
    || topicPool[(articles.filter((article) => article.author_type === "ai" || article.aiGenerated).length) % topicPool.length];
  const duplicate = articles.find((article) => topicCoveredByArticle(topic, article));
  if (trustedSources.length < 1) {
    await upsert("ai_editorial_logs", {
      id: `ai-editorial-log-${crypto.randomUUID()}`,
      article_id: "",
      task_name: "KI_Redaktion_Taeglicher_Beitrag",
      status: "blocked",
      message: "Keine valide Quelle vorhanden - redaktionelle Pruefung erforderlich.",
      found_topics_json: [topic],
      rejected_topics_json: [{ ...topic, reason: "keine valide Quelle" }],
      used_sources_json: trustedSources,
      source_check_json: { source_status: "unzureichend", trustedSources: trustedSources.length, required: 1 },
      duplicate_check_json: duplicate ? { duplicate_status: "Hinweis", duplicateArticleId: duplicate.id } : {},
      keyword_result_json: {},
      ai_check_json: { status: "nicht bestanden", blockers: ["insufficient_sources"] },
      error_json: {},
      created_at: now
    });
    return { ok: false, status: "blocked", message: "Keine valide Quelle vorhanden - kein Beitrag wurde erzeugt." };
  }

  const articleId = `ai-article-${crypto.randomUUID()}`;
  const sourceSnapshot = trustedSources.map((source) => ({
    title: source.name,
    publisher: source.name,
    domain: source.domain,
    url: source.url,
    source_type: source.source_type,
    trust_score: source.trust_score,
    check_status: "geprueft"
  }));
  await upsert("editorialContent", {
    id: articleId,
    title: topic.headline,
    headline: topic.headline,
    subtitle: topic.subline,
    subline: topic.subline,
    bodyText: localEditorialArticleBody(topic, sourceSnapshot),
    page: "news",
    section: "news",
    category: topic.category,
    tags: topic.keywords,
    primary_keyword: topic.keywords[0],
    keyword_json: topic.keywords.map((keyword, index) => ({ keyword, relevance_score: index === 0 ? 92 : 72 })),
    thumbnail_idea: topic.thumbnailIdea,
    thumbnail_prompt: `Fotorealistisches redaktionelles Vorschaubild fuer ein Medienbranchen-Portal: ${topic.thumbnailIdea}, serioeser moderner Business-Look, natuerliches Licht, 16:9, keine Logos, keine realen Personen, keine Comic-Optik.`,
    source_status: "geprueft",
    duplicate_status: duplicate ? "Hinweis: aehnliches Thema vorhanden" : "nicht blockierend",
    ai_check_status: "Warnung",
    legal_check_status: "offen",
    publication_status: "pruefpflichtig",
    status: "draft",
    visibility: "internal",
    relevance_score: 78,
    author_type: "ai",
    author_name: "KI-Redaktion",
    generation_origin: "demo_topic_pool",
    research_mode: "local_demo",
    source_snapshot_json: sourceSnapshot,
    ai_log_json: {
      mode,
      localPreview: true,
      origin: "demo_topic_pool",
      research_mode: "local_demo",
      note: "Lokale Vorschau: Themen stammen aus einem festen Demo-Pool, nicht aus Live-Recherche."
    },
    duplicate_check_json: duplicate ? { duplicate_status: "Hinweis", duplicateArticleId: duplicate.id } : { duplicate_status: "nicht blockierend" },
    final_check_json: { status: "Warnung", blockers: ["claim_level_source_mapping_required", "manual_review_required"] },
    createdAt: now,
    updatedAt: now
  });
  if (queueTopic?.id) {
    await upsert("ai_topic_queue", {
      ...queueTopic,
      status: "erledigt",
      article_id: articleId,
      updated_at: now
    });
  }

  for (const source of sourceSnapshot) {
    await upsert("article_sources", {
      id: `article-source-${crypto.randomUUID()}`,
      article_id: articleId,
      title: source.title,
      publisher: source.publisher,
      domain: source.domain,
      url: source.url,
      source_type: source.source_type,
      published_at: "",
      accessed_at: now,
      relevance_note: "Verifizierte Quelle fuer redaktionelle Pruefung.",
      claim_reference: "Noch keine finale zentrale Aussage erzeugt.",
      trust_score: source.trust_score,
      check_status: "geprueft",
      created_at: now,
      updated_at: now
    });
  }
  for (const [index, keyword] of topic.keywords.entries()) {
    await upsert("article_keywords", {
      id: `article-keyword-${crypto.randomUUID()}`,
      article_id: articleId,
      keyword,
      keyword_type: index === 0 ? "Hauptkeyword" : "Branchenkeyword",
      relevance_score: index === 0 ? 92 : 72,
      is_primary: index === 0,
      explanation: "Aus lokalem Themenvorschlag abgeleitet; vor Veroeffentlichung pruefen.",
      ai_generated: true,
      manually_confirmed: false,
      created_at: now,
      updated_at: now
    });
  }
  await upsert("ai_editorial_logs", {
    id: `ai-editorial-log-${crypto.randomUUID()}`,
    article_id: articleId,
    task_name: "KI_Redaktion_Taeglicher_Beitrag",
    status: "warning",
    message: "Lokaler sicherer Themenvorschlag erstellt. Keine automatische Veroeffentlichung.",
    found_topics_json: [topic],
    rejected_topics_json: [],
    used_sources_json: sourceSnapshot,
    source_check_json: { source_status: "geprueft", trustedSources: sourceSnapshot.length },
    duplicate_check_json: { duplicate_status: "neu" },
    keyword_result_json: topic.keywords,
    ai_check_json: { status: "Warnung", publication_status: "pruefpflichtig" },
    error_json: {},
    created_at: now
  });

  return {
    ok: true,
    status: "warning",
    articleId,
    localPreview: true,
    origin: "demo_topic_pool",
    message: "Demo-Beitrag aus lokalem Themenpool wurde erstellt und als pruefpflichtig gespeichert. Keine Live-Recherche."
  };
}

export async function saveAiEditorialSettings(settings = {}) {
  if (localPreviewMode()) {
    return { saved: true, settings, localOnly: true };
  }
  const firebase = await getFirebaseServices();
  if (!firebase) {
    return { saved: true, settings, localOnly: true };
  }
  const callable = firebase.functionsLib.httpsCallable(firebase.functions, "saveAiEditorialSettings");
  const result = await callable(settings);
  return result.data;
}

export async function generateAiEditorialThumbnail(article = {}) {
  const firebase = await getFirebaseServices();
  if (!firebase || localPreviewMode()) return null;
  const prompt = article.thumbnail_prompt || article.thumbnailPrompt || [
    DEFAULT_AI_EDITORIAL_THUMBNAIL_PROMPT,
    "Professionelles redaktionelles Vorschaubild fuer ein Medienbranchen-Portal.",
    "Stil: fotorealistisch, serioes, modern, TV-, Streaming- und Digitalbranche, 16:9.",
    "Keine echten Logos, keine realen Personen, keine irrefuehrenden Bildinhalte.",
    article.headline || article.title || "",
    article.category || ""
  ].filter(Boolean).join(" ");
  const callable = firebase.functionsLib.httpsCallable(firebase.functions, "generateCmsThumbCollage");
  const result = await callable({
    entityType: "aiEditorialArticle",
    entityId: article.id || "",
    prompt,
    context: {
      title: article.headline || article.title || "",
      subtitle: article.subline || article.subtitle || "",
      bodyText: article.bodyText || article.body || "",
      category: article.category || ""
    },
    size: "1536x1024",
    quality: "medium"
  });
  return result.data;
}

function localThumbSvg(payload = {}) {
  const context = payload.context || {};
  const title = String(context.title || "PROdigitalTV").replace(/[<&>]/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1536 1024"><rect width="1536" height="1024" fill="#071a33"/><path d="M0 718c247-152 432-132 668-40s392 66 868-118v464H0z" fill="#123b72"/><circle cx="1190" cy="238" r="142" fill="#e30613"/><g fill="none" stroke="#fff" stroke-width="28" opacity=".88"><path d="M245 280h470v270H245z"/><path d="M335 635h290M480 550v85"/><path d="M890 365h245M890 455h190M890 545h285"/></g><text x="96" y="910" fill="#fff" font-family="Arial, sans-serif" font-size="52" font-weight="700">${title.slice(0, 42)}</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

export async function generateCmsThumbCollage(payload = {}) {
  const firebase = await getFirebaseServices();
  if (!firebase) {
    return {
      imageDataUrl: localThumbSvg(payload),
      mimeType: "image/svg+xml",
      fileName: `${payload.entityId || "cms-thumb"}-ki-collage.svg`,
      prompt: payload.prompt || "Lokale Vorschau-Collage. Fuer echte KI bitte Firebase Function mit OPENAI_API_KEY nutzen."
    };
  }
  try {
    const callable = firebase.functionsLib.httpsCallable(firebase.functions, "generateCmsThumbCollage");
    const result = await callable(payload);
    return result.data;
  } catch (error) {
    if (["functions/not-found", "functions/unavailable", "functions/internal", "functions/deadline-exceeded"].includes(error?.code)) {
      return {
        imageDataUrl: localThumbSvg(payload),
        mimeType: "image/svg+xml",
        fileName: `${payload.entityId || "cms-thumb"}-ki-collage.svg`,
        prompt: payload.prompt || "Lokale Vorschau-Collage. Die Firebase Function ist nicht erreichbar."
      };
    }
    throw error;
  }
}

export function improveCmsText(payload) {
  return callChatGptAction(payload.action || "improveText", payload);
}

export function generateSeo(payload) {
  return callChatGptAction("generateSeoMeta", payload);
}

export function generateEventText(payload) {
  return callChatGptAction(payload.action || "generateEventDescription", payload);
}

export function generateTopicText(payload) {
  return callChatGptAction(payload.action || "generateTopicDescription", payload);
}

export function generateSpeakerText(payload) {
  return callChatGptAction("generateSpeakerTalkText", payload);
}

export function generateSponsorText(payload) {
  return callChatGptAction("generateSponsorText", payload);
}

export function generateMailText(payload) {
  return callChatGptAction("generateRegistrationMailText", payload);
}

export function generatePostEventText(payload) {
  return callChatGptAction(payload.action || "generateEventSummary", payload);
}

export function generateAltTexts(payload) {
  return callChatGptAction("generateImageAltText", payload);
}

export function analyzePipelineQuality(payload) {
  return callChatGptAction("analyzeEventPipelineQuality", payload);
}

export async function saveAiDraft({ entityType, entityId, fieldName, originalText, suggestedText, action, status = "suggested" }) {
  const user = currentUser();
  return upsert("aiDrafts", {
    id: `aiDrafts-${crypto.randomUUID()}`,
    userId: user?.uid || "",
    entityType,
    entityId,
    fieldName,
    originalText,
    suggestedText,
    action,
    status,
    createdAt: new Date().toISOString()
  });
}
