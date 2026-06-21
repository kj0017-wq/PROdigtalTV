import { accessLabels } from "../data/demoData.js";
import { eventDateBox, escapeHtml, formatDate } from "../utils/format.js";
import { imageFallbackAttrs, stableImageUrl } from "../utils/imageFallbacks.js?v=1";

export function eventCard(event, archive = false, partners = []) {
  const date = eventDateBox(event.date);
  const host = partners.find((partner) => partner.id === event.hostId);
  const eventSponsors = partners.filter((partner) => event.sponsorIds?.includes(partner.id));
  const promotedPartners = [host, ...eventSponsors].filter(Boolean);
  const imageUrl = stableImageUrl(event.imageDisplayUrl || event.imageUrl || "", "event");
  return `<article class="card event-card">
    <div class="event-card__visual ${archive ? "event-card__visual--archive" : ""}">
      <img src="${escapeHtml(imageUrl)}" alt="Eventbild ${escapeHtml(event.title)}" loading="lazy" decoding="async" ${imageFallbackAttrs("event")}>
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
  const imageUrl = topic.imageUrl || "";
  return `<a class="card topic-card" href="#/topic/${topic.id}">
    ${imageUrl ? `<figure class="topic-card__image"><img src="${escapeHtml(imageUrl)}" alt="Themenbild ${escapeHtml(topic.title)}" loading="lazy" decoding="async" ${imageFallbackAttrs("topic")}></figure>` : `<span class="quick-card__icon">${escapeHtml(topic.icon)}</span>`}
    <h3>${escapeHtml(topic.title)}</h3><div class="topic-card__line"></div>
    <p>${escapeHtml(topic.shortDescription)}</p>
  </a>`;
}
