import { getFirebaseServices, localPreviewMode } from "../firebase/firebaseClient.js";
import { currentUser } from "../firebase/authService.js";
import { upsert } from "../firebase/dataService.js";

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
  analyzeEventPipelineQuality: "analyzeEventPipelineQuality"
};

const DEFAULT_AI_EDITORIAL_THUMBNAIL_PROMPT = "Fotorealistisches redaktionelles 16:9-Vorschaubild fuer PROdigitalTV: serioeser moderner Business-Look, TV-, Streaming- und digitale Medienbranche, klare Komposition, natuerliches Licht, keine echten Logos, keine realen Personen, keine Comic-Optik, keine irrefuehrenden Bildinhalte.";

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
  return {
    action,
    suggestedText: text
      ? `${text}\n\nRedaktioneller KI-Vorschlag: Bitte sachlich pruefen, fehlende Fakten ergaenzen und erst danach uebernehmen.`
      : "Redaktioneller KI-Vorschlag: Bitte Eventtitel, Datum, Themen und Stichpunkte ergaenzen. Ohne belastbare Informationen werden keine Fakten erfunden.",
    structured: null,
    status: "suggested"
  };
}

export async function callChatGptAction(action, payload = {}) {
  const functionName = ACTION_FUNCTIONS[action] || action;
  const firebase = await getFirebaseServices();
  if (!firebase) return localSuggestion(action, payload);
  const callable = firebase.functionsLib.httpsCallable(firebase.functions, functionName);
  const result = await callable(payload);
  return result.data;
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
  const callable = firebase.functionsLib.httpsCallable(firebase.functions, "runAiEditorialTask");
  try {
    const result = await callable({ mode });
    return result.data;
  } catch (error) {
    if (["functions/not-found", "functions/unavailable", "functions/internal"].includes(error.code)) {
      return {
        ok: false,
        status: "blocked",
        message: "KI-Redaktion ist im CMS eingebunden, aber die Cloud Function ist noch nicht deployt oder erreichbar. Es wurde kein Beitrag erzeugt.",
        publicationStatus: "gesperrt wegen Quellenlage"
      };
    }
    throw error;
  }
}

async function runLocalAiEditorialTask(mode = "manual") {
  const { list, upsert } = await import("../firebase/dataService.js");
  const now = new Date().toISOString();
  const [articles, sources, prompts] = await Promise.all([
    list("editorialContent"),
    list("verified_sources"),
    list("ai_prompts")
  ]);
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
  const topicPool = [
    {
      key: "barrierefreiheit-streaming",
      title: "Barrierefreiheit in Streaming-Angeboten",
      headline: "Barrierefreiheit wird fuer Streaming-Anbieter wichtiger",
      subline: "Accessibility wird zum festen Bestandteil digitaler Medienangebote.",
      category: "Barrierefreiheit",
      keywords: ["Barrierefreiheit", "Streaming", "Untertitel", "Plattformregulierung", "Medienrecht"],
      thumbnailIdea: "Streaming-Oberflaeche mit Untertitel-Symbolen und klarer Accessibility-Anmutung."
    },
    {
      key: "hbbtv-smart-tv",
      title: "HbbTV und Smart-TV-Strategien",
      headline: "HbbTV bleibt wichtig fuer Smart-TV-Strategien",
      subline: "Offene TV-Standards helfen Sendern bei Reichweite und Nutzerfuehrung.",
      category: "HbbTV / Smart-TV",
      keywords: ["HbbTV", "Smart-TV", "Distribution", "TV-Apps", "Streaming-Technologie"],
      thumbnailIdea: "Moderner Smart-TV mit App-Oberflaeche, HbbTV-Signal und klarer Medienplattform-Aesthetik."
    },
    {
      key: "ki-redaktion-produktion",
      title: "KI in Redaktion und Produktion",
      headline: "KI veraendert redaktionelle Produktionsprozesse",
      subline: "Automatisierung braucht klare Kontrolle, Quellen und Verantwortlichkeit.",
      category: "KI / Produktion",
      keywords: ["KI", "Redaktion", "Produktion", "Automatisierung", "Quellenpruefung"],
      thumbnailIdea: "Redaktioneller Arbeitsplatz mit abstrakter KI-Assistenz, Datenlinien und Medienmonitoren."
    },
    {
      key: "fast-channel-distribution",
      title: "FAST-Channels und digitale Distribution",
      headline: "FAST-Channels erweitern die digitale Distribution",
      subline: "Lineare Streaming-Kanaele schaffen neue Chancen fuer Reichweite und Vermarktung.",
      category: "Distribution / FAST-Channels",
      keywords: ["FAST-Channels", "Distribution", "OTT", "Streaming", "Vermarktung"],
      thumbnailIdea: "Mehrere lineare Streaming-Kanaele auf einem modernen Dashboard, serioeser Business-Look."
    },
    {
      key: "musikrechte-streaming",
      title: "Musikrechte in digitalen Medienangeboten",
      headline: "Musikrechte bleiben zentral fuer digitale Medienangebote",
      subline: "Rechteklaerung ist Voraussetzung fuer sichere Auswertung und Distribution.",
      category: "Musikrechte / Verwertungsrecht",
      keywords: ["Musikrechte", "GEMA", "Verwertungsrecht", "Rechteklaerung", "Streaming"],
      thumbnailIdea: "Abstrakte Verbindung von Audiowellen, Medienplayer und rechtlicher Dokumentation."
    }
  ];
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
  if (duplicate) {
    const manualDuplicate = isManualEditorialArticle(duplicate);
    await upsert("ai_editorial_logs", {
      id: `ai-editorial-log-${crypto.randomUUID()}`,
      article_id: duplicate.id,
      task_name: "KI_Redaktion_Taeglicher_Beitrag",
      status: "blocked",
      message: manualDuplicate ? "Manueller Beitrag hat Vorrang - kein KI-Beitrag erzeugt." : "Thema bereits vorhanden - kein neuer Beitrag erzeugt.",
      found_topics_json: [topic],
      rejected_topics_json: [{ ...topic, reason: manualDuplicate ? "manueller Beitrag hat Vorrang" : "Dublette" }],
      used_sources_json: trustedSources,
      source_check_json: { source_status: trustedSources.length >= 2 ? "geprueft" : "unzureichend" },
      duplicate_check_json: { duplicate_status: "Dublette", duplicateArticleId: duplicate.id },
      keyword_result_json: {},
      ai_check_json: { status: "nicht bestanden" },
      error_json: {},
      created_at: now
    });
    return { ok: false, status: "blocked", message: manualDuplicate ? "Manueller Beitrag hat Vorrang - kein KI-Beitrag erzeugt." : "Thema bereits vorhanden - kein neuer Beitrag erzeugt." };
  }

  if (trustedSources.length < 2) {
    await upsert("ai_editorial_logs", {
      id: `ai-editorial-log-${crypto.randomUUID()}`,
      article_id: "",
      task_name: "KI_Redaktion_Taeglicher_Beitrag",
      status: "blocked",
      message: "Quellenlage unzureichend - redaktionelle Pruefung erforderlich.",
      found_topics_json: [topic],
      rejected_topics_json: [{ ...topic, reason: "zu wenige gepruefte Quellen" }],
      used_sources_json: trustedSources,
      source_check_json: { source_status: "unzureichend", trustedSources: trustedSources.length, required: 2 },
      duplicate_check_json: { duplicate_status: "neu" },
      keyword_result_json: {},
      ai_check_json: { status: "nicht bestanden", blockers: ["insufficient_sources"] },
      error_json: {},
      created_at: now
    });
    return { ok: false, status: "blocked", message: "Quellenlage unzureichend - kein Beitrag wurde erzeugt." };
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
    bodyText: `${topic.headline}. Dieser Entwurf markiert, welche Punkte die Redaktion anhand der hinterlegten Quellen pruefen sollte. Zentrale Aussagen muessen vor der Veroeffentlichung mit konkreten Belegstellen abgeglichen werden.`,
    page: "news",
    section: "news",
    category: topic.category,
    tags: topic.keywords,
    primary_keyword: topic.keywords[0],
    keyword_json: topic.keywords.map((keyword, index) => ({ keyword, relevance_score: index === 0 ? 92 : 72 })),
    thumbnail_idea: topic.thumbnailIdea,
    thumbnail_prompt: `Fotorealistisches redaktionelles Vorschaubild fuer ein Medienbranchen-Portal: ${topic.thumbnailIdea}, serioeser moderner Business-Look, natuerliches Licht, 16:9, keine Logos, keine realen Personen, keine Comic-Optik.`,
    source_status: "geprueft",
    duplicate_status: "neu",
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
    duplicate_check_json: { duplicate_status: "neu" },
    final_check_json: { status: "Warnung", blockers: ["claim_level_source_mapping_required", "manual_review_required"] },
    createdAt: now,
    updatedAt: now
  });

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
  const callable = firebase.functionsLib.httpsCallable(firebase.functions, "generateCmsThumbCollage");
  const result = await callable(payload);
  return result.data;
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
