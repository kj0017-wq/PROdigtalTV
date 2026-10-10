// Central help for CMS controls, including controls inserted by dialogs.
const selector = 'button, [role="button"], a.button, a.icon-button, summary, input[type="submit"], input[type="button"], input[type="reset"]';
const generatedTitles = new WeakMap();
let observer;

const actionHelp = {
  "data-print-name-badges": "Namensetiketten für ausgewählte Personen als Avery L4785-20 vorbereiten.",
  "data-prepare-guest-accounts": "Eventzugänge anlegen oder zuordnen; dabei wird noch keine E-Mail versendet.",
  "data-export-event": "Die Anmeldungen dieses Events als CSV-Datei herunterladen.",
  "data-checkin-selected-registrations": "Die ausgewählten Personen für dieses Event einchecken.",
  "data-delete-selected-registrations": "Die ausgewählten Anmeldungen aus diesem Event löschen.",
  "data-edit-registration": "Die Daten dieser Anmeldung öffnen und korrigieren.",
  "data-delete-registration": "Diese Anmeldung aus dem Event löschen.",
  "data-event-group-checkin": "Die ausgewählten Personen zentral einchecken; die Welcome-Mail wird etwa 15 Minuten vor Eventbeginn eingeplant.",
  "data-moderation-cards": "Moderationskarten aus dem Ablauf erstellen, bearbeiten und drucken.",
  "data-add-event-schedule-row": "Einen neuen Programmpunkt zum Ablauf hinzufügen.",
  "data-delete-event": "Dieses Event löschen.",
  "data-delete-record": "Diesen Datensatz löschen.",
  "data-cms-bulk-delete": "Die ausgewählten Datensätze löschen.",
  "data-cms-bulk-hide": "Die ausgewählten Inhalte ausblenden.",
  "data-cms-bulk-show": "Die ausgewählten Inhalte sichtbar schalten.",
  "data-cms-chat-reset": "Die Chatnachrichten dieses Events verwalten und löschen.",
  "data-image-remove": "Das ausgewählte Bild aus dieser Zuordnung entfernen.",
  "data-clear-member-logo": "Das hinterlegte Firmenlogo entfernen.",
  "data-clear-linked-media": "Die Verknüpfung mit dem Medium entfernen.",
  "data-copy-talk-to-topic": "Den Vortrag als Thema übernehmen.",
  "data-create-event-retrospective": "Einen Rückblick zu dieser Veranstaltung erstellen.",
};
const labelHelp = [
  [/^speichern|änderungen speichern/i, "Die bearbeiteten Daten speichern."],
  [/^abbrechen$/i, "Das Fenster ohne Übernahme der Änderungen schließen."],
  [/^schließen$/i, "Dieses Fenster schließen."],
  [/^drucken$/i, "Die Druckvorschau des Browsers öffnen."],
  [/pdf/i, "Die Druckausgabe als PDF vorbereiten."],
  [/ki.*(?:text|sachlich)|(?:text|sachlich).*ki/i, "Die Texte mit KI kurz und sachlich überarbeiten und die Rechtschreibung korrigieren."],
  [/vortr[aä]ge.*übernehmen|vortraege.*uebernehmen/i, "Die hinterlegten Vorträge und Referenten in den Ablauf übernehmen."],
  [/startpasswort.*(?:prüfen|senden)/i, "Den Passwortstatus prüfen und bei Bedarf ein Startpasswort versenden."],
  [/^personen auswählen/i, "Die Personen für den Gruppen-Check-in auswählen."],
  [/^person hinzufügen/i, "Die eingegebenen Personendaten zur Eventanmeldung hinzufügen."],
  [/^(?:alle|alles) auswählen/i, "Alle Einträge dieser Liste auswählen."],
  [/auswahl aufheben/i, "Die Auswahl der Einträge zurücksetzen."],
  [/^bearbeiten$/i, "Den Eintrag zur Bearbeitung öffnen."],
  [/^löschen$|^entfernen$/i, "Diesen Eintrag entfernen."],
  [/^vorschau/i, "Eine Vorschau des Inhalts öffnen."],
  [/^aktualisieren$|^neu laden$/i, "Die aktuellen Daten erneut laden."],
  [/^suchen$/i, "Die Liste nach den eingegebenen Suchbegriffen durchsuchen."],
  [/^zurück$/i, "Zur vorherigen Ansicht zurückkehren."],
  [/^zugang anlegen$/i, "Ein neues Benutzerkonto mit den eingegebenen Zugangsdaten anlegen."],
  [/^abmelden$|^logout$/i, "Die aktuelle Anmeldung beenden."],
  [/hinzufügen/i, "Einen neuen Eintrag hinzufügen."],
  [/herunterladen|download/i, "Die Datei auf diesem Gerät herunterladen."],
];

export function cmsButtonHelp(control) {
  const explicit = control.getAttribute("data-help");
  if (explicit) return explicit;
  for (const [attribute, help] of Object.entries(actionHelp)) {
    if (control.hasAttribute(attribute)) return help;
  }
  if (control.matches('button[type="submit"]') && control.closest("[data-event-group-checkin]")) {
    return "Die ausgewählten Personen zentral einchecken; bei aktivierter Welcome-Mail wird diese etwa 15 Minuten vor Eventbeginn eingeplant.";
  }
  if (control.matches("summary")) return "Diesen Bereich aufklappen oder zuklappen.";
  const label = (control.getAttribute("aria-label") || control.textContent || control.value || control.querySelector("svg title")?.textContent || "").replace(/\s+/g, " ").trim();
  for (const [pattern, help] of labelHelp) if (pattern.test(label)) return help;
  if (control.matches('a[href], [data-event-tab]')) return `Bereich „${label || "Details"}“ öffnen.`;
  if (label === "+") return "Weitere Optionen öffnen.";
  if (label === "×" || label === "✕") return "Dieses Fenster schließen.";
  if (control.querySelector('svg') && !label) return "Weitere Optionen zu diesem Eintrag öffnen.";
  return label ? `${label.replace(/[.!?]$/, "")}.` : "Diese Aktion ausführen.";
}

export function mountCmsButtonHelp(enabled) {
  observer?.disconnect();
  observer = null;
  if (!enabled) return;
  const update = (control) => {
    const title = control.getAttribute("title");
    // Keep help already supplied by the individual feature.
    if (title && title !== generatedTitles.get(control)) return;
    const help = cmsButtonHelp(control);
    generatedTitles.set(control, help);
    if (title !== help) control.setAttribute("title", help);
  };
  const scan = (node) => {
    if (node.nodeType !== 1) return;
    if (node.matches(selector)) update(node);
    node.querySelectorAll(selector).forEach(update);
  };
  scan(document.body);
  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        mutation.addedNodes.forEach(scan);
        const control = mutation.target.closest?.(selector);
        if (control) update(control);
      } else {
        const element = mutation.target.nodeType === 1 ? mutation.target : mutation.target.parentElement;
        const control = element?.closest(selector);
        if (control) update(control);
      }
    }
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["aria-label", "value", "data-help"] });
}
