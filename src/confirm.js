import { confirmRegistration } from "./firebase/registrationService.js";
import { logo } from "./components/layout.js";
import { escapeHtml } from "./utils/format.js";

const root = document.querySelector("#app");
const token = new URLSearchParams(window.location.search).get("token");

root.innerHTML = `<main class="login-wrap"><section class="container"><div class="form-card login-card">${logo()}<p class="eyebrow">Event-Anmeldung</p><h1 style="margin-bottom:15px">Bestaetigung wird geprueft</h1><p>Bitte warten Sie einen Moment.</p></div></section></main>`;

try {
  const result = await confirmRegistration(token);
  root.innerHTML = `<main class="login-wrap"><section class="container"><div class="form-card login-card">${logo()}<p class="eyebrow">Bestaetigung</p><h1 style="margin-bottom:15px">Ihre Anmeldung ist bestaetigt.</h1><div class="alert alert--success">${escapeHtml(result.message || "Vielen Dank. Ihre Teilnahme wurde erfolgreich bestaetigt.")}</div><a href="/#/events" class="button button--primary" style="margin-top:24px">Zu den Events</a></div></section></main>`;
} catch (error) {
  root.innerHTML = `<main class="login-wrap"><section class="container"><div class="form-card login-card">${logo()}<p class="eyebrow">Bestaetigung</p><h1 style="margin-bottom:15px">Link ungueltig oder abgelaufen.</h1><div class="alert alert--warning">${escapeHtml(error.message)}</div><a href="/#/events" class="button button--secondary" style="margin-top:24px">Zu den Events</a></div></section></main>`;
}
