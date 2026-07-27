export const accessLabels = {
  public: "Fuer alle Interessierten",
  members_only: "Nur fuer Mitglieder",
  invitation_only: "Nur mit Einladung"
};

export const lifecycleLabels = {
  planning: "In Vorbereitung",
  registration_open: "Geöffnet",
  registration_closed: "Geschlossen",
  archived: "Beendet"
};

const lifecycleAliases = {
  planning: "planning",
  planung: "planning",
  invitation: "planning",
  einladung: "planning",
  registration_open: "registration_open",
  anmeldung_geoeffnet: "registration_open",
  "anmeldung geoeffnet": "registration_open",
  "anmeldung geöffnet": "registration_open",
  geoeffnet: "registration_open",
  geöffnet: "registration_open",
  open: "registration_open",
  offen: "registration_open",
  registration_closed: "registration_closed",
  anmeldung_geschlossen: "registration_closed",
  "anmeldung geschlossen": "registration_closed",
  geschlossen: "registration_closed",
  closed: "registration_closed",
  event_day: "archived",
  durchfuehrung: "archived",
  durchführung: "archived",
  post_processing: "archived",
  nacharbeit: "archived",
  archive_published: "archived",
  "im archiv veroeffentlicht": "archived",
  "im archiv veröffentlicht": "archived",
  archived: "archived",
  archiviert: "archived",
  beendet: "archived"
};

export function normalizeLifecyclePhase(value = "planning") {
  const key = String(value || "planning")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_")
    .replace(/\s+/g, " ");
  return lifecycleAliases[key] || lifecycleAliases[key.replace(/\s+/g, "_")] || "planning";
}

export const settings = [
  { id: "accessTypes", key: "accessTypes", group: "events", value: ["public", "members_only", "invitation_only"], description: "Zugangsarten fuer Events" },
  { id: "eventTypes", key: "eventTypes", group: "events", value: ["Fachgespraech", "Konferenz", "Medienfruehstueck", "Mitgliederveranstaltung", "Netzwerkveranstaltung", "Panel", "Roundtable", "Summit", "Webinar", "Workshop"], description: "Eventtypen fuer CMS-Auswahl" },
  { id: "lifecyclePhases", key: "lifecyclePhases", group: "events", value: Object.keys(lifecycleLabels), description: "Lebenszyklus von Events" },
  { id: "registrationStatuses", key: "registrationStatuses", group: "registrations", value: ["pending_email_confirmation", "confirmed", "waitlist", "cancelled", "attended", "no_show", "expired"], description: "Status einer Anmeldung" },
  { id: "roles", key: "roles", group: "authorization", value: ["admin", "editor", "member", "guest"], description: "Systemrollen" }
];
