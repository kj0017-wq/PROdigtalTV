import { chatAttachmentMarkup, mountChatAttachments } from "./chatAttachments.js?v=5";
import { escapeHtml } from "./format.js?v=3";
import { getEventLiveMessages, sendEventLiveMessage, markEventLiveMessagesRead, deleteEventLiveMessage, getEventLiveData, respondEventLiveContact } from "../firebase/eventLiveService.js?v=6";

const drafts = new Map();
export function contactDetailsMarkup(card = {}) {
  const fields = [["E-Mail", card.email], ["Telefon", card.phone], ["LinkedIn", card.linkedIn]];
  return '<dl class="event-live-chat__contact-fields">' + fields.map(([label, value]) =>
    "<div><dt>" + label + "</dt><dd>" + escapeHtml(value || "Nicht angegeben") + "</dd></div>").join("") + "</dl>";
}
const dayFormat = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" });
const timeFormat = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
function dayLabel(date) {
  const key = dayFormat.format(date);
  const now = new Date();
  if (key === dayFormat.format(now)) return "Heute";
  now.setDate(now.getDate() - 1);
  return key === dayFormat.format(now) ? "Gestern" : key;
}

export function mountEventLiveChat(container, eventId, peerId, peerName, { canSend = true, focusComposer = false, viewerId = "", embedded = false, cannotSendMessage = "" } = {}) {
  container.insertAdjacentHTML("beforeend", `<section class="event-live-chat" aria-label="Chat mit ${escapeHtml(peerName)}"><h3>Nachrichten</h3><button type="button" data-chat-older hidden>Ältere Nachrichten</button><div class="event-live-chat__messages" role="log" aria-live="polite" aria-relevant="additions" data-chat-messages></div><form data-chat-form><label class="event-live-chat__input">Nachricht<textarea name="message" rows="2" maxlength="2000" required aria-label="Nachricht an ${escapeHtml(peerName)}"></textarea></label><button type="submit" aria-label="Nachricht senden" title="Nachricht senden">Senden</button></form><p data-chat-status role="status">Nachrichten werden geladen ...</p></section>`);
  const panel = container.querySelector(".event-live-chat");
  container.classList.add("event-live-detail--chat");
  if (!embedded) {
  const header = document.createElement("header");
  header.className = "event-live-chat__header";
  const back = container.querySelector("[data-live-detail-close]");
  if (back) header.append(back);
  const avatar = container.querySelector(".event-live-detail__avatar");
  if (avatar) header.append(avatar.cloneNode(true));
  const title = document.createElement("strong");
  title.textContent = peerName;
  header.append(title);
  const profile = document.createElement("details");
  profile.className = "event-live-chat__profile";
  const summary = document.createElement("summary");
  summary.textContent = "Profil und Kontaktdaten";
  profile.append(summary);
  const profileBody = document.createElement("div");
  profileBody.className = "event-live-chat__profile-body";
  [...container.children].filter((child) => child !== panel).forEach((child) => profileBody.append(child));
  profile.append(profileBody);
  profile.addEventListener("toggle", () => {
    summary.textContent = profile.open ? "Zurück zum Chat" : "Profil und Kontaktdaten";
  });
  container.prepend(header, profile);
  }
  const contactRequest = container.querySelector("[data-chat-contact-request]") || document.createElement("section");
  contactRequest.className = "event-live-chat__contact-request";
  contactRequest.dataset.chatContactRequest = "";
  contactRequest.setAttribute("aria-live", "polite");
  contactRequest.hidden = !contactRequest.innerHTML;
  panel.before(contactRequest);
  panel.querySelector("h3").hidden = true;
  const list = panel.querySelector("[data-chat-messages]");
  const status = panel.querySelector("[data-chat-status]");
  const older = panel.querySelector("[data-chat-older]");
  const form = panel.querySelector("form");
  const field = form.elements.message;
  const draftKey = JSON.stringify([viewerId, eventId, peerId]);
  field.value = drafts.get(draftKey) || "";
  field.placeholder = `Nachricht an ${peerName}`;
  field.rows = 1;
  const fitComposer = () => {
    field.style.height = "44px";
    field.style.height = `${Math.min(110, Math.max(44, field.scrollHeight + 2))}px`;
  };
  field.addEventListener("input", fitComposer);
  window.requestAnimationFrame(fitComposer);
  const sendButton = form.querySelector("button[type=submit]");
  sendButton.textContent = "↑";
  field.addEventListener("input", () => drafts.set(draftKey, field.value));
  const focusEditor = () => { form.scrollIntoView({ behavior: "auto", block: "center" }); if (canSend) field.focus({ preventScroll: true }); };
  if (focusComposer) window.requestAnimationFrame(focusEditor);
  if (!canSend) {
    field.disabled = true;
    form.querySelector("button[type=submit]").disabled = true;
    status.textContent = cannotSendMessage || "Nachrichten sind nach Ihrem Check-in bei diesem Event verfügbar.";
    return;
  }
  const records = new Map();
  field.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    if (!event.repeat && !field.disabled && !sendButton.disabled && field.value.trim()) form.requestSubmit();
  });
  let oldestId = "";
  let resetAt;
  let loading = false;
  let lastMarkup = "";
  let pendingSend = null;
  let markedId = "";
  let selectedMessageId = "";
  const syncSelection = () => list.querySelectorAll("[data-chat-delete]").forEach((button) => {
    button.hidden = button.dataset.chatDelete !== selectedMessageId;
    button.closest("article").classList.toggle("is-selected", !button.hidden);
  });
  const selectionEvents = new AbortController();
  document.addEventListener("click", (event) => {
    const message = event.target.closest(".event-live-chat__message");
    selectedMessageId = list.contains(message) ? message.querySelector("[data-chat-delete]")?.dataset.chatDelete || "" : "";
    syncSelection();
  }, { signal: selectionEvents.signal });
  list.addEventListener("keydown", (event) => {
    if (event.target.matches("article") && ["Enter", " "].includes(event.key)) {
      event.preventDefault();
      event.target.click();
    }
    if (event.key === "Escape") { selectedMessageId = ""; syncSelection(); }
  });
  let marking = false;
  const active = () => panel.isConnected && !panel.closest("[hidden]");
  let contactsLoading = false;
  let answeringContact = false;
  let contactMarkup = null;
  const refreshContacts = async () => {
    if (contactsLoading || answeringContact || !active() || document.hidden) return;
    contactsLoading = true;
    try {
      const data = await getEventLiveData(eventId);
      if (!active() || answeringContact) return;
      const selfId = data.profile?.contactId || viewerId;
      const incoming = (data.requests || []).find(item => item.senderContactId === peerId && item.receiverContactId === selfId);
      const outgoing = (data.requests || []).find(item => item.senderContactId === selfId && item.receiverContactId === peerId);
      const parts = [];
      if (incoming?.status === "pending") {
        parts.push(`<p><strong>${escapeHtml(incoming.senderName || peerName)}</strong> hat um Ihre Kontaktdaten gebeten. Versenden?</p><div class="actions"><button type="button" class="button button--primary" data-live-request-answer="accepted" data-request-id="${escapeHtml(incoming.id)}">Ja</button><button type="button" class="button button--secondary" data-live-request-answer="rejected" data-request-id="${escapeHtml(incoming.id)}">Nein</button></div>`);
      } else if (incoming) {
        parts.push(`<p>${incoming.status === "accepted" ? "Ihre Kontaktdaten wurden versendet." : "Sie haben die Kontaktanfrage abgelehnt."}</p>`);
      }
      if (outgoing) parts.push(`<p>${outgoing.status === "pending" ? "Ihre Kontaktanfrage wartet auf eine Antwort." : outgoing.status === "accepted" ? "Ihre Kontaktanfrage wurde angenommen. Die Kontaktkarte steht im Chat." : "Ihre Kontaktanfrage wurde abgelehnt."}</p>`);
      const html = parts.join("");
      if (html !== contactMarkup || contactRequest.dataset.error) {
        contactRequest.innerHTML = html;
        contactRequest.hidden = !html;
        contactRequest.dataset.pending = String(incoming?.status === "pending");
        delete contactRequest.dataset.error;
        contactMarkup = html;
      }
      const root = container.closest("[data-event-live-root]");
      const stored = root?.querySelector("[data-event-live-data]");
      if (stored) stored.dataset.eventLiveData = JSON.stringify(data);
    } catch (error) {
      if (active()) {
        contactRequest.hidden = false;
        contactRequest.dataset.error = "true";
        let notice = contactRequest.querySelector("[data-contact-error]");
        if (!notice) { notice = document.createElement("p"); notice.dataset.contactError = ""; contactRequest.append(notice); }
        notice.textContent = error.message || "Kontaktanfragen konnten nicht aktualisiert werden. Neuer Versuch folgt.";
      }
    } finally { contactsLoading = false; }
  };
  contactRequest.addEventListener("click", async event => {
    const button = event.target.closest("[data-live-request-answer]");
    if (!button) return;
    event.stopPropagation();
    if (answeringContact || button.disabled) return;
    answeringContact = true;
    contactRequest.querySelectorAll("button").forEach(control => { control.disabled = true; });
    try {
      await respondEventLiveContact(eventId, button.dataset.requestId, button.dataset.liveRequestAnswer);
      contactMarkup = "";
    } catch (error) {
      if (active()) status.textContent = error.message || "Antwort konnte nicht gespeichert werden.";
    } finally {
      answeringContact = false;
      contactRequest.querySelectorAll("button").forEach(control => { control.disabled = false; });
      await refreshContacts();
      await load();
    }
  });
  const markVisible = async () => {
    if (!active() || document.hidden || marking) return;
    const bounds = list.getBoundingClientRect();
    const visible = [...list.querySelectorAll("[data-chat-incoming]")].filter((element) => {
      const rect = element.getBoundingClientRect();
      const overlap = Math.min(rect.bottom, bounds.bottom, window.innerHeight) - Math.max(rect.top, bounds.top, 0);
      return overlap >= Math.min(rect.height, bounds.height) * 0.8;
    }).at(-1);
    const id = visible?.dataset.chatIncoming;
    if (!id || id === markedId) return;
    marking = true;
    try { await markEventLiveMessagesRead(eventId, peerId, id); markedId = id; }
    catch { /* Retry the receipt on the next visible refresh. */ }
    finally { marking = false; }
  };
  const display = () => {
    const rows = [...records.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    let previousDay = "";
    const html = rows.map((item) => {
      const date = new Date(item.createdAt);
      const valid = Number.isFinite(date.getTime());
      const day = valid ? dayFormat.format(date) : "";
      const separator = day && day !== previousDay ? `<div class="event-live-chat__day">${escapeHtml(dayLabel(date))}</div>` : "";
      previousDay = day;
      return `${separator}<article class="event-live-chat__message${item.self ? " is-self" : ""}" ${item.self ? `data-read="${Boolean(item.read || item.deleted)}"` : `data-chat-incoming="${escapeHtml(item.id)}"`}><p>${escapeHtml(item.deleted ? "Nachricht gelöscht" : item.text)}</p>${chatAttachmentMarkup(item)}${!item.deleted && item.contactCard ? `<div class="event-live-chat__contact-card"><strong>${escapeHtml(item.contactCard.name || "")}</strong><span>${escapeHtml([item.contactCard.position, item.contactCard.company].filter(Boolean).join(" · "))}</span>${contactDetailsMarkup(item.contactCard)}<img src="${escapeHtml(item.contactCard.qrCode)}" alt="QR-Code zum Importieren der Kontaktdaten" width="240" height="240"><a download="kontakt.vcf" href="data:text/vcard;charset=utf-8,${encodeURIComponent(item.contactCard.vcard)}">Kontakt speichern</a></div>` : ""}<footer><time datetime="${escapeHtml(item.createdAt)}">${valid ? timeFormat.format(date) : ""}</time>${item.self && !item.deleted ? `<small class="event-live-chat__receipt"><span class="event-live-delivery" data-delivery="${item.read ? "read" : "delivered"}" role="img" aria-label="${item.read ? "Gelesen" : "Im Chat zugestellt"}" title="${item.read ? "Gelesen" : "Im Chat zugestellt"}">${item.read ? "✓✓" : "✓"}</span></small>${!item.read ? `<button type="button" data-chat-delete="${escapeHtml(item.id)}" title="Ungelesene Nachricht löschen">Löschen</button>` : ""}` : ""}</footer></article>`;
    }).join("") || `<p class="event-live-muted">Noch keine Nachrichten.</p>`;
    if (html === lastMarkup) return;
    const atBottom = list.scrollHeight - list.clientHeight - list.scrollTop < 70;
    list.innerHTML = html;
    list.querySelectorAll("[data-chat-delete]").forEach((button) => {
      const item = records.get(button.dataset.chatDelete);
      if (item?.pending || item?.failed) {
        const receipt = button.closest("article").querySelector(".event-live-chat__receipt");
        if (receipt) receipt.textContent = item.failed ? "Nicht gesendet" : "Wird gesendet ...";
        button.remove();
        return;
      }
      button.setAttribute("aria-label", "Ungelesene Nachricht löschen");
      // Lucide Trash2 icon; keep the action separate from message selection.
      button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>';
      button.closest("article").tabIndex = 0;
    });
    syncSelection();
    lastMarkup = html;
    if (atBottom) list.scrollTop = list.scrollHeight;
  };
  const load = async (previous = false) => {
    if (loading || !active() || document.hidden) return;
    loading = true;
    older.disabled = true;
    try {
      const result = await getEventLiveMessages(eventId, peerId, previous ? oldestId : "");
      if (!active()) return;
      const oldHeight = list.scrollHeight;
      if (resetAt !== undefined && resetAt !== result.resetAt) { records.clear(); oldestId = ""; markedId = ""; }
      resetAt = result.resetAt;
      result.messages.forEach((item) => records.set(item.id, item));
      if (previous || !oldestId) {
        oldestId = result.oldestId;
        older.hidden = !result.hasMore;
      }
      display();
      if (previous) list.scrollTop += list.scrollHeight - oldHeight;
      window.requestAnimationFrame(markVisible);
      if (!form.querySelector("button[type=submit]").disabled) status.textContent = "";
    } catch (error) {
      if (active()) status.textContent = error.message || "Nachrichten konnten nicht geladen werden.";
    } finally { loading = false; older.disabled = false; }
  };
  older.addEventListener("click", () => load(true));
  list.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-chat-delete]");
    if (!button || button.disabled || !window.confirm("Diese ungelesene Nachricht für beide Personen löschen?")) return;
    button.disabled = true;
    try {
      await deleteEventLiveMessage(eventId, peerId, button.dataset.chatDelete);
      const item = records.get(button.dataset.chatDelete);
      if (item) records.set(item.id, { ...item, text: "Nachricht gelöscht", deleted: true });
      display();
      status.textContent = "Nachricht gelöscht.";
    } catch (error) { status.textContent = error.message || "Löschen fehlgeschlagen."; button.disabled = false; }
  });
  list.addEventListener("scroll", markVisible, { passive: true });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = field.value.trim();
    const button = form.querySelector("button[type=submit]");
    if (!text || button.disabled) return;
    if (!pendingSend || pendingSend.text !== text) pendingSend = { text, id: crypto.randomUUID() };
    button.disabled = true;
    field.disabled = true;
    button.textContent = "…";
    status.textContent = "Nachricht wird gesendet ...";
    const sending = pendingSend;
    records.set(sending.id, { id: sending.id, text, self: true, read: false, pending: true, createdAt: new Date().toISOString() });
    lastMarkup = "";
    display();
    list.scrollTop = list.scrollHeight;
    try {
      await sendEventLiveMessage(eventId, peerId, text, sending.id);
      if (!active()) return;
      const stored = records.get(sending.id);
      if (stored) records.set(sending.id, { ...stored, pending: false, failed: false });
      lastMarkup = "";
      display();
      pendingSend = null;
      field.value = "";
      fitComposer();
      drafts.delete(draftKey);
      load();
      status.textContent = "";
      list.scrollTop = list.scrollHeight;
    } catch (error) {
      if (active()) {
        const item = records.get(sending.id);
        if (item) records.set(sending.id, { ...item, pending: false, failed: true });
        lastMarkup = "";
        display();
        status.textContent = error.message || "Senden fehlgeschlagen. Bitte erneut versuchen.";
      }
    } finally {
      button.disabled = false;
      field.disabled = false;
      button.textContent = "↑";
    }
  });
  mountChatAttachments({form,list,eventId,peerId,status,canSend:()=>canSend,
    contacts:()=>[{contactId:peerId,displayName:peerName}],onSent:()=>load(),onContactSent:refreshContacts});
  load();
  refreshContacts();
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { load(); refreshContacts(); } }, { signal: selectionEvents.signal });
  container.addEventListener("event-chat-visible", () => { load(); refreshContacts(); }, { signal: selectionEvents.signal });
  const contactTimer = window.setInterval(() => { if (!panel.isConnected) window.clearInterval(contactTimer); else refreshContacts(); }, 5000);
  const timer = window.setInterval(() => {
    if (!panel.isConnected) { window.clearInterval(timer); window.clearInterval(contactTimer); selectionEvents.abort(); return; }
    load();
    markVisible();
  }, 2000);
}
