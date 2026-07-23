import { confirmRegistration, readStoredTicket } from "./firebase/registrationService.js?v=12";
import { logo } from "./components/layout.js";
import { escapeHtml } from "./utils/format.js";

const root = document.querySelector("#app");
const token = new URLSearchParams(window.location.search).get("token");
const eventsUrl = `/?v=${Date.now()}#/events`;

root.innerHTML = `<main class="login-wrap"><section class="container"><div class="form-card login-card">${logo()}<p class="eyebrow">Event-Anmeldung</p><h1 style="margin-bottom:15px">Bestaetigung wird geprueft</h1><p>Bitte warten Sie einen Moment.</p></div></section></main>`;

try {
  const result = await confirmRegistration(token);
  const storedTicket = readStoredTicket(result.eventId);
  const ticketQr = result.ticketLink
    ? `https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=1&data=${encodeURIComponent(result.ticketLink)}`
    : "";
  root.innerHTML = `<main class="login-wrap"><section class="container"><div class="form-card login-card">${logo()}<p class="eyebrow">Bestaetigung</p><h1 style="margin-bottom:15px">Ihre Anmeldung ist bestaetigt.</h1><div class="alert alert--success">${escapeHtml(result.message || "Vielen Dank. Ihre Teilnahme wurde erfolgreich bestaetigt.")}</div>
    ${result.ticketLink ? `<div class="ticket-confirmation-box" style="margin-top:24px"><h2>Handy als Eintrittskarte</h2>${storedTicket?.ticketToken ? `<div class="alert alert--success">Ticket ist auf diesem Geraet gespeichert.</div>` : `<div class="alert alert--warning">Ticket wurde bestaetigt, konnte auf diesem Geraet aber noch nicht gespeichert werden. Bitte den Ticket-Link oeffnen.</div>`}<p>Wenn Sie diese Seite bereits auf dem Handy geoeffnet haben, ist das Ticket auf diesem Geraet gespeichert.</p><p>Wenn Sie am Computer sind: QR-Code mit dem Handy scannen.</p><img src="${ticketQr}" alt="QR-Code fuer Handy-Ticket" style="width:220px;max-width:100%;height:auto;margin:12px auto;display:block"><a href="${escapeHtml(result.ticketLink)}" class="button button--secondary">Ticket-Link oeffnen</a></div>` : ""}
    ${result.cancelUrl ? `<p style="margin-top:18px"><a href="${escapeHtml(result.cancelUrl)}">Anmeldung stornieren</a></p>` : ""}
    <a href="${eventsUrl}" class="button button--primary" style="margin-top:24px">Zu den Events</a></div></section></main>`;
} catch (error) {
  root.innerHTML = `<main class="login-wrap"><section class="container"><div class="form-card login-card">${logo()}<p class="eyebrow">Bestaetigung</p><h1 style="margin-bottom:15px">Link ungueltig oder abgelaufen.</h1><div class="alert alert--warning">${escapeHtml(error.message)}</div><a href="${eventsUrl}" class="button button--secondary" style="margin-top:24px">Zu den Events</a></div></section></main>`;
}
