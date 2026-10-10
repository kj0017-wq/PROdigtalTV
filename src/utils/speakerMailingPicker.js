import { escapeHtml } from './format.js?v=3';
import { mailingRegistrationValues } from './registrationMailingPicker.js';
const normal = value => String(value || '').trim().toLocaleLowerCase('de');
export function speakerMailingMatches(people, lastName, firstName = '') {
  const last = normal(lastName), first = normal(firstName);
  if (last.length < 2) return [];
  const unique = new Map();
  for (const person of people) {
    const names = mailingRegistrationValues(person);
    if (normal(names.lastName) !== last || (first && normal(names.firstName) !== first)) continue;
    const key = normal(person.email) || `${normal(names.firstName)}|${last}|${normal(person.company)}`;
    if (!unique.has(key)) unique.set(key, { ...person, ...names });
  }
  return [...unique.values()];
}
export function speakerMailingValues(person) {
  const values = mailingRegistrationValues(person);
  return { speakerFirstName: values.firstName, speakerCompany: values.company, speakerPosition: values.position, speakerEmail: values.email, speakerPhone: values.phone, speakerWebsite: person.website || person.url || '', speakerShortBio: person.shortBio || person.bio || '', speakerLongBio: person.longBio || person.vita || person.biography || '' };
}
export function mountSpeakerMailingPicker(form, people) {
  const last = form?.elements.namedItem('speakerLastName');
  if (!last) return;
  const first = form.elements.namedItem('speakerFirstName');
  const existing = form.elements.namedItem('existingSpeakerId');
  const result = document.createElement('div');
  result.setAttribute('aria-live', 'polite');
  last.insertAdjacentElement('afterend', result);
  const autoFilled = new Map();
  let choices = [], timer;
  const clearPrevious = () => {
    for (const [name, value] of autoFilled) {
      const field = form.elements.namedItem(name);
      if (field?.value === value) { field.value = ''; field.dispatchEvent(new Event('input', { bubbles: true })); }
    }
    autoFilled.clear();
  };
  const fill = person => {
    for (const [name, value] of Object.entries(speakerMailingValues(person))) {
      const field = form.elements.namedItem(name);
      if (!field || field.value.trim() || !value) continue;
      field.value = value;
      autoFilled.set(name, value);
      field.dispatchEvent(new Event('input', { bubbles: true }));
    }
    result.innerHTML = `<small class="muted">Angaben aus der Mailingliste übernommen. Bitte prüfen.</small>`;
  };
  const search = () => {
    if (existing?.value || !form.isConnected) { result.innerHTML = ''; return; }
    choices = speakerMailingMatches(people, last.value, first?.value);
    if (choices.length === 1) { fill(choices[0]); return; }
    result.innerHTML = choices.length ? `<small class="muted">Passende Person auswählen:</small>${choices.map((person, index) => `<button type="button" class="button button--secondary button--small" data-speaker-mailing-choice="${index}">${escapeHtml([person.firstName, person.lastName].filter(Boolean).join(' '))}<small>${escapeHtml([person.company, person.email].filter(Boolean).join(' · '))}</small></button>`).join('')}` : '';
  };
  last.addEventListener('input', () => { clearTimeout(timer); clearPrevious(); result.innerHTML = ''; timer = setTimeout(search, 450); });
  last.addEventListener('change', () => { clearTimeout(timer); search(); });
  last.addEventListener('blur', () => { clearTimeout(timer); search(); });
  first?.addEventListener('change', () => { if (!autoFilled.has('speakerFirstName')) search(); });
  result.addEventListener('click', event => { const button = event.target.closest('[data-speaker-mailing-choice]'); const person = choices[Number(button?.dataset.speakerMailingChoice)]; if (button && person) fill(person); });
}
