import { chatAttachmentMarkup, mountChatAttachments } from "./chatAttachments.js?v=5";
import { escapeHtml } from "./format.js?v=3";
import { getFirebaseServices } from "../firebase/firebaseClient.js?v=1";

async function groupCall(name, data) {
  const firebase = await getFirebaseServices();
  if (!firebase) throw new Error("Firebase ist nicht erreichbar.");
  return (await firebase.functionsLib.httpsCallable(firebase.functions, name, { timeout: 45000 })(data)).data;
}

const getEventLiveGroupMessages = (eventId, beforeId = "") => groupCall("getEventLiveGroupMessages", { eventId, beforeId });
const sendEventLiveGroupMessage = (eventId, text, messageId) => groupCall("sendEventLiveGroupMessage", { eventId, text, messageId });
const getEventLiveGroupStatus = eventId => groupCall("getEventLiveGroupStatus", { eventId });
const markEventLiveGroupRead = (eventId, messageId) => groupCall("markEventLiveGroupRead", { eventId, messageId });

const timeFormat = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" });

const groupIcon = `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="13" r="5"/><circle cx="8" cy="16" r="4"/><circle cx="32" cy="16" r="4"/><path d="M11 32v-4a9 9 0 0 1 18 0v4ZM1 31v-3a7 7 0 0 1 9-7M39 31v-3a7 7 0 0 0-9-7"/></svg>`;

export function mountEventLiveGroupChat(root, eventId, getData) {
  if (root.querySelector("[data-live-group-chat]")) return;
  const roster = root.querySelector(".event-live-roster");
  if (!roster) return;
  const row = document.createElement("button");
  row.type = "button";
  row.className = "event-live-person event-live-group-row";
  row.dataset.liveGroupChat = "";
  row.setAttribute("aria-label", "Gruppenchat öffnen");
  row.innerHTML = `<span class="event-live-person__avatar event-live-group-avatar">${groupIcon}</span><span class="event-live-person__copy"><strong>Gruppenchat</strong><small>Alle Teilnehmenden dieses Events</small></span><span class="event-live-unread-badge" data-group-unread style="display:none"></span><span class="event-live-person__arrow" aria-hidden="true">›</span>`;
  roster.prepend(row);
  function showCount(count) {
    const badge = row.querySelector("[data-group-unread]");
    const label = `${count} ungelesene Nachrichten`;
    badge.textContent = count > 99 ? "99+" : String(count);
    badge.style.display = count ? "inline-flex" : "none";
    badge.setAttribute("aria-label", label);
    row.setAttribute("aria-label", count ? `Gruppenchat öffnen, ${label}` : "Gruppenchat öffnen");
    row.dataset.liveRequestState = count ? "message" : "none";
  }
  let checking = false;
  async function refresh() {
    if (!row.isConnected) return;
    const data = getData();
    const viewer = data.profile?.contactId;
    if (data.adminTest || !(data.participants || []).some(person => person.contactId === viewer)) { showCount(0); return; }
    if (checking || document.hidden) return;
    checking = true;
    try {
      const result = await getEventLiveGroupStatus(eventId);
      if (row.isConnected && getData().profile?.contactId === viewer && !getData().adminTest) showCount(result.unreadCount);
    } catch { /* Keep the last known count on a transient network failure. */ }
    finally { checking = false; }
  }
  const unread = { refresh };
  row.addEventListener("click", () => openGroupChat(root, eventId, getData, row, unread));
  refresh();
  const timer = window.setInterval(() => {
    if (!row.isConnected) window.clearInterval(timer);
    else refresh();
  }, 5000);
}

function openGroupChat(root, eventId, getData, row, unread) {
  const layer = root.querySelector("[data-live-detail-layer]");
  const content = layer?.querySelector("[data-live-detail-content]");
  if (!content || !layer.hidden) return;
  const data = getData();
  const checkedIn = (data.participants || []).some((person) => person.contactId === data.profile?.contactId);
  const canSend = checkedIn && data.canChat !== false && !data.adminTest;
  const detail = document.createElement("section");
  detail.className = "event-live-detail event-live-detail--tabs event-live-detail--chat";
  detail.innerHTML = `<header class="event-live-person-tabs-header"><button class="event-live-back" type="button" data-live-detail-close aria-label="Zur Chatliste"></button><span class="event-live-person__avatar event-live-group-avatar">${groupIcon}</span><div class="event-live-group-title"><h2>Gruppenchat</h2><p>${(data.participants || []).length} Personen · Dieses Event</p></div></header>`;
  const panel = document.createElement("section");
  panel.className = "event-live-group event-live-chat";
  panel.dataset.liveGroupPanel = "";
  panel.setAttribute("aria-label", "Gruppenchat für alle Teilnehmenden dieses Events");
  panel.innerHTML = `<button type="button" data-group-older hidden>Ältere Beiträge</button><div class="event-live-chat__messages" role="log" aria-live="polite" aria-relevant="additions" data-group-messages></div><form data-group-form><label class="event-live-chat__input">Beitrag an alle<textarea name="message" rows="1" maxlength="2000" required placeholder="Nachricht an alle Teilnehmenden" aria-label="Beitrag an alle Teilnehmenden"></textarea></label><button type="submit" aria-label="Nachricht senden">Senden</button></form><p role="status" data-group-status></p>`;
  detail.append(panel);
  content.replaceChildren(detail);
  layer.setAttribute("aria-label", "Gruppenchat");
  layer.hidden = false;
  detail.querySelector("[data-live-detail-close]").focus();
  detail.querySelector("[data-live-detail-close]").addEventListener("click", () => row.focus());
  const list = panel.querySelector("[data-group-messages]");
  const older = panel.querySelector("[data-group-older]");
  const form = panel.querySelector("[data-group-form]");
  const field = form.elements.message;
  const button = form.querySelector('button[type="submit"]');
  const status = panel.querySelector("[data-group-status]");
  const unavailable = data.adminTest ? "Im Admin-Test ist der Gruppenchat nur mit dem eigenen Account verfügbar." : !checkedIn ? "Der Gruppenchat ist nach Ihrem Check-in bei diesem Event verfügbar." : "Der Chat ist nach Ihrem Check-in bei diesem Event verfügbar.";

  const records = new Map();
  let oldestId = "";
  let resetAt;
  let loading = false;
  let pendingSend = null;
  let lastMarkup = "";
  let hasMore = false;
  let lastMarkedId = "";
  let marking = false;
  async function markVisibleRead() {
    if (!panel.isConnected || layer.hidden || document.hidden || list.scrollHeight - list.clientHeight - list.scrollTop > 12) return;
    if (!checkedIn || data.adminTest || marking) return;
    const latest = [...records.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)).at(-1);
    if (!latest || latest.id === lastMarkedId) return;
    marking = true;
    try {
      await markEventLiveGroupRead(eventId, latest.id);
      lastMarkedId = latest.id;
      await unread.refresh();
    } catch { /* Retry the read receipt on the next visible poll. */ }
    finally { marking = false; }
  }
  list.addEventListener("scroll", markVisibleRead, { passive: true });
  function updateMode() {
    field.disabled = button.disabled = !canSend;
    field.placeholder = "Nachricht an alle Teilnehmenden";
    older.hidden = !hasMore;
    status.textContent = !canSend ? unavailable : "";
  }
  const render = () => {
    const people = new Map((getData().participants || []).map((person) => [person.contactId, person.displayName || [person.firstName, person.lastName].filter(Boolean).join(" ")]));
    const markup = [...records.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)).map((item) => {
      const date = new Date(item.createdAt);
      const time = Number.isFinite(date.getTime()) ? timeFormat.format(date) : "";
      const name = item.self ? "Ich" : people.get(item.senderContactId) || "Teilnehmende Person";
      return `<article class="event-live-chat__message${item.self ? " is-self" : ""}"><strong>${escapeHtml(name)}</strong><p>${escapeHtml(item.text)}</p>${chatAttachmentMarkup(item)}<footer><time datetime="${escapeHtml(item.createdAt)}">${escapeHtml(time)}</time></footer></article>`;
    }).join("") || `<p class="event-live-muted">Noch keine Beiträge. Schreiben Sie den ersten Beitrag an alle.</p>`;
    if (markup === lastMarkup) return;
    const atBottom = list.scrollHeight - list.clientHeight - list.scrollTop < 70;
    list.innerHTML = markup;
    lastMarkup = markup;
    if (atBottom) list.scrollTop = list.scrollHeight;
  };
  const load = async (previous = false) => {
    if (!checkedIn || data.adminTest || loading || !panel.isConnected || document.hidden) return;
    loading = true;
    older.disabled = true;
    try {
      const result = await getEventLiveGroupMessages(eventId, previous ? oldestId : "");
      if (!panel.isConnected) return;
      const oldHeight = list.scrollHeight;
      if (resetAt !== undefined && resetAt !== result.resetAt) { records.clear(); oldestId = ""; lastMarkedId = ""; }
      resetAt = result.resetAt;
      result.messages.forEach((item) => records.set(item.id, item));
      if (previous || !oldestId) {
        oldestId = result.oldestId;
        hasMore = result.hasMore;
        older.hidden = !hasMore;
      }
      render();
      if (previous) list.scrollTop += list.scrollHeight - oldHeight;
      await markVisibleRead();
      if (status.textContent === "Beiträge werden geladen ...") status.textContent = "";
    } catch (error) {
      if (panel.isConnected) status.textContent = error.message || "Beiträge konnten nicht geladen werden.";
    } finally { loading = false; older.disabled = false; }
  };
  older.addEventListener("click", () => load(true));
  field.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    if (!event.repeat && field.value.trim() && !button.disabled) form.requestSubmit();
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = field.value.trim();
    if (!text || button.disabled || !canSend) return;
    if (!pendingSend || pendingSend.text !== text) pendingSend = { text, id: crypto.randomUUID() };
    button.disabled = true;
    field.disabled = true;
    status.textContent = "Beitrag wird gesendet ...";
    try {
      await sendEventLiveGroupMessage(eventId, text, pendingSend.id);
      if (!panel.isConnected) return;
      pendingSend = null;
      field.value = "";
      await load();
      status.textContent = "Beitrag ist für alle eingecheckten Teilnehmenden sichtbar.";
      list.scrollTop = list.scrollHeight;
    } catch (error) {
      if (panel.isConnected) status.textContent = error.message || "Senden fehlgeschlagen. Bitte erneut versuchen.";
    } finally {
      button.disabled = field.disabled = !canSend;
    }
  });
  mountChatAttachments({form,list,eventId,status,canSend:()=>canSend,
    onSent:()=>load()});
  updateMode();
  render();
  load();
  const timer = window.setInterval(() => {
    if (!panel.isConnected) window.clearInterval(timer);
    else { load(); markVisibleRead(); }
  }, 2000);
}

if (typeof document !== "undefined") {
  const mount = () => {
    const root = document.querySelector("[data-event-live-root]");
    if (!root) return;
    const layer = root.querySelector("[data-live-detail-layer]");
    if (layer?.getAttribute("aria-label") === "Gruppenchat" && !layer.querySelector("[data-live-group-panel]")) layer.setAttribute("aria-label", "Teilnehmerprofil");
    if (root.querySelector("[data-live-group-chat]")) return;
    const getData = () => {
      try { return JSON.parse(root.querySelector("[data-event-live-data]")?.dataset.eventLiveData || "{}"); }
      catch { return {}; }
    };
    mountEventLiveGroupChat(root, root.dataset.eventId, getData);
  };
  const start = () => {
    mount();
    new MutationObserver(mount).observe(document.getElementById("app") || document.body, { childList: true, subtree: true });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
}
