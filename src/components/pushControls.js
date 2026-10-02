import { escapeHtml } from "../utils/format.js";

export function pushControls(eventId = "", options = {}) {
  const auto = options.auto ? " data-push-auto=\"true\"" : "";
  const primary = options.primary ? " button--primary" : " button--secondary";
  const title = options.title || "Benachrichtigungen auf diesem Geraet";
  const status = options.status || "Status wird geprueft ...";
  return `<section class="push-controls${options.prominent ? " push-controls--prominent" : ""}" ${options.prominent ? "data-push-prominent hidden" : ""} data-push-controls${auto} data-event-id="${escapeHtml(eventId)}" aria-label="Browser-Benachrichtigungen">
    <strong>${escapeHtml(title)}</strong>
    <p role="status" aria-live="polite" data-push-status>${escapeHtml(status)}</p>
    <div class="actions"><button type="button" class="button${primary} button--small" data-push-enable>Push aktivieren</button><button type="button" class="button button--secondary button--small" data-push-disable hidden>Push deaktivieren</button><button type="button" class="button button--secondary button--small" data-push-test hidden>Anzeige testen</button></div>
  </section>`;
}
