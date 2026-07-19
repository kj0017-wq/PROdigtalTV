export const accessLabels = {
  public: "Fuer alle Interessierten",
  members_only: "Nur fuer Mitglieder",
  invitation_only: "Nur mit Einladung"
};

export const lifecycleLabels = {
  planning: "Planung",
  invitation: "Einladung",
  registration_open: "Anmeldung geoeffnet",
  registration_closed: "Anmeldung geschlossen",
  event_day: "Durchfuehrung",
  post_processing: "Nacharbeit",
  archive_published: "Im Archiv veroeffentlicht",
  archived: "Archiviert"
};

export const settings = [
  { id: "accessTypes", key: "accessTypes", group: "events", value: ["public", "members_only", "invitation_only"], description: "Zugangsarten fuer Events" },
  { id: "eventTypes", key: "eventTypes", group: "events", value: ["Fachgespraech", "Konferenz", "Medienfruehstueck", "Mitgliederveranstaltung", "Netzwerkveranstaltung", "Panel", "Roundtable", "Summit", "Webinar", "Workshop"], description: "Eventtypen fuer CMS-Auswahl" },
  { id: "lifecyclePhases", key: "lifecyclePhases", group: "events", value: Object.keys(lifecycleLabels), description: "Lebenszyklus von Events" },
  { id: "registrationStatuses", key: "registrationStatuses", group: "registrations", value: ["pending_email_confirmation", "confirmed", "waitlist", "cancelled", "attended", "no_show", "expired"], description: "Status einer Anmeldung" },
  { id: "roles", key: "roles", group: "authorization", value: ["admin", "editor", "member", "guest"], description: "Systemrollen" }
];
