import { formatDateTime, slugify } from "./format.js";

const columns = [
  ["eventId", "Event-ID"], ["eventTitle", "Event-Titel"], ["eventDate", "Event-Datum"],
  ["firstName", "Vorname"], ["lastName", "Nachname"], ["company", "Unternehmen"],
  ["position", "Position"], ["email", "E-Mail"], ["phone", "Telefon"], ["isMember", "Mitglied ja/nein"],
  ["invitationCode", "Einladungscode"], ["message", "Nachricht"], ["privacyAccepted", "Datenschutz akzeptiert"],
  ["photoVideoConsent", "Foto-/Videoeinwilligung"], ["newsletterConsent", "Newsletter-Einwilligung"],
  ["status", "Anmeldestatus"], ["emailConfirmed", "E-Mail bestaetigt ja/nein"], ["confirmedAt", "Bestaetigungsdatum"],
  ["mailStatus", "Mailstatus"], ["createdAt", "Anmeldedatum"], ["updatedAt", "Letzte Aenderung"], ["internalNote", "Interne Notiz"]
];

function printable(key, value) {
  if (["createdAt", "updatedAt", "confirmedAt"].includes(key)) return formatDateTime(value);
  if (typeof value === "boolean") return value ? "ja" : "nein";
  return value || "";
}

function csvCell(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export function registrationsCsv(event, registrations) {
  const rows = registrations.map((registration) => columns.map(([key]) => csvCell(printable(key, registration[key]))).join(";"));
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
