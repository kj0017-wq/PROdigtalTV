import { getFirebaseServices } from "../firebase/firebaseClient.js";
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
