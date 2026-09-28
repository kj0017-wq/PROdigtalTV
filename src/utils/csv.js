import { formatDateTime, slugify } from "./format.js";
import { registrationParticipants } from "./registrationParticipants.js";

const columns = [
  ["eventId", "Event-ID"], ["eventTitle", "Event-Titel"], ["eventDate", "Event-Datum"],
  ["participantRole", "Teilnehmerart"], ["bookingEmail", "Buchung durch"],
  ["firstName", "Vorname"], ["lastName", "Nachname"], ["company", "Unternehmen"],
  ["position", "Position"], ["email", "E-Mail"], ["phone", "Telefon"], ["isMember", "Mitglied ja/nein"],
  ["invitationCode", "Einladungscode"], ["message", "Nachricht"], ["privacyAccepted", "Datenschutz akzeptiert"],
  ["photoVideoConsent", "Foto-/Videoeinwilligung"], ["newsletterConsent", "Newsletter-Einwilligung"],
  ["status", "Anmeldestatus"], ["emailConfirmed", "E-Mail bestaetigt ja/nein"], ["confirmedAt", "Bestaetigungsdatum"],
  ["mailStatus", "Mailstatus"], ["createdIp", "IP-Adresse"], ["createdUserAgent", "Browser/Geraet"],
  ["createdAt", "Anmeldedatum"], ["updatedAt", "Letzte Aenderung"], ["internalNote", "Interne Notiz"]
];

function printable(key, value) {
  if (["createdAt", "updatedAt", "confirmedAt"].includes(key)) return formatDateTime(value);
  if (typeof value === "boolean") return value ? "ja" : "nein";
  return value || "";
}

function csvCell(value, { forceText = false } = {}) {
  const text = String(value ?? "");
  const serialized = forceText && text ? `="${text.replaceAll('"', '""')}"` : text;
  return `"${serialized.replaceAll('"', '""')}"`;
}

export function registrationsCsv(event, registrations) {
  const rows = registrationParticipants(registrations).map((registration) => columns.map(([key]) => csvCell(printable(key, registration[key]), { forceText: key === "phone" })).join(";"));
  return `\uFEFF${columns.map(([, label]) => csvCell(label)).join(";")}\r\n${rows.join("\r\n")}`;
}

export function downloadRegistrationsCsv(event, registrations) {
  const content = registrationsCsv(event, registrations);
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `prodigitaltv_anmeldungen_${slugify(event.title)}_${event.date}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

const feedbackColumns = [
  ["eventTitle", "Event"], ["eventDate", "Datum"], ["guestName", "Gast"], ["guestEmail", "E-Mail"], ["guestCompany", "Unternehmen"],
  ["followUpStatus", "Follow-up"], ["manualStatus", "Bearbeitungsstatus"], ["contactConsent", "Kontakt erlaubt"], ["submittedAt", "Eingereicht"],
  ["relevance", "Relevanz"], ["relevanceComment", "Kommentar Relevanz"], ["benefit", "Nutzen"], ["benefitComment", "Kommentar Nutzen"],
  ["industry_fit", "Branchenbezug"], ["industryFitComment", "Kommentar Branchenbezug"], ["attend_again", "Weitere Teilnahme"], ["attendAgainComment", "Kommentar Teilnahme"],
  ["membership_interest", "Mitgliedschaft"], ["membershipComment", "Kommentar Mitgliedschaft"]
];

function feedbackPrintable(feedback = {}, eventsById = new Map(), key = "") {
  const event = eventsById.get(feedback.eventId) || {};
  if (key === "eventTitle") return event.title || feedback.eventTitle || feedback.eventId || "";
  if (key === "eventDate") return event.date || feedback.eventDate || "";
  if (key === "submittedAt") return formatDateTime(feedback.submittedAt);
  if (key === "relevance") return feedback.answers?.relevance || "";
  if (key === "benefit") return Array.isArray(feedback.answers?.benefit) ? feedback.answers.benefit.join(", ") : feedback.answers?.benefit || "";
  if (key === "industry_fit") return feedback.answers?.industry_fit || "";
  if (key === "attend_again") return feedback.answers?.attend_again || "";
  if (key === "membership_interest") return feedback.answers?.membership_interest || "";
  if (key === "relevanceComment") return feedback.comments?.relevance || "";
  if (key === "benefitComment") return feedback.comments?.benefit || "";
  if (key === "industryFitComment") return feedback.comments?.industry_fit || "";
  if (key === "attendAgainComment") return feedback.comments?.attend_again || "";
  if (key === "membershipComment") return feedback.comments?.membership_interest || "";
  return feedback[key] || "";
}

export function feedbackCsv(events = [], feedbackRecords = []) {
  const eventsById = new Map(events.map((event) => [event.id, event]));
  const rows = feedbackRecords.map((feedback) => feedbackColumns.map(([key]) => csvCell(feedbackPrintable(feedback, eventsById, key))).join(";"));
  return `\uFEFF${feedbackColumns.map(([, label]) => csvCell(label)).join(";")}\r\n${rows.join("\r\n")}`;
}

export function downloadFeedbackCsv(events = [], feedbackRecords = [], suffix = "feedback") {
  const content = feedbackCsv(events, feedbackRecords);
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `prodigitaltv_event_feedback_${slugify(suffix || "feedback")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
