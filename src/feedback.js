import { getFirebaseServices } from "./firebase/firebaseClient.js?v=1";
import { logo } from "./components/layout.js?v=17";
import { escapeHtml, formatDate } from "./utils/format.js";

const root = document.querySelector("#app");
const token = new URLSearchParams(window.location.search).get("token") || "";

async function callFeedbackFunction(name, data = {}) {
  const firebase = await getFirebaseServices();
  const callable = firebase.functionsLib.httpsCallable(firebase.functions, name, { timeout: 30000 });
  return (await callable(data)).data;
}

function questionHtml(question = {}, index = 0) {
  const inputName = `q_${question.id}`;
  const commentName = `comment_${question.id}`;
  const isMultiple = question.type === "multiple";
  return `<fieldset class="event-feedback-question" data-feedback-question="${escapeHtml(question.id)}" data-feedback-type="${escapeHtml(question.type || "single")}">
    <legend><span>${index + 1}</span>${escapeHtml(question.title || "Feedbackfrage")}</legend>
    <div class="event-feedback-options">
      ${(question.options || []).map((option) => `<label class="event-feedback-option"><input type="${isMultiple ? "checkbox" : "radio"}" name="${escapeHtml(inputName)}" value="${escapeHtml(option)}" ${isMultiple ? "" : "required"}><span>${escapeHtml(option)}</span></label>`).join("")}
    </div>
    <div class="field"><label>${escapeHtml(question.commentPrompt || "Kommentar")}</label><textarea name="${escapeHtml(commentName)}" rows="3" placeholder="Optional"></textarea></div>
  </fieldset>`;
}

function shell(content = "") {
  root.innerHTML = `<main class="login-wrap feedback-html-page"><section class="container"><div class="form-card event-feedback-html-card">${logo()}${content}</div></section></main>`;
}

function loading() {
  shell(`<p class="eyebrow">Gästebefragung</p><h1>Formular wird geladen</h1><p>Bitte warten Sie einen Moment.</p>`);
}

function renderForm(payload = {}) {
  const eventRecord = payload.event || {};
  const guest = payload.guest || {};
  const eventMeta = [formatDate(eventRecord.date), eventRecord.locationName, eventRecord.city].filter(Boolean).join(" · ");
  const alreadySubmitted = payload.feedback?.submittedAt ? `<div class="alert alert--success">Vielen Dank, Ihre Rückmeldung wurde bereits gespeichert. Sie können sie bei Bedarf erneut absenden.</div>` : "";
  shell(`<p class="eyebrow">Gästebefragung</p><h1>Ihre Rückmeldung</h1><p class="muted">${escapeHtml(eventRecord.title || "PROdigitalTV Veranstaltung")}${eventMeta ? ` · ${escapeHtml(eventMeta)}` : ""}</p>
    <div class="event-feedback-guest" style="margin:16px 0 22px"><strong>${escapeHtml(guest.guestName || "Gast")}</strong>${guest.guestCompany ? `<span>${escapeHtml(guest.guestCompany)}</span>` : ""}${guest.guestEmail ? `<span>${escapeHtml(guest.guestEmail)}</span>` : ""}</div>
    <form id="event-feedback-form" class="event-feedback-form" data-token="${escapeHtml(token)}">
      ${alreadySubmitted}
      ${(payload.questions || []).map(questionHtml).join("")}
      <fieldset class="event-feedback-question event-feedback-question--compact">
        <legend><span>+</span>Dürfen wir Sie zu PROdigitalTV-Veranstaltungen und Informationen zum Netzwerk kontaktieren?</legend>
        <div class="event-feedback-options event-feedback-options--inline">
          <label class="event-feedback-option"><input type="radio" name="contactConsent" value="Ja"><span>Ja</span></label>
          <label class="event-feedback-option"><input type="radio" name="contactConsent" value="Nein"><span>Nein</span></label>
        </div>
      </fieldset>
      <div id="event-feedback-result" role="status" aria-live="polite"></div>
      <div class="actions"><button class="button button--primary" type="submit">Gästebefragung absenden</button></div>
    </form>`);
  wireSubmit();
}

function wireSubmit() {
  document.querySelector("#event-feedback-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const result = form.querySelector("#event-feedback-result");
    const button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    if (result) result.innerHTML = `<div class="alert">Gästebefragung wird gespeichert ...</div>`;
    try {
      const answers = {};
      const comments = {};
      form.querySelectorAll("[data-feedback-question]").forEach((question) => {
        const id = question.dataset.feedbackQuestion;
        const type = question.dataset.feedbackType || "single";
        if (!id) return;
        answers[id] = type === "multiple"
          ? Array.from(question.querySelectorAll("input:checked")).map((input) => input.value).filter(Boolean)
          : question.querySelector("input:checked")?.value || "";
        comments[id] = question.querySelector(`textarea[name="comment_${id}"]`)?.value || "";
      });
      const contactConsent = form.querySelector("input[name='contactConsent']:checked")?.value || "";
      await callFeedbackFunction("submitEventFeedback", { token: form.dataset.token || "", answers, comments, contactConsent });
      shell(`<p class="eyebrow">Gästebefragung</p><h1>Vielen Dank für Ihre Rückmeldung.</h1><div class="alert alert--success">Ihre Antworten wurden gespeichert und helfen uns bei der Nachbereitung.</div>`);
    } catch (error) {
      if (result) result.innerHTML = `<div class="alert alert--error">${escapeHtml(error?.message || "Gästebefragung konnte nicht gespeichert werden.")}</div>`;
      if (button) button.disabled = false;
    }
  });
}

loading();
try {
  if (!token) throw new Error("Der Link ist unvollständig.");
  const payload = await callFeedbackFunction("getEventFeedbackByToken", { token });
  renderForm(payload);
} catch (error) {
  shell(`<p class="eyebrow">Gästebefragung</p><h1>Link nicht verfügbar</h1><div class="alert alert--warning">${escapeHtml(error?.message || "Der Link konnte nicht geöffnet werden.")}</div>`);
}