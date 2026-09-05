import { escapeHtml } from "../utils/format.js";

export function pushControls(eventId = "") {
  return `<section class="push-controls" data-push-controls data-event-id="${escapeHtml(eventId)}" aria-label="Browser-Benachrichtigungen">
    <strong>Benachrichtigungen auf diesem Ger&auml;t</strong>
    <p role="status" aria-live="polite" data-push-status>Status wird gepr&uuml;ft ...</p>
    <div class="actions"><button type="button" class="button button--secondary button--small" data-push-enable>Push aktivieren</button><button type="button" class="button button--secondary button--small" data-push-disable hidden>Push deaktivieren</button><button type="button" class="button button--secondary button--small" data-push-verify hidden>E-Mail bestaetigen</button></div>
  </section>`;
}
