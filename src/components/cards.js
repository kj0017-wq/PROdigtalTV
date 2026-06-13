import { accessLabels } from "../data/demoData.js";
import { eventDateBox, escapeHtml, formatDate } from "../utils/format.js";

export function eventCard(event, archive = false, partners = []) {
  const date = eventDateBox(event.date);
  const host = partners.find((partner) => partner.id === event.hostId);
  const eventSponsors = partners.filter((partner) => event.sponsorIds?.includes(partner.id));
  const promotedPartners = [host, ...eventSponsors].filter(Boolean);
  const imageUrl = event.imageDisplayUrl || event.imageUrl || "";
  return `<article class="card event-card">
    <div class="event-card__visual ${archive ? "event-card__visual--archive" : ""}">
      ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="Eventbild ${escapeHtml(event.title)}">` : ""}
      <div class="next-event__date"><strong>${date.day}</strong><span>${date.month}</span></div>
      <span class="tag tag--light">${escapeHtml(event.eventType)}</span>
    </div>
    <div class="card__body">
      <span class="tag ${event.accessType !== "public" ? "tag--red" : ""}">${accessLabels[event.accessType]}</span>
      <h3>${escapeHtml(event.title)}</h3>
      <p>${escapeHtml(event.subtitle)}</p>
      <div class="event-meta"><span>${formatDate(event.date)}${event.startTime ? ` · ${event.startTime} Uhr` : ""}</span></div>
      <div class="event-showcase">
        <div class="event-showcase__fact"><small>Veranstaltungsort</small><strong>${escapeHtml(event.locationName)}</strong><span>${escapeHtml(event.city)}</span></div>
        ${promotedPartners.length ? `<div class="event-showcase__fact event-showcase__fact--partner"><small>${eventSponsors.length ? "Gastgeber / Sponsor" : "Gastgeber"}</small><strong>${escapeHtml(promotedPartners.map((partner) => partner.name).join(" · "))}</strong></div>` : ""}
      </div>
      ${archive ? "" : `<a class="link" href="#/event/${event.id}">Eventdetails ansehen →</a>`}
    </div>
  </article>`;
}

export function topicCard(topic) {
  return `<a class="card topic-card" href="#/topic/${topic.id}">
    ${topic.imageUrl ? `<figure class="topic-card__image"><img src="${escapeHtml(topic.imageUrl)}" alt="Themenbild ${escapeHtml(topic.title)}"></figure>` : `<span class="quick-card__icon">${escapeHtml(topic.icon)}</span>`}
    <h3>${escapeHtml(topic.title)}</h3><div class="topic-card__line"></div>
    <p>${escapeHtml(topic.shortDescription)}</p>
  </a>`;
}
