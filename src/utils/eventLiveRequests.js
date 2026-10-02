import { escapeHtml, initials } from "./format.js?v=3";

export function eventLiveConnection(data, peerId) {
  if ((data.conversations || []).some((item) => item.peerId === peerId && item.unread)) return { state: "message", label: "Neue Nachricht" };
  const own = data.profile?.contactId;
  const outgoing = (data.requests || []).find((item) => item.senderContactId === own && item.receiverContactId === peerId);
  const incoming = (data.requests || []).find((item) => item.receiverContactId === own && item.senderContactId === peerId);
  if (outgoing?.status === "accepted" || incoming?.status === "accepted") return { state: "accepted", label: "Kontakt freigegeben" };
  if (incoming?.status === "pending") return { state: "incoming", label: "Kontaktanfrage erhalten" };
  if (outgoing?.status === "pending") return { state: "outgoing", label: "Anfrage gesendet" };
  if (outgoing?.status === "rejected" || incoming?.status === "rejected") return { state: "rejected", label: "Anfrage abgelehnt" };
  return { state: "none", label: "" };
}

export function eventLiveInboxMarkup(data) {
  const items = [...(data.conversations || [])].sort((a, b) => (b.lastMessageAt || "").localeCompare(a.lastMessageAt || ""));
  return `<h2>Nachrichten</h2><button type="button" data-live-refresh>Aktualisieren</button><div role="status" data-live-refresh-result></div>${items.length ? items.map((item) => {
    const person = (data.participants || []).find((entry) => entry.contactId === item.peerId);
    const highlighted = item.unread || (item.lastMessageSelf && !item.lastMessageRead);
    const receipt = item.lastMessageSelf ? item.lastMessageRead ? "Du · Gelesen" : "Du · Ungelesen" : item.unread ? "Neue Nachricht" : "Gelesen";
    const name = person?.displayName || [person?.firstName, person?.lastName].filter(Boolean).join(" ") || "Teilnehmende Person";
    const date = new Date(item.lastMessageAt);
    let time = "";
    if (Number.isFinite(date.getTime())) {
      const day = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short" });
      const now = new Date();
      const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
      time = day.format(date) === day.format(now) ? new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" }).format(date)
        : day.format(date) === day.format(yesterday) ? "Gestern" : day.format(date);
    }
    const avatar = person?.photoUrl ? `<img src="${escapeHtml(person.photoUrl)}" alt="" loading="lazy">` : `<span aria-hidden="true">${escapeHtml(initials(name))}</span>`;
    const contents = `<span class="event-live-conversation__avatar">${avatar}</span><span class="event-live-conversation__body"><span class="event-live-conversation__heading"><strong>${escapeHtml(name)}</strong><time datetime="${escapeHtml(item.lastMessageAt || "")}" title="${escapeHtml(eventLiveRequestTime(item.lastMessageAt))}">${escapeHtml(time)}</time></span><span class="event-live-conversation__preview">${item.lastMessageSelf ? "Du: " : ""}${escapeHtml(item.lastText || "")}</span><small class="event-live-conversation__receipt">${receipt}</small></span>`;
    return person ? `<button type="button" class="event-live-conversation" data-live-person="${escapeHtml(item.peerId)}" data-live-open-chat="1" data-unread="${Boolean(highlighted)}">${contents}</button>` : `<div class="event-live-conversation">${contents}</div>`;
  }).join("") : `<p class="event-live-muted">Noch keine Nachrichten.</p>`}`;
}

export function eventLiveRequestTime(value) {
  if (value == null || value === "") return "";
  const seconds = value?.seconds ?? value?._seconds;
  const date = typeof value?.toDate === "function" ? value.toDate()
    : new Date(seconds != null ? Number(seconds) * 1000 : value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short"
  }).format(date);
}

export function eventLiveRequestMeta(item) {
  if (!item) return "";
  const requested = eventLiveRequestTime(item.requestedAt);
  const delivered = item.deliveryChannel === "event_live" ? eventLiveRequestTime(item.deliveredAt) : "";
  const answered = eventLiveRequestTime(item.answeredAt);
  const lines = [
    requested ? `Angefragt: ${requested}` : "Anfragezeitpunkt nicht hinterlegt",
    delivered ? `Bereitgestellt: ${delivered} · Event Chat → Kontakte` : "Zustellweg: Event Chat → Kontakte",
    answered ? `${item.status === "accepted" ? "Freigegeben" : "Beantwortet"}: ${answered}` : ""
  ].filter(Boolean);
  return lines.map((line) => `<small class="event-live-muted" style="display:block">${escapeHtml(line)}</small>`).join("");
}
