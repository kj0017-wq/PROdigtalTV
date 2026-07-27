import { accessLabels } from "../data/platformConstants.js";
import { eventDateBox, escapeHtml, formatDate } from "../utils/format.js";
import { liveImageAttrs, stableImageUrl } from "../utils/imageUrls.js?v=1";

export function eventCard(event, archive = false, partners = []) {
  const date = eventDateBox(event.date);
  const host = partners.find((partner) => partner.id === event.hostId);
  const eventSponsors = partners.filter((partner) => event.sponsorIds?.includes(partner.id));
  const promotedPartners = [host, ...eventSponsors]
    .filter(Boolean)
    .filter((partner, index, list) => list.findIndex((entry) => entry.id === partner.id) === index);
  const hasDistinctSponsors = eventSponsors.some((partner) => partner.id !== host?.id);
  const imageUrl = stableImageUrl(event.imageDisplayUrl || event.imageUrl || "", "event");
  const storedTicket = event.storedTicket || null;
  const summary = event.subtitle || event.shortDescription || event.description || "";
  const imageStyle = imageUrl ? ` style="--event-card-image:url(&quot;${escapeHtml(imageUrl)}&quot;)"` : "";
  return `<article class="card event-card ${imageUrl ? "event-card--with-image" : ""}"${imageStyle}>
    <div class="event-card__visual ${archive ? "event-card__visual--archive" : ""}">
      ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="Eventbild ${escapeHtml(event.title)}" loading="lazy" decoding="async" ${liveImageAttrs("event")}>` : `<span class="event-card__placeholder">${escapeHtml(event.eventType || "Event")}</span>`}
      <div class="next-event__date"><strong>${date.day}</strong><span>${date.month}</span></div>
      <span class="tag tag--light">${escapeHtml(event.eventType)}</span>
    </div>
    <div class="card__body">
      <span class="tag ${event.accessType !== "public" ? "tag--red" : ""}">${accessLabels[event.accessType]}</span>
      ${storedTicket ? `<div class="event-ticket-status"><span class="event-ticket-status__icon" aria-hidden="true"></span><div><strong>Handy-Ticket aktiv</strong><span>${escapeHtml([storedTicket.firstName, storedTicket.lastName].filter(Boolean).join(" ") || "Dieses Geraet")}</span></div></div>` : ""}
      <h3>${escapeHtml(event.title)}</h3>
      ${summary ? `<p class="event-card__summary">${escapeHtml(summary)}</p>` : ""}
      <div class="event-meta"><span>${formatDate(event.date)}${event.startTime ? ` - ${event.startTime} Uhr` : ""}</span></div>
      <div class="event-showcase">
        <div class="event-showcase__fact"><small>Veranstaltungsort</small><strong>${escapeHtml(event.locationName)}</strong><span>${escapeHtml(event.city)}</span></div>
        ${promotedPartners.length ? `<div class="event-showcase__fact event-showcase__fact--partner"><small>${hasDistinctSponsors ? "Gastgeber / Sponsor" : "Gastgeber"}</small><strong>${escapeHtml(promotedPartners.map((partner) => partner.name).join(" - "))}</strong></div>` : ""}
      </div>
      ${archive ? "" : `<a class="event-card__cta" href="#/event/${event.id}">Zur Veranstaltung</a>`}
    </div>
  </article>`;
}

export function topicCard(topic) {
  const imageUrl = topic.imageUrl || "";
  return `<a class="card topic-card" href="#/topic/${topic.id}">
    ${imageUrl ? `<figure class="topic-card__image"><img src="${escapeHtml(imageUrl)}" alt="Themenbild ${escapeHtml(topic.title)}" loading="lazy" decoding="async" ${liveImageAttrs("topic")}></figure>` : `<span class="quick-card__icon">${escapeHtml(topic.icon)}</span>`}
    <h3>${escapeHtml(topic.title)}</h3><div class="topic-card__line"></div>
    <p>${escapeHtml(topic.shortDescription)}</p>
  </a>`;
}
