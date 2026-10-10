import { escapeHtml } from "./format.js?v=3";
export function mailingRegistrationValues(person) {
  let firstName = person.firstName || "", lastName = person.lastName || "";
  const name = String(person.name || "").replace(/^(Herr|Frau)\s+/i, "").trim();
  if (!firstName && !lastName && name && name !== person.company && name !== person.email) {
    const parts = name.split(/\s+/); firstName = parts.shift() || ""; lastName = parts.join(" ");
  }
  return { firstName, lastName, company: person.company || "", position: person.position || "", email: person.email || "", phone: person.mobile || person.phone || "", linkedIn: person.linkedIn || "" };
}
export function mountRegistrationMailingPicker(form) {
  if (!form) return;
  const input = form.querySelector("[data-registration-mailing-search]");
  const results = form.querySelector("[data-registration-mailing-results]");
  if (!input || !results) return;
  const people = JSON.parse(form.querySelector("[data-registration-mailing-data]")?.textContent || "[]");
  let matches = [];
  input.addEventListener("input", () => {
    const query = input.value.trim().toLocaleLowerCase("de");
    if (query.length < 2) { matches = []; results.innerHTML = ""; return; }
    matches = people.filter(person => [person.firstName, person.lastName, person.name, person.company, person.email].join(" ").toLocaleLowerCase("de").includes(query));
    results.innerHTML = matches.length ? matches.slice(0, 12).map((person, index) => `<button type="button" class="button button--secondary" data-mailing-choice="${index}" title="Diese Person ins Anmeldeformular übernehmen"><strong>${escapeHtml([person.firstName, person.lastName].filter(Boolean).join(" ") || person.name || person.email)}</strong><small>${escapeHtml([person.company, person.email].filter(Boolean).join(" · "))}</small></button>`).join("") + (matches.length > 12 ? `<small class="muted">Weitere Treffer vorhanden. Bitte die Suche eingrenzen.</small>` : "") : `<p class="muted">Keine passenden Datensätze gefunden.</p>`;
  });
  results.addEventListener("click", event => {
    const button = event.target.closest("[data-mailing-choice]");
    if (!button) return;
    const person = matches[Number(button.dataset.mailingChoice)];
    if (!person) return;
    for (const [name, value] of Object.entries(mailingRegistrationValues(person))) {
      const field = form.elements.namedItem(name);
      if (field) { field.value = value; field.dispatchEvent(new Event("input", { bubbles: true })); }
    }
    input.value = person.email || person.name || "";
    results.innerHTML = `<p class="muted">Daten übernommen. Bitte prüfen und fehlende Angaben ergänzen.</p>`;
    form.elements.firstName.focus();
  });
}
