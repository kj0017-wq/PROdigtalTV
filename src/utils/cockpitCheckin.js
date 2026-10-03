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
    return `<div class="cockpit-checkin-row" data-cockpit-registration-row="${escapeHtml(record.id)}"><div class="cockpit-checkin-person"><strong>${escapeHtml(record.name)}</strong><small>${escapeHtml([record.company, record.email].filter(Boolean).join(" · "))}</small>${companion ? "<small>Mit Begleitperson</small>" : ""}</div><div class="cockpit-checkin-actions">${checked ? '<span class="cockpit-checkin-done">Eingecheckt</span>' : `<button type="button" class="button button--secondary" data-cockpit-checkin-id="${escapeHtml(record.id)}">Einchecken</button>`}<button type="button" class="button button--danger" data-cockpit-delete-id="${escapeHtml(record.id)}">Löschen</button></div><small class="cockpit-checkin-swipe-hint">→ Einchecken · ← Löschen</small></div>`;
  }).join("") : `<p class="muted">${eventRows.length ? "Keine passende Anmeldung gefunden." : "Für dieses Event sind keine aktiven Anmeldungen vorhanden."}</p>`;
  return overview + result;
}

export function wireCockpitCheckin(root, { eventSelect, load, checkIn, remove, onChanged, confirm = window.confirm.bind(window) }) {
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
    const checkInButton = event.target.closest("[data-cockpit-checkin-id]");
    const deleteButton = event.target.closest("[data-cockpit-delete-id]");
    const button = checkInButton || deleteButton;
    if (!button || busy) return;
    const eventId = eventSelect.value;
    const registrationId = checkInButton?.dataset.cockpitCheckinId || deleteButton?.dataset.cockpitDeleteId || "";
    const record = records.find(item => item.id === registrationId && item.eventId === eventId);
    if (!record || inactive.has(String(record.status || "").toLowerCase())) return;
    const name = [record.firstName, record.lastName].filter(Boolean).join(" ") || record.email;
    const title = eventSelect.selectedOptions[0]?.dataset.eventTitle || eventSelect.selectedOptions[0]?.textContent || "";
    const deleting = Boolean(deleteButton);
    if (deleting) {
      if (!remove || !confirm(`${name}${record.hasCompanion || record.companion ? " inklusive Begleitperson" : ""} aus der Gästeliste für „${title}“ löschen? Die Anmeldung wird dauerhaft gelöscht.`)) return;
    } else {
      if (record.status === "checked_in") return;
      if (!confirm(`${name}${record.hasCompanion || record.companion ? " inklusive Begleitperson" : ""} für „${title}“ einchecken?`)) return;
    }
    busy = true;
    generation++;
    eventSelect.disabled = true;
    refreshButton.disabled = true;
    search.disabled = true;
    list.querySelectorAll("button").forEach(control => { control.disabled = true; });
    status.textContent = deleting ? "Anmeldung wird gelöscht ..." : "Check-in läuft ...";
    try {
      const response = deleting ? await remove(record.id) : await checkIn(eventId, [record.id]);
      await refresh();
      status.textContent = deleting
        ? `${name} wurde aus der Gästeliste gelöscht.`
        : response.checkedInCount > 0 ? `${name} ist eingecheckt.` : "Keine Änderung. Die Anmeldung wurde bereits eingecheckt oder ist nicht mehr aktiv.";
      await onChanged?.();
    } catch (error) { status.textContent = error.message || (deleting ? "Löschen fehlgeschlagen." : "Check-in fehlgeschlagen."); }
    finally {
      busy = false;
      eventSelect.disabled = false;
      refreshButton.disabled = false;
      search.disabled = false;
      list.querySelectorAll("button").forEach(control => { control.disabled = false; });
    }
  });
  let swipe = null;
  list.addEventListener("pointerdown", event => {
    if (event.target.closest("button, input, a, textarea, select")) return;
    const row = event.target.closest("[data-cockpit-registration-row]");
    if (!row || busy) return;
    swipe = { row, pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    row.setPointerCapture?.(event.pointerId);
  });
  list.addEventListener("pointermove", event => {
    if (!swipe || swipe.pointerId !== event.pointerId) return;
    const dx = event.clientX - swipe.x;
    const dy = event.clientY - swipe.y;
    if (Math.abs(dx) <= Math.abs(dy)) return;
    swipe.row.style.transform = `translateX(${Math.max(-72, Math.min(72, dx))}px)`;
  });
  const finishSwipe = event => {
    if (!swipe || swipe.pointerId !== event.pointerId) return;
    const { row, x, y } = swipe;
    swipe = null;
    row.style.transform = "";
    const dx = event.clientX - x;
    const dy = event.clientY - y;
    if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.35) return;
    const target = dx > 0 ? row.querySelector("[data-cockpit-checkin-id]") : row.querySelector("[data-cockpit-delete-id]");
    target?.click();
  };
  list.addEventListener("pointerup", finishSwipe);
  list.addEventListener("pointercancel", event => {
    if (!swipe || swipe.pointerId !== event.pointerId) return;
    swipe.row.style.transform = "";
    swipe = null;
  });
  if (root.open) refresh();
}
