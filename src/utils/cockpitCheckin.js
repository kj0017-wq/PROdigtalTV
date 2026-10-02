import { escapeHtml } from "./format.js?v=3";

const inactive = new Set(["cancelled", "canceled", "deleted", "archived", "expired", "rejected"]);
export function cockpitCheckinRows(records, eventId, search = "") {
  const term = search.trim().toLocaleLowerCase("de");
  const eventRows = records.filter(record => record.eventId === eventId && !inactive.has(String(record.status || "").toLowerCase()))
    .map(record => ({ ...record, name: [record.firstName, record.lastName].filter(Boolean).join(" ") || record.displayName || record.email || "Person" }));
  const rows = eventRows
    .filter(record => [record.name, record.email, record.company].join(" ").toLocaleLowerCase("de").includes(term))
    .sort((a, b) => Number(a.status === "checked_in") - Number(b.status === "checked_in") || a.name.localeCompare(b.name, "de"));
  const guestCount = eventRows.reduce((sum, record) => sum + Math.max(1, Number(record.participantCount) || (record.hasCompanion || record.companion ? 2 : 1)), 0);
  const openGuestCount = eventRows.filter(record => record.status !== "checked_in").reduce((sum, record) => sum + Math.max(1, Number(record.participantCount) || (record.hasCompanion || record.companion ? 2 : 1)), 0);
  const overview = `<div class="cockpit-checkin-overview"><strong>${openGuestCount} noch nicht eingecheckt</strong><span>${guestCount} angemeldete Gäste · ${eventRows.length} Anmeldungen</span></div>`;
  const result = rows.length ? rows.map(record => {
    const checked = record.status === "checked_in";
    const companion = record.hasCompanion || record.companion;
    return `<div class="cockpit-checkin-row"><div><strong>${escapeHtml(record.name)}</strong><small>${escapeHtml([record.company, record.email].filter(Boolean).join(" · "))}</small>${companion ? "<small>Mit Begleitperson</small>" : ""}</div>${checked ? '<span class="cockpit-checkin-done">Eingecheckt</span>' : `<button type="button" class="button button--secondary" data-cockpit-checkin-id="${escapeHtml(record.id)}">Einchecken</button>`}</div>`;
  }).join("") : `<p class="muted">${eventRows.length ? "Keine passende Anmeldung gefunden." : "Für dieses Event sind keine aktiven Anmeldungen vorhanden."}</p>`;
  return overview + result;
}

export function wireCockpitCheckin(root, { eventSelect, load, checkIn, onChanged, confirm = window.confirm.bind(window) }) {
  if (!root || root.dataset.wired || !eventSelect) return;
  root.dataset.wired = "1";
  const search = root.querySelector("[data-cockpit-checkin-search]");
  const list = root.querySelector("[data-cockpit-checkin-list]");
  const status = root.querySelector("[data-cockpit-checkin-status]");
  const refreshButton = root.querySelector("[data-cockpit-checkin-refresh]");
  let records = [];
  let busy = false;
  let generation = 0;
  const draw = () => { list.innerHTML = cockpitCheckinRows(records, eventSelect.value, search.value); };
  async function refresh() {
    const version = ++generation;
    const eventId = eventSelect.value;
    status.textContent = "Anmeldungen werden geladen ...";
    refreshButton.disabled = true;
    try {
      const result = await load();
      if (!root.isConnected || version !== generation || eventSelect.value !== eventId) return;
      records = result;
      draw();
      status.textContent = "";
    } catch (error) {
      if (version === generation) { list.replaceChildren(); status.textContent = error.message || "Anmeldungen konnten nicht geladen werden."; }
    } finally { if (version === generation) refreshButton.disabled = busy; }
  }
  search.addEventListener("input", draw);
  root.addEventListener("toggle", () => { if (root.open && !busy) refresh(); });
  refreshButton.addEventListener("click", () => { if (!busy) refresh(); });
  eventSelect.addEventListener("change", () => {
    generation++;
    records = [];
    search.value = "";
    draw();
    if (root.open) refresh();
  });
  list.addEventListener("click", async event => {
    const button = event.target.closest("[data-cockpit-checkin-id]");
    if (!button || busy) return;
    const eventId = eventSelect.value;
    const record = records.find(item => item.id === button.dataset.cockpitCheckinId && item.eventId === eventId);
    if (!record || record.status === "checked_in" || inactive.has(record.status)) return;
    const name = [record.firstName, record.lastName].filter(Boolean).join(" ") || record.email;
    const title = eventSelect.selectedOptions[0]?.dataset.eventTitle || eventSelect.selectedOptions[0]?.textContent || "";
    if (!confirm(`${name}${record.hasCompanion || record.companion ? " inklusive Begleitperson" : ""} für „${title}“ einchecken?`)) return;
    busy = true;
    generation++;
    eventSelect.disabled = true;
    refreshButton.disabled = true;
    search.disabled = true;
    list.querySelectorAll("button").forEach(control => { control.disabled = true; });
    status.textContent = "Check-in läuft ...";
    try {
      const response = await checkIn(eventId, [record.id]);
      await refresh();
      status.textContent = response.checkedInCount > 0 ? `${name} ist eingecheckt.` : "Keine Änderung. Die Anmeldung wurde bereits eingecheckt oder ist nicht mehr aktiv.";
      await onChanged?.();
    } catch (error) { status.textContent = error.message || "Check-in fehlgeschlagen."; }
    finally {
      busy = false;
      eventSelect.disabled = false;
      refreshButton.disabled = false;
      search.disabled = false;
      list.querySelectorAll("button").forEach(control => { control.disabled = false; });
    }
  });
  if (root.open) refresh();
}
