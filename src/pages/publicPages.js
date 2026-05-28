import { listPublicEvents, listPublicContent, getOne } from "../firebase/dataService.js";
import { currentUser, isMember } from "../firebase/authService.js";
import { firebaseEnabled } from "../firebase/firebaseClient.js";
import { publicShell, logo } from "../components/layout.js";
import { eventCard, topicCard } from "../components/cards.js";
import { accessLabels, lifecycleLabels } from "../data/demoData.js";
import { escapeHtml, formatDate, initials } from "../utils/format.js";

function subhero(eyebrow, title, text) {
  return `<section class="subhero"><div class="container"><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p>${text}</p></div></section>`;
}

function memberLogo(member) {
  return member.logoUrl
    ? `<img class="member-logo" src="${escapeHtml(member.logoUrl)}" alt="Logo ${escapeHtml(member.name)}">`
    : escapeHtml(member.name);
}

function boardPortrait(person) {
  return person.photoUrl
    ? `<img src="${escapeHtml(person.photoUrl)}" alt="Portraet ${escapeHtml(person.name)}">`
    : initials(person.name);
}

function speakerPortrait(speaker) {
  return speaker.photoUrl
    ? `<img src="${escapeHtml(speaker.photoUrl)}" alt="Portraet ${escapeHtml(speaker.name)}">`
    : `<span class="avatar">${initials(speaker.name)}</span>`;
}

function archiveArticle(event, partners = []) {
  const host = partners.find((partner) => partner.id === event.hostId);
  const dateLabel = event.displayDate || formatDate(event.date);
  return `<article class="archive-article">
    ${event.imageUrl ? `<figure class="archive-article__image"><img src="${escapeHtml(event.imageUrl)}" alt="Rueckblick ${escapeHtml(event.title)}"></figure>` : `<div class="archive-article__placeholder"><span>${escapeHtml(event.eventType || "Archiv")}</span></div>`}
    <div class="archive-article__body">
      <p class="eyebrow">${escapeHtml(dateLabel)}${event.city ? ` · ${escapeHtml(event.city)}` : ""}</p>
      <h2>${escapeHtml(event.title)}</h2>
      <p class="archive-article__meta">${escapeHtml(event.locationName || "Ort nicht angegeben")}${host ? ` · Gastgeber: ${escapeHtml(host.name)}` : ""}</p>
      <p>${escapeHtml(event.postEventSummary || event.description)}</p>
    </div>
  </article>`;
}

function articleParagraphs(text = "") {
  return text.split(/\n+/).filter(Boolean).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
}

function ttsReader({ title = "", audioUrl = "" }) {
  if (!audioUrl) return "";
  return `<div class="tts-reader" data-tts-reader>
    <p class="eyebrow">Audio</p>
    <strong>${escapeHtml(title || "Artikel vorlesen")}</strong>
    <audio controls preload="none" src="${escapeHtml(audioUrl)}"></audio>
  </div>`;
}

function teaserText(value = "", length = 118) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, Math.max(0, length - 3))}...` : text;
}

function downloadUrl(item = {}, fallback = "#/downloads") {
  return item.documentUrl || item.assetUrl || item.fileUrl || fallback;
}

function downloadCard(item) {
  const url = downloadUrl(item);
  const active = url !== "#/downloads";
  return `<a class="quick-card download-card" href="${escapeHtml(url)}" ${active ? `target="_blank" rel="noreferrer"` : ""}>
    <p class="eyebrow">${escapeHtml(item.category || "Download")}</p>
    <h3>${escapeHtml(item.title || item.fileName || "Download")}</h3>
    <p>${escapeHtml(item.description || item.bodyText || item.fileName || "PDF wird oeffentlich bereitgestellt.")}</p>
  </a>`;
}

function eventExpires(event) {
  if (!event.expiresAt) return false;
  return new Date(event.expiresAt).getTime() <= Date.now();
}

function isPastEvent(event) {
  return event.lifecyclePhase === "archive_published" || event.lifecyclePhase === "post_processing" || eventExpires(event) || (event.date && event.date < "2026-05-26");
}

export async function homePage() {
  const [events, topics, members, editorial, sponsors] = await Promise.all([listPublicEvents(), listPublicContent("topics"), listPublicContent("members"), listPublicContent("editorialContent"), listPublicContent("sponsors")]);
  const upcoming = events.filter((event) => !isPastEvent(event) && event.visibility === "public").sort((a, b) => a.date.localeCompare(b.date));
  const next = upcoming[0];
  const hero = editorial.find((content) => content.key === "home.hero") || {
    title: "Die Zukunft digitaler Medien gemeinsam gestalten.",
    subtitle: "PROdigitalTV verbindet Entscheider, Impulsgeber und Unternehmen der digitalen Medienwirtschaft.",
    teaserText: "PROdigitalTV",
    buttonText: next ? "Naechstes Event" : "Events entdecken",
    buttonUrl: next ? `#/event/${next.id}` : "#/events",
    secondaryButtonText: "Mitglied werden",
    secondaryButtonUrl: "#/join"
  };
  const primaryButtonText = hero.buttonText || (next ? "Naechstes Event" : "Events entdecken");
  const primaryButtonUrl = hero.buttonUrl || (next ? `#/event/${next.id}` : "#/events");
  const secondaryButtonText = hero.secondaryButtonText || "Mitglied werden";
  const secondaryButtonUrl = hero.secondaryButtonUrl || "#/join";
  const latestNews = editorial
    .filter((content) => content.page === "news" && content.status === "published")
    .sort((a, b) => String(b.publishDate || b.validFrom || b.updatedAt || "").localeCompare(String(a.publishDate || a.validFrom || a.updatedAt || "")))[0];
  const featuredTopic = topics[0];
  const homeTopics = topics.filter((topic) => topic.id !== featuredTopic?.id).slice(0, 3);
  const aboutIntro = editorial.find((content) => content.id === "about-intro" || content.key === "about.intro");
  const featuredMember = members.find((member) => member.featured) || members[0];
  const quickCards = [
    {
      eyebrow: "News",
      title: latestNews?.title || "Aktuelles von PROdigitalTV",
      text: teaserText(latestNews?.subtitle || latestNews?.introText || latestNews?.shortText || latestNews?.bodyText || "Meldungen, Hinweise und Neuigkeiten aus dem Verein und der digitalen Medienwirtschaft.", 118),
      url: latestNews ? `#/news/${latestNews.id}` : "#/news",
      link: latestNews ? "News lesen" : "Alle News"
    },
    {
      eyebrow: "Thema",
      title: featuredTopic?.title || "Branchenagenda",
      text: teaserText(featuredTopic?.longDescription || featuredTopic?.articleText || featuredTopic?.shortDescription || "Strategische Themen fuer digitale Medien, Distribution und Vermarktung.", 190),
      url: featuredTopic ? `#/topic/${featuredTopic.id}` : "#/topics",
      link: featuredTopic ? "Thema lesen" : "Themen ansehen"
    },
    {
      eyebrow: "Verein",
      title: aboutIntro?.title || "Ueber PROdigitalTV",
      text: teaserText(aboutIntro?.introText || aboutIntro?.bodyText || "Das Netzwerk verbindet Entscheider, Impulsgeber und Unternehmen der digitalen Medienwirtschaft.", 118),
      url: "#/about",
      link: "Mehr erfahren"
    },
    {
      eyebrow: "Netzwerk",
      title: featuredMember?.name || `${members.length || 35}+ Mitglieder`,
      text: featuredMember ? `${members.length || "Viele"} Unternehmen im Netzwerk. Beispiel: ${teaserText(featuredMember.description || featuredMember.city || "Mitgliedsunternehmen", 82)}` : "Unternehmen aus Medien, Technologie, Distribution und Vermarktung im gemeinsamen Austausch.",
      url: "#/members",
      link: "Mitglieder ansehen"
    }
  ];
  return publicShell("home", `
    <section class="hero"><div class="container hero__grid">
      <div><p class="eyebrow">${escapeHtml(hero.teaserText || "PROdigitalTV")}</p><h1>${escapeHtml(hero.title)}</h1><p class="lead">${escapeHtml(hero.subtitle)}</p>
        <div class="hero__buttons"><a class="button button--primary" href="${escapeHtml(primaryButtonUrl)}">${escapeHtml(primaryButtonText)}</a><a class="button button--secondary" href="${escapeHtml(secondaryButtonUrl)}">${escapeHtml(secondaryButtonText)}</a></div>
      </div>
      <article class="next-event"><p class="eyebrow">Naechstes Event</p>${next ? `<h2>${escapeHtml(next.title)}</h2><p>${formatDate(next.date)} · ${next.city}</p><p style="margin:18px 0">${escapeHtml(next.subtitle)}</p><a class="button button--primary button--small" href="#/register/${next.id}">Jetzt anmelden</a>` : `<h2>Neue Termine in Vorbereitung</h2><p>Unsere naechsten Formate werden in Kuerze veroeffentlicht.</p>`}</article>
    </div></section>
    <section class="section quick-links-section"><div class="container">
      <div class="quick-grid quick-grid--navigation">
        ${quickCards.map((card, index) => `<a class="quick-card quick-card--navigation" href="${escapeHtml(card.url)}"><span class="quick-card__icon">${String(index + 1).padStart(2, "0")}</span><span class="quick-card__arrow">&rarr;</span><p class="quick-card__eyebrow">${escapeHtml(card.eyebrow)}</p><h3>${escapeHtml(card.title)}</h3><p>${escapeHtml(card.text)}</p><strong>${escapeHtml(card.link)}</strong></a>`).join("")}
      </div>
      <nav class="mobile-sublinks" aria-label="Weitere Informationen"><a href="#/board">Vorstand</a><a href="#/join">Mitglied werden</a><a href="#/archive">Rueckblicke</a></nav>
    </div></section>
    <section class="section section--white"><div class="container"><div class="section-head"><div><p class="eyebrow">Events</p><h2>Kommende Termine</h2></div><a class="link" href="#/events">Alle Events →</a></div>
      ${upcoming.length ? `<div class="card-grid card-grid--three">${upcoming.map((event) => eventCard(event, false, sponsors)).join("")}</div>` : `<div class="alert">Neue Veranstaltungen sind aktuell in Vorbereitung. Entdecken Sie inzwischen unsere Rueckblicke und Netzwerk-Themen.</div>`}
    </div></section>
    <section class="section"><div class="container"><div class="section-head"><div><p class="eyebrow">Agenda</p><h2>Relevante Themen</h2></div></div>
      <div class="card-grid card-grid--three">${homeTopics.map(topicCard).join("")}</div>
    </div></section>
    <section class="section section--white"><div class="container feature"><div><p class="eyebrow">Netzwerk</p><h2>Mehr als 35 Mitgliedsunternehmen.</h2><p class="lead">Mitglieder profitieren von Fachimpulsen, Medienfruehstuecken und relevanten Branchenkontakten.</p></div><div class="member-logos">${members.filter((member) => member.featured).slice(0, 8).map((member) => `<div class="member-tile">${memberLogo(member)}</div>`).join("")}</div></div></section>
  `);
}

export async function eventsPage() {
  const [events, sponsors] = await Promise.all([listPublicEvents(isMember()), listPublicContent("sponsors")]);
  const user = currentUser();
  const visible = events.filter((event) => event.accessType !== "invitation_only" && (event.visibility === "public" || isMember(user) || event.showPublicTeaser));
  const upcoming = visible.filter((event) => !isPastEvent(event));
  return publicShell("events", `${subhero("Veranstaltungen", "Events", "Kuratierte Formate fuer Wissenstransfer, Partnerschaften und relevante Branchenkontakte.")}
    <section class="section"><div class="container"><div class="filters"><button class="filter active">Kommende Events</button><button class="filter">Oeffentlich</button><button class="filter">Mitglieder</button><a class="filter" href="#/archive">Rueckblicke</a></div>
    ${upcoming.length ? `<div class="card-grid card-grid--three">${upcoming.map((event) => eventCard(event, false, sponsors)).join("")}</div>` : `<div class="alert">Aktuell sind keine neuen Termine veroeffentlicht. Im Eventarchiv finden Sie die letzten PROdigitalTV-Veranstaltungen.</div>`}</div></section>`);
}

export async function eventDetailPage(id) {
  let event;
  try {
    event = await getOne("events", id);
  } catch {
    return publicShell("events", `${subhero("Geschuetzter Bereich", "Login erforderlich", "Dieses Event ist nur fuer berechtigte Personen sichtbar.")}<section class="section"><div class="container"><a class="button button--primary" href="#/login">Zum Login</a></div></section>`);
  }
  if (!event) return notFoundPage();
  const [speakers, sponsors, topics, media] = await Promise.all([listPublicContent("speakers"), listPublicContent("sponsors"), listPublicContent("topics"), listPublicContent("eventMedia")]);
  const restricted = event.accessType === "members_only" && !isMember();
  if (restricted && !event.showPublicTeaser) return publicShell("events", subhero("Geschuetzter Bereich", "Nur fuer Mitglieder", "Bitte melden Sie sich an, um dieses Event zu sehen."));
  const assignedTopics = topics.filter((topic) => event.topicIds.includes(topic.id));
  const assignedSpeakers = speakers.filter((speaker) => event.speakerIds.includes(speaker.id));
  const eventPartners = sponsors.filter((sponsor) => event.sponsorIds.includes(sponsor.id) || event.hostId === sponsor.id);
  const approvedMedia = media.filter((item) => item.eventId === event.id && item.status === "approved" && item.visibility === "public");
  const registrationAllowed = event.registrationEnabled && (!restricted || isMember());
  return publicShell("events", `${subhero(event.eventType, event.title, event.subtitle)}
    <section class="section"><div class="container detail-grid">
      <article class="detail-main">
        ${event.imageUrl ? `<figure class="event-detail-image"><img src="${escapeHtml(event.imageUrl)}" alt="Eventbild ${escapeHtml(event.title)}"></figure>` : ""}
        ${restricted ? `<div class="alert alert--warning">Details und Anmeldung dieses Mitglieder-Events stehen nach dem Login zur Verfuegung.</div>` : ""}
        <h2>Zum Event</h2><p class="lead">${escapeHtml(event.description)}</p>
        <h2>Themen</h2><div class="filters">${assignedTopics.map((topic) => `<a class="filter" href="#/topic/${topic.id}">${escapeHtml(topic.title)}</a>`).join("")}</div>
        ${event.lunchNote ? `<div class="alert">${escapeHtml(event.lunchNote)}</div>` : ""}
        ${restricted ? "" : `<section class="venue-stage"><div class="venue-stage__place"><p class="eyebrow">Veranstaltungsort</p><h2>${escapeHtml(event.locationName)}</h2><p>${escapeHtml(event.address || "")}${event.address ? "<br>" : ""}${escapeHtml(event.city)}${event.phone ? `<br>Telefon: ${escapeHtml(event.phone)}` : ""}</p></div><div class="venue-stage__partners"><p class="eyebrow">Gastgeber und Sponsoren</p>${eventPartners.length ? eventPartners.map((partner) => `<article class="partner-spotlight"><span class="avatar">${initials(partner.name)}</span><div><span class="tag tag--red">${escapeHtml(partner.role)}</span><h3>${escapeHtml(partner.name)}</h3>${partner.description ? `<p>${escapeHtml(partner.description)}</p>` : ""}</div></article>`).join("") : `<p>Partner werden bei Bekanntgabe ergaenzt.</p>`}</div></section>
        ${assignedSpeakers.length ? `<h2>Referentinnen und Referenten</h2><div class="speaker-grid">${assignedSpeakers.map((speaker) => `<article class="speaker-profile"><div class="speaker-profile__portrait">${speakerPortrait(speaker)}</div><div class="speaker-profile__body"><h3>${escapeHtml(speaker.name)}</h3><p class="speaker-profile__position">${escapeHtml(speaker.position)}${speaker.company ? ` · ${escapeHtml(speaker.company)}` : ""}</p>${speaker.shortBio ? `<p class="speaker-profile__intro">${escapeHtml(speaker.shortBio)}</p>` : ""}${speaker.longBio ? `<p>${escapeHtml(speaker.longBio)}</p>` : ""}</div></article>`).join("")}</div>` : ""}`}
        ${event.postEventSummary ? `<h2>Nachbericht</h2><p>${escapeHtml(event.postEventSummary)}</p>` : ""}
        ${approvedMedia.length ? `<h2>Fotogalerie</h2><div class="gallery">${approvedMedia.map((item) => `<div class="gallery__image">${escapeHtml(item.title)}</div>`).join("")}</div>` : ""}
      </article>
      <aside class="detail-aside">
        <span class="tag ${event.accessType !== "public" ? "tag--red" : ""}">${accessLabels[event.accessType]}</span>
        <div class="fact"><label>Datum</label><strong>${formatDate(event.date)}</strong></div>
        ${event.startTime ? `<div class="fact"><label>Zeit</label><strong>${event.startTime}${event.endTime ? ` - ${event.endTime}` : ""} Uhr</strong></div>` : ""}
        <div class="fact"><label>Ort</label><strong>${escapeHtml(event.locationName)}<br>${escapeHtml(event.city)}</strong></div>
        ${event.expiresAt ? `<div class="fact"><label>Sichtbar bis</label><strong>${formatDate(event.expiresAt.slice(0, 10))}</strong></div>` : ""}
        <div class="fact"><label>Status</label><strong>${lifecycleLabels[event.lifecyclePhase]}</strong></div>
        ${registrationAllowed ? `<a class="button button--primary" style="width:100%;margin-top:20px" href="#/register/${event.id}">Zum Event anmelden</a>` : `<div class="alert" style="margin-top:20px">${event.accessType === "invitation_only" ? "Teilnahme nur auf Einladung." : "Anmeldung derzeit nicht verfuegbar."}</div>`}
      </aside>
    </div></section>`);
}

export async function registrationPage(id) {
  let event;
  try {
    event = await getOne("events", id);
  } catch {
    return publicShell("events", `${subhero("Anmeldung", "Login erforderlich", "Bitte melden Sie sich an, um die Anmeldung fortzusetzen.")}<section class="section"><div class="container"><a class="button button--primary" href="#/login">Zum Login</a></div></section>`);
  }
  if (!event) return notFoundPage();
  if (event.accessType === "members_only" && !isMember()) {
    return publicShell("events", `${subhero("Anmeldung", "Login erforderlich", "Dieses Event ist exklusiv fuer Mitglieder.")}<section class="section"><div class="container"><a class="button button--primary" href="#/login">Zum Login</a></div></section>`);
  }
  return publicShell("events", `${subhero("Anmeldung", event.title, `${formatDate(event.date)} · ${event.locationName}, ${event.city}`)}
    <section class="section"><div class="container" style="max-width:820px"><form id="registration-form" data-event-id="${event.id}" class="form-card form-grid">
      <div class="alert">Ihre Anmeldung ist erst nach Bestaetigung Ihrer E-Mail-Adresse gueltig.</div>
      <div class="form-grid--two"><div class="field"><label for="firstName">Vorname *</label><input id="firstName" name="firstName" required></div><div class="field"><label for="lastName">Nachname *</label><input id="lastName" name="lastName" required></div></div>
      <div class="form-grid--two"><div class="field"><label for="company">Unternehmen *</label><input id="company" name="company" required></div><div class="field"><label for="position">Position / Funktion *</label><input id="position" name="position" required></div></div>
      <div class="form-grid--two"><div class="field"><label for="email">E-Mail *</label><input id="email" name="email" type="email" required></div><div class="field"><label for="phone">Telefon</label><input id="phone" name="phone"></div></div>
      ${event.invitationCodeRequired ? `<div class="field"><label for="invitationCode">Einladungscode *</label><input id="invitationCode" name="invitationCode" required></div>` : ""}
      <div class="field"><label for="message">Bemerkung</label><textarea id="message" name="message"></textarea></div>
      <label class="checkbox"><input type="checkbox" name="isMember"> Ich bin Mitglied von PROdigitalTV.</label>
      <label class="checkbox"><input type="checkbox" name="photoVideoConsent"> Ich willige in Foto- und Videoaufnahmen des Events ein.</label>
      <label class="checkbox"><input type="checkbox" name="newsletterConsent"> Ich moechte Hinweise zu weiteren Veranstaltungen erhalten.</label>
      <label class="checkbox"><input type="checkbox" name="privacyAccepted" required> Ich akzeptiere die Datenschutzerklaerung zur Verarbeitung meiner Anmeldedaten. *</label>
      <button class="button button--primary" type="submit">Anmeldung absenden</button><div id="form-result"></div>
    </form></div></section>`);
}

export async function topicsPage() {
  const topics = await listPublicContent("topics");
  return publicShell("topics", `${subhero("Themen", "Die Agenda der digitalen Medienwirtschaft.", "PROdigitalTV buendelt relevante Fragestellungen und bringt sie in konkreten Events zur Diskussion.")}
    <section class="section"><div class="container"><div class="card-grid card-grid--three">${topics.map(topicCard).join("")}</div></div></section>`);
}

export async function newsPage() {
  const news = (await listPublicContent("editorialContent"))
    .filter((item) => item.page === "news" || item.section === "news")
    .sort((a, b) => String(b.publishDate || b.validFrom || b.updatedAt || "").localeCompare(String(a.publishDate || a.validFrom || a.updatedAt || "")));
  return publicShell("news", `${subhero("News", "Aktuelles von PROdigitalTV.", "Meldungen, Hinweise und Neuigkeiten aus dem Verein und der digitalen Medienwirtschaft.")}
    <section class="section"><div class="container">${news.length ? `<div class="card-grid card-grid--three">${news.map((item) => `<a class="quick-card news-card" href="#/news/${item.id}">${item.imageUrl ? `<figure class="news-card__thumb"><img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.title || "News")}"></figure>` : ""}<p class="eyebrow">${escapeHtml(item.category || "News")}</p><h3>${escapeHtml(item.title || "")}</h3>${item.subtitle ? `<p class="news-card__subtitle">${escapeHtml(item.subtitle)}</p>` : ""}<p>${escapeHtml(item.shortText || item.teaserText || item.introText || item.bodyText || "").slice(0, 180)}</p></a>`).join("")}</div>` : `<div class="alert">Aktuell sind keine News veroeffentlicht.</div>`}</div></section>`);
}

export async function newsDetailPage(id) {
  const item = await getOne("editorialContent", id);
  if (!item || (item.page !== "news" && item.section !== "news")) return notFoundPage();
  const date = item.publishDate || item.validFrom || item.date || item.updatedAt || "";
  const text = item.bodyText || item.mainText || item.text || item.shortText || item.teaserText || "";
  return publicShell("news", `${subhero("News", escapeHtml(item.title || "News"), escapeHtml(item.subtitle || item.shortText || ""))}
    <section class="section"><div class="container detail-grid">
      <article class="detail-main news-detail">
        <a class="link news-detail__back" href="#/news">Zurueck zu News</a>
        <p class="eyebrow">${escapeHtml(item.category || "News")}${date ? ` · ${formatDate(date)}` : ""}</p>
        <h2>${escapeHtml(item.title || "")}</h2>
        ${item.subtitle ? `<p class="lead">${escapeHtml(item.subtitle)}</p>` : ""}
        ${ttsReader({ title: item.title || "", audioUrl: item.audioUrl || "" })}
        <div class="editorial-text">${item.imageUrl ? `<figure class="news-detail__thumb news-detail__thumb--in-text"><img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.title || "News")}"></figure>` : ""}${articleParagraphs(text)}</div>
      </article>
      <aside class="detail-aside">
        <div class="fact"><label>Rubrik</label><strong>${escapeHtml(item.category || "News")}</strong></div>
        ${date ? `<div class="fact"><label>Datum</label><strong>${formatDate(date)}</strong></div>` : ""}
        <a class="button button--secondary" href="#/news">Alle News</a>
      </aside>
    </div></section>`);
}

export async function topicDetailPage(id) {
  const [topic, events, sponsors] = await Promise.all([getOne("topics", id), listPublicEvents(), listPublicContent("sponsors")]);
  if (!topic) return notFoundPage();
  const linked = events.filter((event) => event.topicIds.includes(id) && event.visibility === "public" && !isPastEvent(event));
  return publicShell("topics", `${subhero("Thema", escapeHtml(topic.title), escapeHtml(topic.longDescription))}
    ${topic.imageUrl ? `<section class="section section--flush"><div class="container"><figure class="topic-hero-image"><img src="${escapeHtml(topic.imageUrl)}" alt="Themenbild ${escapeHtml(topic.title)}"></figure></div></section>` : ""}
    <section class="section section--white"><div class="container topic-article"><p class="eyebrow">Redaktioneller Beitrag</p><h2>${escapeHtml(topic.title)} einordnen</h2>${ttsReader({ title: topic.title || "", audioUrl: topic.audioUrl || "" })}${articleParagraphs(topic.articleText || topic.longDescription)}</div></section>
    <section class="section"><div class="container"><div class="section-head"><div><p class="eyebrow">Verknuepfte Events</p><h2>Im Dialog</h2></div></div><div class="card-grid card-grid--three">${linked.map((event) => eventCard(event, event.date < "2026-05-26", sponsors)).join("")}</div></div></section>`);
}

export async function aboutPage() {
  const content = await getOne("editorialContent", "about-intro") || {
    title: "Ein Netzwerk fuer relevante Verbindungen.",
    introText: "PROdigitalTV bringt die digitale Medienwirtschaft zusammen.",
    bodyText: "Wir schaffen Raum fuer Dialog, Wissenstransfer und Partnerschaften."
  };
  return publicShell("about", `${subhero("Ueber uns", content.title, content.introText)}
    <section class="section"><div class="container detail-grid"><article class="detail-main"><h2>Unser Selbstverstaendnis</h2><div class="editorial-text">${articleParagraphs(content.bodyText)}</div><h2>Was wir leisten</h2><div class="quick-grid"><div class="quick-card"><h3>Dialog</h3><p>Kuratierte Formate fuer Entscheider.</p></div><div class="quick-card"><h3>Wissen</h3><p>Impulse aus Praxis und Strategie.</p></div><div class="quick-card"><h3>Netzwerk</h3><p>Partnerschaften mit Substanz.</p></div></div></article><aside class="detail-aside"><p class="eyebrow">Organisation</p><h2 style="margin-bottom:12px">Vorstand und Mitgliedschaft</h2><p>Lernen Sie die Verantwortlichen kennen oder gestalten Sie die Themen des Netzwerks mit.</p><div class="actions" style="margin-top:20px;flex-wrap:wrap"><a class="button button--dark" href="#/board">Zum Vorstand</a><a class="button button--primary" href="#/join">Mitglied werden</a></div></aside></div></section>`);
}

export async function membersPage() {
  const members = await listPublicContent("members");
  return publicShell("members", `${subhero("Mitglieder", "Unternehmen im Netzwerk.", "Eine Plattform fuer Unternehmen, die digitale Medien aktiv weiterentwickeln.")}
    <section class="section"><div class="container"><div class="section-head"><h2>Mitgliedsunternehmen</h2><div class="search"><input placeholder="Mitglieder suchen"></div></div><div class="card-grid card-grid--three">${members.map((member) => `<article class="card card__body"><div class="member-tile" style="margin-bottom:16px">${memberLogo(member)}</div><h3 style="margin:15px 0 8px">${escapeHtml(member.name)}</h3><p>${escapeHtml(member.description || "")}</p><p style="margin-top:12px">${escapeHtml(member.city)}${member.country ? ` · ${escapeHtml(member.country)}` : ""}</p>${member.website ? `<a class="link" style="display:inline-block;margin-top:14px" href="${escapeHtml(member.website)}" target="_blank" rel="noopener">Zur Website →</a>` : ""}</article>`).join("")}</div></div></section>`);
}

export async function boardPage() {
  const board = await listPublicContent("boardMembers");
  return publicShell("board", `${subhero("Vorstand", "Verantwortung und Perspektive.", "Der Vorstand repraesentiert die Vielfalt und Expertise der digitalen Medienwirtschaft.")}
    <section class="section"><div class="container card-grid card-grid--three board-grid">${board.map((person) => `<article class="card board-card"><div class="board-photo ${person.id === "board-beate-busch" ? "board-photo--contain" : ""}">${boardPortrait(person)}</div><p class="eyebrow">${escapeHtml(person.role)}</p><h3>${escapeHtml(person.name)}</h3><p style="margin:8px 0">${escapeHtml(person.company)}</p><p>${escapeHtml(person.shortBio)}</p></article>`).join("")}</div></section>`);
}

export async function archivePage() {
  const [allEvents, sponsors] = await Promise.all([listPublicEvents(), listPublicContent("sponsors")]);
  const events = allEvents.filter((event) => isPastEvent(event))
    .sort((a, b) => (b.date || "0000-00-00").localeCompare(a.date || "0000-00-00"));
  return publicShell("archive", `${subhero("Event-Nachlauf", "Eventarchiv", "Nachberichte, Bilder und Dokumentation vergangener PROdigitalTV-Veranstaltungen.")}
    <section class="section"><div class="container archive-list">${events.map((event) => archiveArticle(event, sponsors)).join("")}</div></section>`);
}

export async function downloadsPage() {
  const downloads = (await listPublicContent("downloads"))
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
  return publicShell("downloads", `${subhero("Downloads", "Oeffentliche Downloads.", "Vereinssatzung, Beitraege und weitere oeffentliche Dokumente von PROdigitalTV.")}
    <section class="section"><div class="container">${downloads.length ? `<div class="card-grid card-grid--three">${downloads.map(downloadCard).join("")}</div>` : `<div class="alert">Oeffentliche Downloads werden aktuell vorbereitet.</div>`}</div></section>`);
}

export async function joinPage() {
  const [intro, downloads, editorial] = await Promise.all([getOne("editorialContent", "join-intro"), listPublicContent("downloads"), listPublicContent("editorialContent")]);
  const publicDownloads = downloads
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
  const downloadInfo = (item) => {
    const key = /satzung/i.test(item.title || item.fileName || "") ? "join.downloadInfo.satzung" : /beitrag/i.test(item.title || item.fileName || "") ? "join.downloadInfo.membershipFees" : "";
    return editorial.find((content) => content.key === key || content.title === item.title);
  };
  const downloadField = (item) => {
    const url = downloadUrl(item);
    const info = downloadInfo(item);
    return `<details class="download-field"><summary><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.fileName || item.description || "Download")}</span></summary><div class="download-field__body"><p>${escapeHtml(info?.bodyText || item.description || "Weitere Informationen zu diesem Dokument.")}</p><a class="link" href="${escapeHtml(url)}" ${url !== "#/downloads" ? `target="_blank" rel="noreferrer"` : ""}>PDF oeffnen</a></div></details>`;
  };
  const benefitKeys = ["join.benefit.events", "join.benefit.visibility", "join.benefit.impulses"];
  const benefits = benefitKeys.map((key) => editorial.find((content) => content.key === key)).filter(Boolean);
  const benefitFields = benefits.length ? benefits.map((item) => `<details class="download-field"><summary><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.introText || "Mitgliedervorteil")}</span></summary><div class="download-field__body"><p>${escapeHtml(item.bodyText || "")}</p></div></details>`).join("") : `<details class="download-field"><summary><strong>Exklusive Events</strong><span>Mitgliedervorteil</span></summary><div class="download-field__body"><p>Zugang zu Mitgliedsformaten.</p></div></details><details class="download-field"><summary><strong>Sichtbarkeit</strong><span>Mitgliedervorteil</span></summary><div class="download-field__body"><p>Praesenz im Netzwerk.</p></div></details><details class="download-field"><summary><strong>Impulse</strong><span>Mitgliedervorteil</span></summary><div class="download-field__body"><p>Fachlicher Austausch.</p></div></details>`;
  return publicShell("join", `${subhero("Mitglied werden", intro?.title || "Gemeinsam mehr bewegen.", intro?.introText || "Mitgliedschaft fuer Unternehmen, die sich substantiell im Branchendialog engagieren moechten.")}
  <section class="section"><div class="container join-layout"><form id="membership-application-form" class="form-card form-grid join-form">
    <p class="eyebrow">Mitgliedsantrag</p><h2 style="margin-bottom:6px">Mitglied werden</h2>
    <div class="form-grid--two"><div class="field"><label>Unternehmen / Organisation *</label><input name="company" required></div><div class="field"><label>Rechtsform</label><input name="legalForm" placeholder="z. B. GmbH, AG, e.V."></div></div>
    <div class="form-grid--two"><div class="field"><label>Strasse und Hausnummer *</label><input name="street" required></div><div class="field"><label>PLZ / Ort *</label><input name="city" required></div></div>
    <div class="form-grid--two"><div class="field"><label>Land</label><input name="country" value="Deutschland"></div><div class="field"><label>Website</label><input name="website" type="url" placeholder="https://"></div></div>
    <div class="form-grid--two"><div class="field"><label>Ansprechpartner Vorname *</label><input name="firstName" required></div><div class="field"><label>Ansprechpartner Nachname *</label><input name="lastName" required></div></div>
    <div class="form-grid--two"><div class="field"><label>Position / Funktion *</label><input name="position" required></div><div class="field"><label>E-Mail *</label><input name="email" type="email" required></div></div>
    <div class="form-grid--two"><div class="field"><label>Telefon</label><input name="phone" type="tel"></div><div class="field"><label>Mitgliedschaft</label><select name="membershipType"><option value="company">Unternehmensmitglied</option><option value="individual">Einzelmitglied</option></select></div></div>
    <div class="field"><label>Kurzbeschreibung Unternehmen</label><textarea name="companyDescription" placeholder="Taetigkeitsfeld, Bezug zur digitalen Medienwirtschaft"></textarea></div>
    <div class="field"><label>Nachricht / Rueckfragen</label><textarea name="message"></textarea></div>
    <label class="checkbox"><input type="checkbox" name="statutesAccepted" required> Ich habe die Vereinssatzung gelesen und akzeptiere sie. *</label>
    <label class="checkbox"><input type="checkbox" name="feeInfoAccepted" required> Ich habe die Informationen zu Mitgliedsbeitraegen zur Kenntnis genommen. *</label>
    <label class="checkbox"><input type="checkbox" name="privacyAccepted" required> Ich akzeptiere die Datenschutzerklaerung zur Verarbeitung meines Mitgliedsantrags. *</label>
    <label class="checkbox"><input type="checkbox" name="newsletterConsent"> Ich moechte Informationen zu Veranstaltungen und Vereinsaktivitaeten erhalten.</label>
    <button class="button button--primary" type="submit">Mitgliedsantrag absenden</button><div id="membership-application-result"></div>
  </form><aside class="join-aside"><h2>Downloads</h2>${publicDownloads.length ? `<div class="join-download-fields">${publicDownloads.map(downloadField).join("")}</div>` : `<a class="button button--secondary" href="#/downloads">Zu den oeffentlichen Downloads</a>`}<h2>Ihre Vorteile</h2><div class="join-download-fields">${benefitFields}</div></aside></div></section>`);
}

export async function loginPage() {
  const demoControls = firebaseEnabled() ? "" : `<div class="field"><label>Demo-Rolle fuer lokale Vorschau</label><select name="role"><option value="admin">Admin</option><option value="editor">Redakteur</option><option value="member">Mitglied</option></select></div>`;
  const emailValue = firebaseEnabled() ? "" : "admin@prodigitaltv.de";
  const passwordValue = firebaseEnabled() ? "" : "demo";
  return publicShell("login", `<section class="login-wrap"><div class="container"><form id="login-form" class="form-card login-card">${logo()}<p class="eyebrow">Mitgliederbereich</p><h1 style="margin-bottom:10px">Anmelden</h1><p style="margin-bottom:25px">Zugriff auf exklusive Events, Downloads und CMS-Funktionen. Nach erfolgreichem Login wird ein Firebase-ID-Token fuer die aktuelle Sitzung gespeichert.</p><div class="form-grid"><button id="google-login-button" class="button button--secondary" type="button">Mit Google anmelden</button><div class="login-divider"><span>oder mit E-Mail</span></div><div class="field"><label>E-Mail</label><input name="email" type="email" value="${emailValue}" required></div><div class="field"><label>Passwort</label><input name="password" type="password" value="${passwordValue}" required></div>${demoControls}<button class="button button--primary">Einloggen</button><p class="muted">Produktiv zaehlt die Rolle aus Firestore unter <code>users/{uid}</code>. Der Token wird automatisch erneuert und beim Logout geloescht.</p><div id="login-result"></div></div></form></div></section>`);
}

export async function portalPage() {
  const user = currentUser();
  if (!user) return loginPage();
  if (!isMember(user)) {
    return publicShell("login", `${subhero("Mitgliederbereich", "Zugriff noch nicht freigeschaltet.", "Ihr Login ist aktiv, aber die Rolle fuer Mitglieder- oder CMS-Inhalte ist noch nicht hinterlegt.")}<section class="section"><div class="container" style="max-width:760px"><div class="form-card"><p>Bitte pruefen Sie in Firebase/Firestore den Eintrag unter <code>users/${escapeHtml(user.uid || "")}</code>. Fuer CMS-Zugriff muss die Rolle <code>admin</code> oder <code>editor</code> sein, fuer den Mitgliederbereich <code>member</code>.</p><div class="alert" style="margin-top:18px">Wenn dies die erste Einrichtung ist, kann der aktuell eingeloggte Benutzer einmalig als erster Admin freigeschaltet werden. Das funktioniert nur, solange noch kein aktiver Admin existiert.</div><div class="actions" style="margin-top:22px"><button id="bootstrap-admin-button" class="button button--primary">Als ersten Admin freischalten</button><button id="logout-button" class="button button--secondary">Abmelden</button><a class="button button--secondary" href="#/home">Zur Website</a></div><div id="bootstrap-admin-result"></div></div></div></section>`);
  }
  const [allEvents, sponsors] = await Promise.all([listPublicEvents(true), listPublicContent("sponsors")]);
  const events = allEvents.filter((event) => event.accessType === "members_only");
  return publicShell("login", `${subhero("Mitgliederbereich", `Willkommen, ${escapeHtml(user.displayName)}.`, "Exklusive Inhalte und Ihre Veranstaltungen auf einen Blick.")}
    <section class="section"><div class="container"><div class="section-head"><div><h2>Mitglieder-Events</h2><p class="muted">Angemeldet als ${escapeHtml(user.email || "")} · Rolle: ${escapeHtml(user.role || "guest")} · Token bis: ${escapeHtml(user.tokenExpiresAt || "Demo")}</p></div><button id="logout-button" class="button button--secondary">Abmelden</button></div><div class="card-grid card-grid--three">${events.map((event) => eventCard(event, false, sponsors)).join("")}</div></div></section>`);
}

export async function legalPage(type) {
  const privacy = type === "privacy";
  const fallback = privacy
    ? { title: "Datenschutz bei Event-Anmeldungen", introText: "Informationen zur Verarbeitung personenbezogener Daten.", bodyText: "Anmeldedaten werden ausschliesslich zur Organisation des gewaelten Events, zur Bestaetigung der E-Mail-Adresse und fuer erteilte Einwilligungen verarbeitet. Die finale Datenschutzerklaerung ist vor Livegang rechtlich abzustimmen." }
    : { title: "PROdigitalTV - Interessengemeinschaft Digitale Medien e.V.", introText: "Angaben gemaess den gesetzlichen Informationspflichten.", bodyText: "Vereins- und Geschaeftssitz:\nWandalenweg 26\n20097 Hamburg\nTelefon: +49 40 44506617\nE-Mail: post@prodigitaltv.de\nInternet: www.prodigitaltv.de\n\nEingetragen im Vereinsregister Hamburg: VR 19974\nVerantwortliche Personen: Vorstand von PROdigitalTV." };
  const content = await getOne("editorialContent", privacy ? "legal-privacy" : "legal-imprint") || fallback;
  return publicShell("", `${subhero("Rechtliches", privacy ? "Datenschutz" : "Impressum", content.introText || fallback.introText)}
  <section class="section"><div class="container detail-main" style="max-width:820px"><h2>${escapeHtml(content.title || fallback.title)}</h2><div class="editorial-text">${articleParagraphs(content.bodyText || fallback.bodyText)}</div></div></section>`);
}

export function notFoundPage() {
  return publicShell("", `<section class="section"><div class="container empty"><h1>Seite nicht gefunden</h1><p>Die angeforderte Seite ist nicht verfuegbar.</p><a class="button button--primary" style="margin-top:20px" href="#/home">Zur Startseite</a></div></section>`);
}
