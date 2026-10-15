import { list, getOne, upsert } from '../firebase/dataService.js?v=535';
import { escapeHtml } from './format.js?v=3';
const normal = value => String(value || '').trim().toLowerCase();
export function invitationGuestChoices(records = []) {
  const unique = new Map();
  for (const person of records) {
    const email = normal(person.email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || ['archived','deleted','inactive'].includes(normal(person.status))) continue;
    if (person.notificationOptOut === true || person.mailingDisabled === true || person.reminderConsent === false) continue;
    if (!unique.has(email)) unique.set(email, { email, name: person.name || [person.firstName, person.lastName].filter(Boolean).join(' ') || email, company: person.company || '' });
  }
  return [...unique.values()].sort((a,b) => a.name.localeCompare(b.name,'de'));
}
export function mountEventInvitationGuests(root = document) {
  const form = root.querySelector('[data-event-invitation-list],#event-notification-form');
  const group = form?.querySelector('[data-notification-recipient-group]');
  const eventSelect = form?.querySelector('[data-notification-event-select]') || (form?.matches('[data-event-invitation-list]') ? root.querySelector('[data-mobile-live-event]') : null);
  if (!group || !eventSelect || form.dataset.invitationGuestsMounted) return;
  form.dataset.invitationGuestsMounted = '1';
  if (!group.querySelector('[value="members_event_guests"]')) {
    const option = document.createElement('option'); option.value = 'members_event_guests'; option.textContent = 'Mitglieder und ausgewählte Gäste';
    group.querySelector('[value="members"]')?.after(option);
  }
  const box = document.createElement('section'); box.className = 'panel'; box.dataset.invitationGuestPicker = '';
  box.innerHTML = '<h3>Zusätzliche Gäste für dieses Event</h3><p>Aus der gesamten Mailliste auswählen. Mitglieder werden über die Empfängergruppe berücksichtigt. Die Auswahl ist keine Anmeldung.</p><label>🔍 Gäste suchen<input type="search" data-invitation-guest-search placeholder="Name, Firma oder E-Mail"></label><div data-invitation-guest-list style="max-height:320px;overflow:auto;margin:12px 0"></div><button type="button" class="button button--primary" data-invitation-guest-save>Event-Einladungsliste speichern</button><p role="status" aria-live="polite" data-invitation-guest-status></p>';
  group.closest('.field').after(box);
  const search = box.querySelector('input'), rows = box.querySelector('[data-invitation-guest-list]'), save = box.querySelector('button'), status = box.querySelector('[role="status"]');
  status.style.cssText = 'padding:12px;border-radius:10px;background:#edf3fa;min-height:22px';
  save.before(status);
  const progress = document.createElement('progress'); progress.hidden = true; progress.style.cssText = 'width:100%;height:8px'; progress.setAttribute('aria-label','Einladungsliste wird gespeichert'); save.after(progress);
  let choices = [], selected = new Set(), dirty = false, generation = 0, loading = false, busy = false, ready = false;
  const visible = () => { box.hidden = group.value !== 'members_event_guests'; };
  const draw = () => {
    const term = normal(search.value);
    const filtered = choices.filter(p => selected.has(p.email) || normal([p.name,p.email,p.company].join(' ')).includes(term));
    rows.innerHTML = filtered.map(p => `<label style="display:flex;gap:10px;padding:10px 0;border-bottom:1px solid #dce4ee;align-items:center"><input type="checkbox" value="${escapeHtml(p.email)}" ${selected.has(p.email)?'checked':''} ${loading||busy?'disabled':''}><span><strong>${escapeHtml(p.name)}</strong><small style="display:block">${escapeHtml([p.company,p.email].filter(Boolean).join(' · '))}</small></span></label>`).join('') || '<p>Keine passenden Kontakte gefunden.</p>';
    save.disabled = loading || busy || !ready;
  };
  const load = async () => {
    const version = ++generation, eventId = eventSelect.value;
    loading = true; ready = false; dirty = false; selected = new Set(); rows.replaceChildren(); save.disabled = true;
    status.textContent = 'Event-Einladungsliste wird geladen …';
    visible();
    try {
      const [event, contacts, access] = await Promise.all([getOne('events',eventId),list('contacts'),getOne('eventLiveAccess',eventId)]);
      if (!box.isConnected || version !== generation) return;
      if (!event) throw Error('Veranstaltung nicht gefunden.');
      choices = invitationGuestChoices(contacts);
      selected = new Set((access?.invitationGuestEmails || []).map(normal));
      const known = new Set(choices.map(p=>p.email));
      for (const email of selected) if (!known.has(email)) choices.push({email,name:email,company:'Gespeicherte Auswahl – Erreichbarkeit wird vor Versand geprüft'});
      ready = true;
      status.textContent = `${selected.size} zusätzliche Gäste für dieses Event gespeichert.`;
    } catch (error) { if (version === generation) status.textContent = error.message || 'Liste konnte nicht geladen werden.'; }
    finally { if (version === generation) { loading = false; draw(); } }
  };
  rows.addEventListener('change', event => {
    const input = event.target.closest('input[type="checkbox"]'); if (!input) return;
    if (input.checked) selected.add(input.value); else selected.delete(input.value);
    dirty = true; save.disabled = false; status.textContent = `${selected.size} Gäste ausgewählt – bitte speichern.`;
  });
  search.addEventListener('input',draw);
  save.addEventListener('click',async () => {
    if (busy || loading || !ready) return;
    const eventId=eventSelect.value, version=generation, emails=[...selected].sort();
    if (!eventId) { status.textContent='Bitte zuerst eine Veranstaltung auswählen.'; return; }
    busy=true; eventSelect.disabled=true; progress.hidden=false;
    save.textContent='Wird gespeichert …'; save.setAttribute('aria-busy','true');
    status.style.background='#edf3fa'; status.textContent='Einladungsliste wird gespeichert …'; draw();
    const slowTimer = window.setTimeout(() => {
      if (busy && version===generation) status.textContent='Die Bestätigung vom Server dauert noch. Bitte warten – nicht erneut speichern.';
    },8000);
    try {
      await upsert('eventLiveAccess',{id:eventId,invitationGuestEmails:emails});
      const persisted=await getOne('eventLiveAccess',eventId);
      const verified=[...new Set((persisted?.invitationGuestEmails||[]).map(normal))].sort();
      if(JSON.stringify(verified)!==JSON.stringify(emails))throw Error('Die gespeicherte Liste weicht ab. Bitte die Veranstaltung erneut auswählen.');
      if(version===generation){
        dirty=false; status.style.background='#edf8f0';
        status.textContent=`✓ Gespeichert: ${emails.length} zusätzliche Gäste für dieses Event. Noch keine Einladung versendet.`;
        status.scrollIntoView({block:'nearest',behavior:'smooth'});
      }
    } catch(error){
      if(version===generation){status.style.background='#fff0ef';status.textContent=`Speichern nicht bestätigt: ${error.message||'Bitte Verbindung und Berechtigung prüfen.'}`;}
    } finally {
      window.clearTimeout(slowTimer); busy=false; eventSelect.disabled=false;progress.hidden=true;
      save.removeAttribute('aria-busy'); save.textContent=dirty?'Erneut speichern':'Event-Einladungsliste speichern';draw();
    }
  });
  form.addEventListener('submit',event=>{
    if(group.value==='members_event_guests'&&(dirty||loading||busy)){
      event.preventDefault();event.stopImmediatePropagation();box.hidden=false;
      status.textContent='Bitte zuerst die Event-Einladungsliste vollständig laden und Änderungen speichern.';
      save.focus();
    }
  },true);
  group.addEventListener('change',visible);
  eventSelect.addEventListener('change',load);
  load();
}
