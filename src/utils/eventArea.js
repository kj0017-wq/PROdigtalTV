import { escapeHtml, richTextHtml } from "./format.js";

export function participantContactAction(data, person) {
  const own = data.profile?.contactId;
  const peer = person.contactId;
  if (!peer || peer === own || person.self) return "";
  const outgoing = (data.requests || []).find(item => item.senderContactId === own && item.receiverContactId === peer);
  const incoming = (data.requests || []).find(item => item.senderContactId === peer && item.receiverContactId === own);
  const available = outgoing?.status === "accepted";
  const label = available ? "Kontaktdaten abrufen" : incoming?.status === "pending" ? "Anfrage beantworten" : outgoing?.status === "pending" ? "Anfrage gesendet" : outgoing?.status === "rejected" ? "Anfrage abgelehnt" : "Kontaktdaten anfragen";
  const open = available || incoming?.status === "pending";
  const disabled = !open && ["pending", "rejected"].includes(outgoing?.status);
  const state = available ? "ready" : incoming?.status === "pending" ? "incoming" : outgoing?.status || "none";
  return `<div class="event-area-contact-action" data-contact-state="${state}"><button type="button" class="button button--secondary button--small" ${disabled ? "disabled" : `${available ? "data-live-contact-card" : open ? "data-live-contact-open" : "data-live-contact-request"}="${escapeHtml(peer)}"`}>${label}</button>${available ? '<small>Freigegeben · abrufbereit</small>' : ""}</div>`;
}

export function agendaMarkup(event = {}) {
  const items = Array.isArray(event.scheduleItems) ? event.scheduleItems : [];
  const text = event.agendaText || "";
  return `<h2>Agenda</h2>${items.length ? `<ol class="event-area-agenda">${items.map((item, index) => {
    const personName = String(item.person || "").trim();
    const person = personName && !/^programmpunkt$/i.test(personName) ? `<p>${escapeHtml(personName)}</p>` : "";
    if (item.isTalk || item.description) {
      const speakerLinks = (item.speakerLinks || []).filter(link => String(link.href || "").startsWith("#/speaker/"))
        .map(link => `<a href="${escapeHtml(link.href)}">${escapeHtml(link.name)}</a>`).join(", ");
      const key = escapeHtml(item.topicId || `${index}:${item.time}:${item.title}`);
      return `<li class="event-area-agenda__talk"><details class="event-agenda-card" data-agenda-card="${key}"><summary><time>${escapeHtml(item.time || "")}</time><span class="event-agenda-card__heading"><strong>${escapeHtml(item.title || "")}</strong>${person}</span><span class="event-agenda-card__chevron" aria-hidden="true">⌄</span></summary><div class="event-agenda-card__description">${richTextHtml(item.description || "", '<p>Die Vortragsbeschreibung wird noch ergänzt.</p>')}${speakerLinks ? `<p>Referentenprofile: ${speakerLinks}</p>` : ""}</div></details></li>`;
    }
    return `<li><time>${escapeHtml(item.time || "")}</time><div><strong>${escapeHtml(item.title || "")}</strong>${person}</div></li>`;
  }).join("")}</ol>` : `<p class="event-area-program">${escapeHtml(text || "Das Programm wird noch ergänzt.")}</p>`}`;
}

export function mountEventArea(root, data) {
  if (!root) return;
  let nav = root.querySelector("[data-event-area-nav]");
  if (!nav) {
    root.querySelector(".event-live-hero").insertAdjacentHTML("afterend", `<nav class="tabs" data-event-area-nav aria-label="Veranstaltungsbereich">${[["agenda", "Agenda"], ["participants", "Teilnehmer"], ["chat", "Chat"]].map(([key, label]) => `<button type="button" data-event-area="${key}" aria-pressed="false">${label}</button>`).join("")}<button type="button" data-event-photo-open aria-haspopup="dialog">Event Fotos <span class="participant-photo-badge" data-participant-photo-badge="${escapeHtml(root.dataset.eventId)}" hidden></span></button></nav><section data-event-area-agenda></section><p data-event-area-empty hidden>Noch keine Gespräche. <button type="button" class="button button--secondary" data-event-area="participants">Teilnehmer öffnen</button></p>`);
    nav = root.querySelector("[data-event-area-nav]");
    root.addEventListener("click", event => {
      const button = event.target.closest("[data-event-area]");
      if (!button || button === root) return;
      root.dataset.eventArea = button.dataset.eventArea;
      const [path, query = ""] = location.hash.split("?");
      const params = new URLSearchParams(query);
      params.set("area", root.dataset.eventArea);
      params.delete("peer");
      history.replaceState(null, "", `${location.pathname}${location.search}${path}?${params}`);
      mountEventArea(root, JSON.parse(root.querySelector("[data-event-live-data]").dataset.eventLiveData));
    });
  }
  const params = new URLSearchParams(location.hash.split("?")[1] || "");
  const requested = root.dataset.eventArea || (params.get("peer") ? "chat" : params.get("area"));
  const area = ["agenda", "participants", "chat"].includes(requested) ? requested : "agenda";
  root.dataset.eventArea = area;
  const agenda = root.querySelector("[data-event-area-agenda]");
  const openedCards = new Set([...agenda.querySelectorAll("[data-agenda-card][open]")].map(card => card.dataset.agendaCard));
  agenda.innerHTML = agendaMarkup(data.event);
  agenda.querySelectorAll("[data-agenda-card]").forEach(card => { card.open = openedCards.has(card.dataset.agendaCard); });
  root.querySelector("[data-event-area-agenda]").hidden = area !== "agenda";
  root.querySelector(".event-live-roster").hidden = area === "agenda";
  root.querySelectorAll(".event-live-requests").forEach(node => { node.hidden = area === "agenda"; });
  let visibleChats = 0;
  root.querySelectorAll(".event-live-roster [data-live-person]").forEach(node => {
    const show = area !== "chat" || node.dataset.livePerson !== data.profile?.contactId;
    node.hidden = !show;
    const row = node.closest("[data-live-person-row]");
    if (row) row.hidden = !show;
    if (area === "chat" && show) visibleChats++;
    node.dataset.liveOpenChat = area === "chat" && node.dataset.livePerson !== data.profile?.contactId ? "1" : "0";
    const person = (data.participants || []).find(item => item.contactId === node.dataset.livePerson) || {};
    node.setAttribute("aria-label", `${area === "chat" ? "Chat mit" : "Profil von"} ${person.displayName || [person.firstName, person.lastName].filter(Boolean).join(" ")} öffnen`);
    node.querySelector(".event-area-chat-time")?.remove();
    const conversation = (data.conversations || []).find(item => item.peerId === node.dataset.livePerson);
    if (area === "chat" && conversation?.lastMessageAt) {
      const date = new Date(conversation.lastMessageAt);
      if (Number.isFinite(date.getTime())) {
        const time = document.createElement("time");
        time.className = "event-area-chat-time";
        time.dateTime = date.toISOString();
        time.textContent = new Intl.DateTimeFormat("de-DE", date.toDateString() === new Date().toDateString() ? { hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "2-digit" }).format(date);
        node.append(time);
      }
    }
  });
  root.querySelector("[data-event-area-empty]").hidden = area !== "chat" || visibleChats > 0;
  const unread = (data.conversations || []).reduce((sum, item) => sum + (Number(item.unreadCount) || (item.unread ? 1 : 0)), 0);
  nav.querySelectorAll("[data-event-area]").forEach(button => {
    button.classList.toggle("active", button.dataset.eventArea === area);
    button.setAttribute("aria-pressed", String(button.dataset.eventArea === area));
    if (button.dataset.eventArea === "chat") button.innerHTML = `Chat${unread ? ` <span class="event-area-badge">${unread}</span>` : ""}`;
  });
}
