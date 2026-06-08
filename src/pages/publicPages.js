import { list, listPublicEvents, listPublicContent, getOne } from "../firebase/dataService.js?v=463";
import { currentUser, isMember } from "../firebase/authService.js?v=460";
import { firebaseEnabled, localPreviewMode } from "../firebase/firebaseClient.js";
import { publicShell, logo } from "../components/layout.js";
import { eventCard, topicCard } from "../components/cards.js";
import { accessLabels, lifecycleLabels } from "../data/demoData.js";
import { escapeHtml, formatDate, initials } from "../utils/format.js";

function editorialThumbDataUrl(title = "", label = "", context = "") {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#071f3f"/>
        <stop offset=".58" stop-color="#123866"/>
        <stop offset="1" stop-color="#e30613"/>
      </linearGradient>
      <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffffff" stop-opacity=".96"/>
        <stop offset="1" stop-color="#eaf2fb" stop-opacity=".88"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="675" fill="url(#bg)"/>
    <path d="M0 485 C260 380 350 520 560 425 C775 326 840 180 1200 240 L1200 675 L0 675 Z" fill="#ffffff" opacity=".12"/>
    <path d="M140 128 H486 V486 H140 Z" rx="28" fill="url(#panel)"/>
    <path d="M730 128 H1070 V486 H730 Z" rx="28" fill="#081a33" opacity=".72"/>
    <path d="M285 276 h58 v-72 h46 v72 h58 v42 h-58 v72 h-46 v-72 h-58z" fill="#e30613"/>
    <path d="M805 342 C850 260 954 260 999 342" fill="none" stroke="#ffffff" stroke-width="22" stroke-linecap="round"/>
    <path d="M815 380 C885 328 930 328 990 380" fill="none" stroke="#e30613" stroke-width="18" stroke-linecap="round"/>
    <path d="M557 205 h86 v270 h-86z" fill="#ffffff" opacity=".92"/>
    <path d="M508 475 h184" stroke="#ffffff" stroke-width="20" stroke-linecap="round"/>
    <path d="M526 255 h148" stroke="#ffffff" stroke-width="16" stroke-linecap="round"/>
    <path d="M526 255 l-62 128 h124z" fill="none" stroke="#ffffff" stroke-width="14" stroke-linejoin="round"/>
    <path d="M674 255 l-62 128 h124z" fill="none" stroke="#ffffff" stroke-width="14" stroke-linejoin="round"/>
    <text x="80" y="82" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="800" letter-spacing="3">${escapeHtml(label)}</text>
    <text x="80" y="592" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="58" font-weight="900">${escapeHtml(title)}</text>
    <text x="82" y="632" fill="#dce8f7" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700">${escapeHtml(context)}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const editorialFallbackNews = [
  {
    id: "news-gema-suno-ki-musik-urheberrecht",
    title: "GEMA gegen Suno: KI-Musik wird zum Grundsatzfall fuer die Kreativwirtschaft",
    headline: "GEMA gegen Suno: KI-Musik wird zum Grundsatzfall fuer die Kreativwirtschaft",
    subtitle: "Vor dem Landgericht Muenchen geht es um die Frage, ob KI-Musik mit geschuetzten Werken trainiert wurde. Der Fall koennte wichtige Standards fuer Verguetung, Lizenzen und kreative Rechte setzen.",
    subline: "Vor dem Landgericht Muenchen geht es um die Frage, ob KI-Musik mit geschuetzten Werken trainiert wurde. Der Fall koennte wichtige Standards fuer Verguetung, Lizenzen und kreative Rechte setzen.",
    shortText: "Der Streit zwischen GEMA und Suno koennte zum europaeischen Musterfall fuer KI-Musik werden.",
    bodyText: [
      "Der Rechtsstreit zwischen der GEMA und dem US-Unternehmen Suno gehoert zu den wichtigsten Verfahren rund um generative KI in der Musikbranche. Suno bietet ein KI-Tool an, mit dem Nutzer per Texteingabe vollstaendige Songs erzeugen koennen. Die GEMA wirft dem Unternehmen vor, geschuetzte Werke aus ihrem Repertoire ohne Lizenz fuer das Training des Systems genutzt zu haben. Ausserdem sollen erzeugte KI-Songs bekannten Titeln teilweise so stark aehneln, dass Urheberrechte verletzt sein koennten.",
      "Die Klage wurde am 21. Januar 2025 beim Landgericht Muenchen eingereicht. Am 9. Maerz 2026 wurde der Fall dort verhandelt. Nach Einschaetzung der GEMA handelt es sich um das erste europaeische Verfahren, das sich direkt mit der Nutzung von Audioinhalten durch KI-Unternehmen befasst. Ein Urteil steht noch aus; ein Copyright-Tracker von Taylor Wessing nennt den 12. Juni 2026 als erwarteten Entscheidungstermin.",
      "Im Kern geht es um eine zentrale Frage fuer die digitale Medien- und Kreativwirtschaft: Darf ein KI-System mit urheberrechtlich geschuetzter Musik trainiert werden, ohne dass die Komponisten, Textautoren und Musikverlage zustimmen oder verguetet werden? Die GEMA argumentiert, dass der wirtschaftliche Erfolg solcher KI-Systeme auf menschlicher Kreativitaet beruht und die Rechteinhaber deshalb an der Nutzung beteiligt werden muessen.",
      "Fuer die Medienbranche ist der Fall weit ueber Musik hinaus relevant. Wenn Gerichte klarstellen, dass KI-Training mit geschuetzten Inhalten lizenzpflichtig ist, haette das Folgen fuer viele Bereiche: Musikproduktion, TV, Streaming, Werbung, Archivnutzung, Synchronisation, Voice-Cloning, Trailer-Produktion und automatisierte Content-Erstellung. Besonders betroffen waeren Geschaeftsmodelle, bei denen KI neue Inhalte erzeugt, die auf bestehenden Werken, Stimmen, Stilen oder Produktionen beruhen.",
      "Gleichzeitig zeigt der internationale Markt, dass sich die Branche bereits neu sortiert. In den USA haben grosse Musikunternehmen Verfahren gegen KI-Musikdienste wie Suno und Udio gefuehrt oder teilweise beigelegt. Reuters berichtete Anfang Juni 2026 zudem ueber eine neue Klage der US-Musikergewerkschaft gegen Warner und Universal, weil deren KI-Lizenzvereinbarungen aus Sicht der Musiker nicht ausreichend kompensieren.",
      "Der Fall GEMA gegen Suno ist deshalb mehr als ein einzelner Urheberrechtsstreit. Er steht fuer die Frage, ob KI-Anbieter kreative Leistungen einfach als Trainingsmaterial nutzen duerfen - oder ob dafuer klare Lizenzmodelle entstehen muessen. Fuer Kreative, Rechteinhaber, Medienhaeuser und Plattformbetreiber geht es um nicht weniger als die wirtschaftliche Grundlage professioneller Inhalteproduktion im KI-Zeitalter.",
      "Kurzfazit: Der Streit zwischen GEMA und Suno koennte zum europaeischen Musterfall fuer KI-Musik werden. Entscheidend wird sein, ob Gerichte das Training und die Ausgabe KI-generierter Musik als lizenzpflichtige Nutzung geschuetzter Werke bewerten."
    ].join("\n\n"),
    page: "news",
    section: "news",
    category: "KI / Musikrechte / Medienrecht / Digitale Medien",
    tags: ["GEMA", "Suno", "KI-Musik", "Urheberrecht", "generative KI", "Musikrechte", "Lizenzierung", "Medienrecht", "Kreativwirtschaft", "AI Act"],
    thumbnail_idea: "Geteiltes Bild: links ein klassisches Tonstudio mit Noten und Mischpult, rechts ein KI-Musikgenerator mit Wellenform und AI-Music-Label. In der Mitte eine Waage als Symbol fuer Urheberrecht und faire Verguetung.",
    thumbnail_prompt: "Serioese redaktionelle Illustration fuer eine Medienbranchen-News, Thema GEMA gegen Suno, KI-Musik und Urheberrecht, links Tonstudio mit Noten und Mischpult, rechts digitales KI-Musikinterface mit Audiowellenform, zentrale Waage als Rechtssymbol, professioneller Stil, klare Linien, serioese Farben, keine Comicoptik, geeignet fuer TV-, Streaming- und Digitalbranche.",
    imageUrl: editorialThumbDataUrl("GEMA vs. Suno", "KI-Musik", "Urheberrecht und faire Verguetung"),
    thumbnail_url: editorialThumbDataUrl("GEMA vs. Suno", "KI-Musik", "Urheberrecht und faire Verguetung"),
    thumbnail_alt: "Redaktionelles Thumb zu GEMA gegen Suno mit Studio, KI-Musik und Rechtssymbol.",
    source_snapshot_json: [
      { title: "GEMA klagt gegen Suno: Landgericht Muenchen verhandelt erstes Verfahren im Bereich Audio-KI", publisher: "GEMA", url: "https://www.gema.de/de/w/gema-klagt-gegen-suno-2026", source_type: "Verwertungsgesellschaft" },
      { title: "Suno AI und Open AI: GEMA klagt fuer faire Verguetung", publisher: "GEMA", url: "https://www.gema.de/de/aktuelles/ki-und-musik/ki-klage", source_type: "Verwertungsgesellschaft" },
      { title: "Musicians union sues record labels over AI licensing", publisher: "Reuters", url: "https://www.reuters.com/legal/litigation/musicians-union-sues-record-labels-over-ai-licensing-2026-06-05/", source_type: "Nachrichtenagentur" }
    ],
    publishDate: "2026-06-07",
    validFrom: "2026-06-07",
    status: "published",
    visibility: "public",
    visible: true
  },
  {
    id: "news-ki-kennzeichnungspflicht-transparenz-medienanbieter",
    title: "KI-Kennzeichnungspflicht: Transparenz wird zur Pflichtaufgabe fuer Medienanbieter",
    headline: "KI-Kennzeichnungspflicht: Transparenz wird zur Pflichtaufgabe fuer Medienanbieter",
    subtitle: "Ab August 2026 gelten neue EU-Regeln fuer KI-generierte Inhalte. Fuer Medienanbieter wird Transparenz damit zur Pflichtaufgabe.",
    subline: "Ab August 2026 gelten neue EU-Regeln fuer KI-generierte Inhalte. Fuer Medienanbieter wird Transparenz damit zur Pflichtaufgabe.",
    shortText: "Medienanbieter sollten schon jetzt klare Regeln fuer Kennzeichnung, redaktionelle Pruefung und Verantwortlichkeit vorbereiten.",
    bodyText: [
      "Kuenstliche Intelligenz ist laengst in der Medienproduktion angekommen. Texte werden mit KI vorbereitet, Pressemitteilungen redaktionell umformuliert, Bilder generiert, Stimmen synthetisch erzeugt und Videos automatisiert bearbeitet. Was bisher oft eine technische oder redaktionelle Entscheidung war, wird mit dem europaeischen AI Act zunehmend auch zu einer Frage von Transparenz, Verantwortung und Vertrauen.",
      "Die Transparenzpflichten des AI Act sollen ab 2. August 2026 gelten. Sie betreffen unter anderem KI-Systeme, mit denen Menschen direkt interagieren, sowie bestimmte KI-generierte oder manipulierte Inhalte. Die Europaeische Kommission nennt ausdruecklich synthetische Inhalte, Deepfakes und KI-generierte Veroeffentlichungen zu Themen von oeffentlichem Interesse.",
      "Fuer Medienanbieter ist dabei entscheidend: Nicht jede Nutzung von KI muss automatisch gross sichtbar gekennzeichnet werden. Es macht einen Unterschied, ob KI nur bei Recherche, Zusammenfassung, Uebersetzung oder Formulierung unterstuetzt - oder ob Inhalte so erzeugt oder veraendert wurden, dass das Publikum ueber deren Ursprung getaeuscht werden koennte.",
      "Besonders relevant wird die Kennzeichnung bei Bild-, Audio- und Videoinhalten, die reale Personen, Stimmen oder Ereignisse taeuschend echt darstellen oder veraendern. Wer solche Deepfakes oder synthetischen Medien veroeffentlicht, muss kuenftig klarer offenlegen, dass KI eingesetzt wurde. Auch Anbieter generativer KI-Systeme sollen technische Markierungen ermoeglichen, damit kuenstlich erzeugte oder manipulierte Inhalte maschinenlesbar erkannt werden koennen.",
      "Auch Texte koennen betroffen sein, wenn sie mit KI erstellt und veroeffentlicht werden, um die Oeffentlichkeit ueber Themen von allgemeinem Interesse zu informieren. Fuer Redaktionen bleibt deshalb wichtig, dass KI-generierte Inhalte redaktionell geprueft, eingeordnet und verantwortet werden. Genau hier liegt die Chance fuer professionelle Medienanbieter: Nicht die KI selbst ist das Problem, sondern ein unklarer oder verdeckter Einsatz.",
      "Fuer TV-, Streaming- und Digitalanbieter sollte KI-Transparenz kuenftig direkt im Redaktionssystem mitgedacht werden. Sinnvoll ist eine einfache Dokumentation: Wurde KI fuer Text, Bild, Audio, Video, Zusammenfassung oder Uebersetzung genutzt? Wurde der Inhalt redaktionell geprueft? Wer traegt die finale Verantwortung? Solche Informationen helfen nicht nur bei der rechtlichen Einordnung, sondern staerken auch die Glaubwuerdigkeit gegenueber Publikum, Partnern und Mitgliedern.",
      "Die KI-Kennzeichnungspflicht ist damit kein reines Warnschild gegen neue Technologie. Sie ist ein Instrument, um Vertrauen in digitale Medien zu sichern. Wer KI offen, nachvollziehbar und redaktionell kontrolliert einsetzt, kann neue Produktionsmoeglichkeiten nutzen, ohne journalistische Standards aufzugeben.",
      "Kurzfazit: Medienanbieter sollten schon jetzt klare Regeln fuer den Einsatz von KI vorbereiten. Dazu gehoeren Kennzeichnung, redaktionelle Pruefung, Verantwortlichkeit und eine einfache Dokumentation im CMS."
    ].join("\n\n"),
    page: "news",
    section: "news",
    category: "Medienrecht / KI / Digitale Medien",
    tags: ["KI-Kennzeichnungspflicht", "AI Act", "Kuenstliche Intelligenz", "Medienrecht", "Deepfake", "Transparenzpflicht", "Redaktion", "CMS", "generative KI", "digitale Medien"],
    thumbnail_idea: "Moderner digitaler Newsroom mit Monitoren, KI-Symbol und dezenter Label-Markierung AI. Der Stil sollte serioes, klar und redaktionell wirken - keine uebertriebene Science-Fiction.",
    thumbnail_prompt: "Serioese redaktionelle Illustration fuer eine Medienbranchen-News, moderner digitaler Newsroom, Monitore, dezentes KI-Symbol, transparente Label-Markierung AI, europaeischer Regulierungs-Kontext, professionelle Atmosphaere, klare Linien, serioeser Stil, geeignet fuer TV-, Streaming- und Digitalbranche.",
    imageUrl: editorialThumbDataUrl("AI Label", "KI-Transparenz", "Kennzeichnungspflicht fuer Medienanbieter"),
    thumbnail_url: editorialThumbDataUrl("AI Label", "KI-Transparenz", "Kennzeichnungspflicht fuer Medienanbieter"),
    thumbnail_alt: "Redaktionelles Thumb zur KI-Kennzeichnungspflicht mit Newsroom, AI-Label und Regulierungskontext.",
    source_snapshot_json: [
      { title: "Consultation on the draft guidelines on transparency obligations under AI Act", publisher: "Digitale Strategie Europa", url: "https://digital-strategy.ec.europa.eu/en/consultations/consultation-draft-guidelines-transparency-obligations-under-ai-act", source_type: "EU-Kommission" }
    ],
    publishDate: "2026-06-07",
    validFrom: "2026-06-07",
    status: "published",
    visibility: "public",
    visible: true
  }
];

function subhero(eyebrow, title, text) {
  return `<section class="subhero"><div class="container">${eyebrow ? `<p class="eyebrow">${eyebrow}</p>` : ""}<h1>${title}</h1><p>${text}</p></div></section>`;
}

function articleHeader({ eyebrow = "", title = "", intro = "", logoUrl = "", logoAlt = "" } = {}) {
  return `<header class="article-header">
    <div class="article-header__copy">
      ${eyebrow ? `<p class="eyebrow">${escapeHtml(eyebrow)}</p>` : ""}
      <h1>${escapeHtml(title)}</h1>
      ${intro ? `<p>${escapeHtml(intro)}</p>` : ""}
    </div>
    ${logoUrl ? `<figure class="article-header__logo"><img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(logoAlt || title)}"></figure>` : ""}
  </header>`;
}

function memberLogo(member) {
  const logoClass = `member-logo member-logo--${String(member.id || "").replace(/[^a-z0-9-]/gi, "").toLowerCase()}`;
  return member.logoUrl
    ? `<img class="${logoClass}" src="${escapeHtml(member.logoUrl)}" alt="Logo ${escapeHtml(member.name)}">`
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

function archiveEditorialArticle(item, partners = []) {
  const sponsor = item.sponsorId ? partners.find((partner) => partner.id === item.sponsorId) : null;
  const dateLabel = item.publishDate || item.validFrom || item.date || item.updatedAt || "";
  return `<article class="archive-article">
    ${item.imageUrl ? `<figure class="archive-article__image"><img src="${escapeHtml(item.imageUrl)}" alt="Rueckblick ${escapeHtml(item.title || "")}"></figure>` : `<div class="archive-article__placeholder"><span>Rueckblick</span></div>`}
    <div class="archive-article__body">
      <p class="eyebrow">${dateLabel ? formatDate(dateLabel.slice(0, 10)) : "Event-Nachlauf"}${sponsor ? ` · ${escapeHtml(sponsor.name)}` : ""}</p>
      <h2>${escapeHtml(item.title || "Rueckblick")}</h2>
      ${item.subtitle ? `<p class="archive-article__meta">${escapeHtml(item.subtitle)}</p>` : ""}
      <p>${escapeHtml(teaserText(item.longDescription || item.articleText || item.bodyText || item.mainText || item.fullText || item.longText || item.introText || "", 260))}</p>
      <a class="link" href="#/retrospective/${item.id}">Rueckblick lesen →</a>
    </div>
  </article>`;
}

function articleParagraphs(text = "") {
  return text.split(/\n+/).filter(Boolean).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
}

function archiveEventImageUrl(event = {}) {
  const archivePhotoExtensions = {
    32: "jpg",
    33: "jpg",
    37: "jpg",
    45: "jpg",
    48: "png",
    61: "jpg",
    62: "jpg",
    69: "jpg",
    70: "jpg",
    76: "jpg"
  };
  const archiveUrl = (id) => `/assets/official/events/archive-${id}.${archivePhotoExtensions[id] || "svg"}`;
  if (event.officialId) return archiveUrl(event.officialId);
  const match = String(event.id || "").match(/event-archive-(\d+)/);
  if (match) return archiveUrl(match[1]);
  if (event.imageUrl) return event.imageUrl;
  return event.id ? `/assets/official/events/${escapeHtml(event.id)}.svg` : "";
}

function retrospectiveLinkedEvent(item = {}, events = []) {
  const explicit = events.find((event) => event.id === item.linkedEventId || event.id === item.galleryEventId);
  if (explicit) return explicit;
  const haystack = `${item.title || ""} ${item.subtitle || ""} ${item.introText || ""} ${item.bodyText || ""} ${item.longDescription || ""} ${item.articleText || ""}`.toLowerCase();
  const knownEventId = haystack.includes("leica") || haystack.includes("wetzlar")
    ? "event-leica-welt-2026"
    : haystack.includes("berlinale") || haystack.includes("heussen")
      ? "event-berlinale-2026"
      : haystack.includes("salzburg") || haystack.includes("red bull")
        ? "event-salzburg-2025"
        : "";
  if (knownEventId) return events.find((event) => event.id === knownEventId) || null;
  return null;
}

function archiveListEvent(event, partners = []) {
  const host = partners.find((partner) => partner.id === event.hostId);
  const dateLabel = event.displayDate || formatDate(event.date);
  const detailUrl = `#/event/${escapeHtml(event.id)}`;
  const imageUrl = archiveEventImageUrl(event);
  return `<article class="archive-article archive-article--list">
    <a class="archive-article__thumb" href="${detailUrl}" aria-label="Rueckblick ${escapeHtml(event.title)} ansehen">
      ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="Rueckblick ${escapeHtml(event.title)}" loading="eager" decoding="async">` : `<span>${escapeHtml(event.eventType || "Archiv")}</span>`}
    </a>
    <div class="archive-article__body">
      <p class="eyebrow">${escapeHtml(dateLabel)}${event.city ? ` · ${escapeHtml(event.city)}` : ""}</p>
      <h2><a href="${detailUrl}">${escapeHtml(event.title)}</a></h2>
      <p class="archive-article__meta">${escapeHtml(event.locationName || "Ort nicht angegeben")}${host ? ` · Gastgeber: ${escapeHtml(host.name)}` : ""}</p>
      <p>${escapeHtml(teaserText(event.postEventummary || event.description || "", 260))}</p>
      <a class="link" href="${detailUrl}">Rueckblick ansehen -></a>
    </div>
  </article>`;
}

function archiveListEditorial(item, partners = [], events = []) {
  const sponsor = item.sponsorId ? partners.find((partner) => partner.id === item.sponsorId) : null;
  const linkedEvent = retrospectiveLinkedEvent(item, events);
  const thumbUrl = item.imageUrl || (linkedEvent ? archiveEventImageUrl(linkedEvent) : "");
  const dateLabel = item.publishDate || item.validFrom || item.date || item.updatedAt || "";
  const detailUrl = `#/retrospective/${escapeHtml(item.id)}`;
  return `<article class="archive-article archive-article--list">
    <a class="archive-article__thumb" href="${detailUrl}" aria-label="Rueckblick ${escapeHtml(item.title || "Rueckblick")} lesen">
      ${thumbUrl ? `<img src="${escapeHtml(thumbUrl)}" alt="Rueckblick ${escapeHtml(item.title || "")}" loading="eager" decoding="async">` : `<span>Rueckblick</span>`}
    </a>
    <div class="archive-article__body">
      <p class="eyebrow">${dateLabel ? formatDate(dateLabel.slice(0, 10)) : "Event-Nachlauf"}${sponsor ? ` · ${escapeHtml(sponsor.name)}` : ""}</p>
      <h2><a href="${detailUrl}">${escapeHtml(item.title || "Rueckblick")}</a></h2>
      ${item.subtitle ? `<p class="archive-article__meta">${escapeHtml(item.subtitle)}</p>` : ""}
      <p>${escapeHtml(teaserText(item.longDescription || item.articleText || item.bodyText || item.mainText || item.fullText || item.longText || item.introText || "", 260))}</p>
      <a class="link" href="${detailUrl}">Rueckblick lesen -></a>
    </div>
  </article>`;
}

const internalPageMeta = {
  ueber_uns: {
    active: "about",
    route: "about",
    detailRoute: "ueber-uns",
    eyebrow: "Ueber uns",
    title: "Das Branchennetzwerk der digitalen Medienwirtschaft.",
    intro: "PROdigitalTV vernetzt Unternehmen und Akteure der digitalen Medienwirtschaft im deutschsprachigen Raum."
  },
  mitglied_werden: {
    active: "join",
    route: "join",
    detailRoute: "mitglied-werden",
    eyebrow: "Mitglied werden",
    title: "Teil eines starken Branchennetzwerks werden",
    intro: "Eine Mitgliedschaft bei PROdigitalTV bietet Zugang zu Austausch, Wissen, Sichtbarkeit und exklusiven Formaten der digitalen Medienwirtschaft."
  }
};

function canonicalInternalBlock(item = {}) {
  return {
    ...item,
    slug: item.slug || item.id,
    bereich: item.bereich || (item.page === "about" ? "ueber_uns" : item.page === "join" ? "mitglied_werden" : ""),
    typ: item.typ || item.section || "textblock",
    titel: item.titel || item.title || "",
    kurztext: item.kurztext || item.introText || item.subtitle || "",
    langtext: item.langtext || item.bodyText || "",
    icon: item.icon || "modules",
    sortierung: Number(item.sortierung ?? item.sortOrder ?? 0),
    button_text: item.button_text || item.buttonText || "",
    button_ziel: item.button_ziel || item.buttonUrl || ""
  };
}

function isPublicInternalBlock(item = {}, bereich) {
  const block = canonicalInternalBlock(item);
  const managedInternal = item.editorialManaged || item.bereich === "ueber_uns" || item.bereich === "mitglied_werden";
  return managedInternal
    && block.bereich === bereich
    && ["aktiv", "published"].includes(String(item.status || ""))
    && ["oeffentlich", "public"].includes(String(item.sichtbarkeit || item.visibility || ""));
}

async function internalBlocks(bereich) {
  return (await list("editorialContent"))
    .filter((item) => isPublicInternalBlock(item, bereich))
    .map(canonicalInternalBlock)
    .sort((a, b) => Number(a.sortierung || 0) - Number(b.sortierung || 0));
}

function internalIcon(name = "") {
  const labels = {
    network: "N", compass: "K", modules: "M", dialog: "D", breakfast: "B", interview: "I", transformation: "T", impact: "W",
    membership: "M", knowledge: "W", visibility: "S", presentation: "P", guest: "G", exclusive: "E", law: "R", gema: "G", cooperation: "K", discount: "%", cta: ">"
  };
  return `<span class="internal-card__icon" aria-hidden="true">${escapeHtml(labels[name] || "•")}</span>`;
}

function internalCard(block, meta) {
  const href = `#/${meta.detailRoute}/${encodeURIComponent(block.slug)}`;
  return `<a class="internal-card internal-card--${escapeHtml(block.typ)}" href="${href}">
    ${internalIcon(block.icon)}
    <span><strong>${escapeHtml(block.titel)}</strong><small>${escapeHtml(block.kurztext)}</small></span>
    <b aria-hidden="true">→</b>
  </a>`;
}

function aboutThumbLabel(icon = "") {
  const labels = {
    network: "Netz",
    membership: "Mitglied",
    knowledge: "Wissen",
    visibility: "Sichtbar",
    presentation: "Events",
    guest: "Gaeste",
    exclusive: "Exklusiv",
    law: "Recht",
    gema: "GEMA",
    cooperation: "Kontakt",
    discount: "Rabatt",
    cta: "Anfrage",
    compass: "Werte",
    modules: "Leistung",
    dialog: "Dialog",
    breakfast: "Events",
    interview: "Talk",
    transformation: "Wandel",
    impact: "Wirkung"
  };
  return labels[icon] || "PDT";
}

function aboutPicto(icon = "") {
  const pictos = {
    network: `<svg viewBox="0 0 24 24"><path d="M7 20v-1.5a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4V20"/><circle cx="12" cy="7" r="4"/><path d="M4 19v-1.2a3.6 3.6 0 0 1 3-3.55"/><path d="M20 19v-1.2a3.6 3.6 0 0 0-3-3.55"/></svg>`,
    compass: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m15.6 8.4-2.25 5.25L8.4 15.6l2.25-5.25 4.95-1.95z"/></svg>`,
    modules: `<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="2.5"/><circle cx="19" cy="5" r="2.5"/><circle cx="19" cy="19" r="2.5"/><path d="m7.2 10.8 9.6-4.6"/><path d="m7.2 13.2 9.6 4.6"/></svg>`,
    membership: `<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/></svg>`,
    knowledge: `<svg viewBox="0 0 24 24"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M8.6 15.1A6 6 0 1 1 15.4 15c-.8.6-1.4 1.5-1.4 2.5h-4c0-1-.6-1.8-1.4-2.4z"/></svg>`,
    visibility: `<svg viewBox="0 0 24 24"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="3"/></svg>`,
    presentation: `<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4"/><path d="M16 3v4"/><path d="M4 10h16"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/></svg>`,
    guest: `<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="4"/><path d="M3 21v-2a6 6 0 0 1 12 0v2"/><path d="M16 11h5"/><path d="M18.5 8.5v5"/></svg>`,
    exclusive: `<svg viewBox="0 0 24 24"><path d="m12 3 2.6 5.3 5.9.9-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.2 5.9-.9L12 3z"/></svg>`,
    law: `<svg viewBox="0 0 24 24"><path d="M12 3v18"/><path d="M5 7h14"/><path d="M6 7l-4 7h8L6 7z"/><path d="M18 7l-4 7h8l-4-7z"/><path d="M8 21h8"/></svg>`,
    gema: `<svg viewBox="0 0 24 24"><path d="M19 5 5 19"/><circle cx="7" cy="7" r="3"/><circle cx="17" cy="17" r="3"/></svg>`,
    cooperation: `<svg viewBox="0 0 24 24"><circle cx="7" cy="12" r="3"/><circle cx="17" cy="7" r="3"/><circle cx="17" cy="17" r="3"/><path d="m9.6 10.5 4.8-2.1"/><path d="m9.6 13.5 4.8 2.1"/></svg>`,
    discount: `<svg viewBox="0 0 24 24"><path d="M19 5 5 19"/><circle cx="7" cy="7" r="3"/><circle cx="17" cy="17" r="3"/><path d="M7 7h.01"/><path d="M17 17h.01"/></svg>`,
    cta: `<svg viewBox="0 0 24 24"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/><rect x="3" y="4" width="18" height="16" rx="3"/></svg>`,
    dialog: `<svg viewBox="0 0 24 24"><path d="M5 18 3 21V5a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H5z"/><path d="M7 8h10"/><path d="M7 12h7"/></svg>`,
    breakfast: `<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4"/><path d="M16 3v4"/><path d="M4 10h16"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/></svg>`,
    interview: `<svg viewBox="0 0 24 24"><path d="M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><path d="M12 18v4"/><path d="M8 22h8"/></svg>`,
    transformation: `<svg viewBox="0 0 24 24"><rect x="3" y="13" width="4" height="7" rx="1"/><rect x="10" y="8" width="4" height="12" rx="1"/><rect x="17" y="4" width="4" height="16" rx="1"/><path d="M3 20h19"/></svg>`,
    impact: `<svg viewBox="0 0 24 24"><rect x="3" y="13" width="4" height="7" rx="1"/><rect x="10" y="8" width="4" height="12" rx="1"/><rect x="17" y="4" width="4" height="16" rx="1"/><path d="M3 20h19"/></svg>`
  };
  return `<span class="about-picto" aria-hidden="true">${pictos[icon] || pictos.modules}</span>`;
}

function aboutButtonGallery(blocks, meta) {
  return `<div class="internal-button-gallery" aria-label="Ueber-uns Bereiche">${blocks.map((block) => {
    const href = `#/${meta.detailRoute}/${encodeURIComponent(block.slug)}`;
    return `<a href="${href}">${aboutPicto(block.icon)}<span>${escapeHtml(block.titel)}</span></a>`;
  }).join("")}</div>`;
}

function aboutInternalCard(block, meta, options = {}) {
  const summary = options.summary === "long"
    ? teaserText(block.langtext || block.kurztext, 190)
    : block.kurztext;
  if (options.joinCta) {
    return `<article class="internal-card internal-card--about internal-card--join internal-card--${escapeHtml(block.typ)}">
    <span class="internal-about-thumb internal-about-thumb--${escapeHtml(block.icon || "modules")}" aria-hidden="true">${aboutPicto(block.icon)}<strong>${escapeHtml(aboutThumbLabel(block.icon))}</strong></span>
    <span class="internal-about-copy"><strong>${escapeHtml(block.titel)}</strong><small>${escapeHtml(summary)}</small></span>
    <button class="join-text-link internal-card__join-cta" type="button" data-join-scroll>Mitgliedsantrag -></button>
  </article>`;
  }
  return `<button class="internal-card internal-card--about internal-card--${escapeHtml(block.typ)}" type="button" data-about-jump="${escapeHtml(block.slug)}">
    <span class="internal-about-thumb internal-about-thumb--${escapeHtml(block.icon || "modules")}" aria-hidden="true">${aboutPicto(block.icon)}<strong>${escapeHtml(aboutThumbLabel(block.icon))}</strong></span>
    <span class="internal-about-copy"><strong>${escapeHtml(block.titel)}</strong><small>${escapeHtml(summary)}</small></span>
  </button>`;
}

function aboutLongTextection(block, options = {}) {
  return `<article class="internal-about-text" id="about-text-${escapeHtml(block.slug)}">
    <div class="internal-about-text__head">${aboutPicto(block.icon)}<div><p class="eyebrow">${escapeHtml(block.titel)}</p><h2>${escapeHtml(block.titel)}</h2><p>${escapeHtml(block.kurztext)}</p></div></div>
    ${ttsReader({ title: block.titel || "", text: block.langtext || "", audioUrl: block.audioUrl || "", audioAccessibleUrl: block.audioAccessibleUrl || "", audioNaturalUrl: block.audioNaturalUrl || "", audioStatus: block.audioStatus || "", audioAccessibleStatus: block.audioAccessibleStatus || "", audioNaturalStatus: block.audioNaturalStatus || "" })}
    <div class="editorial-text">${articleParagraphs(block.langtext)}</div>
    ${options.joinCta ? `<button class="join-text-link internal-text-join-cta" type="button" data-join-scroll>Mitgliedsantrag -></button>` : ""}
    <button class="internal-about-top-button" type="button" data-internal-scroll-top aria-label="Nach oben">↑</button>
  </article>`;
}

function chunkItems(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function rubricRotator(items, renderItem, emptyHtml = "") {
  const slides = items.length ? items : [null];
  return `<div class="internal-rubric-rotator" data-rubric-rotator>${slides.map((item, index) => `<div class="internal-rubric-slide${index === 0 ? " is-active" : ""}" data-rubric-slide>${item ? renderItem(item) : emptyHtml}</div>`).join("")}</div>`;
}

function aboutStickyContent(events = [], board = [], members = [], topics = []) {
  const upcomingEvents = events.filter((event) => !isPastEvent(event)).sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
  const eventSlides = upcomingEvents.length ? upcomingEvents.slice(0, 5) : events.slice(0, 5);
  const topicSlides = topics.slice(0, 6);
  const boardSlides = chunkItems(board.slice(0, 8), 2);
  const memberSlides = chunkItems(members.filter((member) => member.featured || member.logoUrl).slice(0, 15), 3);
  const renderEvent = (event) => `<a class="internal-sticky-event" href="#/event/${event.id}">
    ${event.imageUrl ? `<img src="${escapeHtml(event.imageUrl)}" alt="Eventbild ${escapeHtml(event.title || "")}">` : `<span class="internal-sticky-event__picto">${aboutPicto("breakfast")}</span>`}
    <span><strong>${escapeHtml(event.title || "Event")}</strong><small>${formatDate(event.date)}${event.city ? ` · ${escapeHtml(event.city)}` : ""}</small></span>
  </a>`;
  const renderTopic = (topic) => `<a class="internal-sticky-topic" href="#/topic/${topic.id}">
    <span class="internal-sticky-event__picto">${aboutPicto("dialog")}</span>
    <span><strong>${escapeHtml(topic.title || "Thema")}</strong><small>${escapeHtml(topic.subtitle || topic.shortDescription || "Aktuelle Themen im Netzwerk")}</small></span>
  </a>`;
  const renderBoardPair = (pair) => `<div class="internal-about-sticky__grid">${pair.map((person) => `<a class="internal-sticky-person" href="#/board">
    <span class="internal-sticky-person__photo">${boardPortrait(person)}</span>
    <span><strong>${escapeHtml(person.name)}</strong><small>${escapeHtml(person.role || person.company || "")}</small></span>
  </a>`).join("")}</div>`;
  const renderMemberGroup = (group) => `<div class="internal-about-sticky__members">${group.map((member) => `<a class="internal-sticky-member" href="#/members">
    <span class="member-tile" aria-label="${escapeHtml(member.name)}">${memberLogo(member)}</span>
  </a>`).join("")}</div>`;
  return `<aside class="internal-about-sticky" aria-label="Aktuelle Inhalte">
    <section class="internal-sticky-section">
      <a class="internal-sticky-section-title" href="#/events">Aktuelles Event <span aria-hidden="true">→</span></a>
      ${rubricRotator(eventSlides, renderEvent, `<a class="internal-sticky-event" href="#/events"><span class="internal-sticky-event__picto">${aboutPicto("breakfast")}</span><span><strong>Neue Termine in Vorbereitung</strong><small>Zur Eventübersicht</small></span></a>`)}
    </section>
    <section class="internal-sticky-section">
      <a class="internal-sticky-section-title" href="#/topics">Themen <span aria-hidden="true">→</span></a>
      ${rubricRotator(topicSlides, renderTopic, `<a class="internal-sticky-topic" href="#/topics"><span class="internal-sticky-event__picto">${aboutPicto("dialog")}</span><span><strong>Themen ansehen</strong><small>Aktuelle Themen im Netzwerk</small></span></a>`)}
    </section>
    <section class="internal-sticky-section">
      <a class="internal-sticky-section-title" href="#/board">Vorstand <span aria-hidden="true">→</span></a>
      ${rubricRotator(boardSlides, renderBoardPair, `<a class="internal-sticky-person" href="#/board">Vorstand ansehen</a>`)}
    </section>
    <section class="internal-sticky-section">
      <a class="internal-sticky-section-title" href="#/members">Mitglieder <span aria-hidden="true">→</span></a>
      ${rubricRotator(memberSlides, renderMemberGroup, `<a class="internal-sticky-member" href="#/members">Mitglieder ansehen</a>`)}
    </section>
  </aside>`;
}

function aboutCardGroups(blocks, meta, options = {}) {
  const visibleBlocks = options.all ? blocks : blocks.slice(0, 8);
  const groups = chunkItems(visibleBlocks, 4).filter((group) => group.length);
  return groups.map((group) => `<div class="internal-about-button-block">${group.map((block) => aboutInternalCard(block, meta, options)).join("")}</div>`).join("");
}

function internalDesktopSection(block, meta) {
  const detailHref = `#/${meta.detailRoute}/${encodeURIComponent(block.slug)}`;
  const cta = block.button_text ? `<a class="button button--primary button--small" href="${escapeHtml(block.button_ziel || detailHref)}">${escapeHtml(block.button_text)}</a>` : `<a class="link" href="${detailHref}">Mehr lesen →</a>`;
  return `<article class="internal-section internal-section--${escapeHtml(block.typ)}">
    <div class="internal-section__head">${internalIcon(block.icon)}<div><p class="eyebrow">${escapeHtml(block.typ)}</p><h2>${escapeHtml(block.titel)}</h2><p>${escapeHtml(block.kurztext)}</p></div></div>
    <div class="editorial-text internal-section__body">${articleParagraphs(block.langtext)}</div>
    ${cta}
  </article>`;
}

function internalOverviewPage(bereich) {
  return async function renderInternalOverview() {
    const meta = internalPageMeta[bereich];
    const [blocks, events, board, members, topics] = bereich === "ueber_uns"
      ? await Promise.all([internalBlocks(bereich), listPublicEvents(), listPublicContent("boardMembers"), listPublicContent("members"), listPublicContent("topics")])
      : [await internalBlocks(bereich), [], [], [], []];
    const hero = blocks.find((block) => block.typ === "hero") || blocks[0];
    const cards = blocks.map((block) => internalCard(block, meta)).join("");
    const aboutCards = aboutCardGroups(blocks, meta);
    const aboutTexts = blocks.map((block) => aboutLongTextSection(block)).join("");
    const desktopSections = blocks.map((block) => internalDesktopSection(block, meta)).join("");
    if (bereich === "ueber_uns") {
      return publicShell(meta.active, `<section class="section internal-overview internal-overview--about"><div class="container"><div class="internal-about-layout"><div class="internal-about-main">
        <div class="internal-page-heading"><p class="eyebrow">${escapeHtml(meta.eyebrow)}</p><h1>${escapeHtml(meta.title)}</h1><p>${escapeHtml(meta.intro)}</p></div>
        <div class="internal-mobile-list internal-mobile-list--about">${aboutCards || `<div class="alert">Inhalte werden aktuell vorbereitet.</div>`}</div>
        <div class="internal-about-texts">${aboutTexts}</div>
        </div>${aboutStickyContent(events, board, members, topics)}</div>
      </div></section>`);
    }
    return publicShell(meta.active, `${subhero(meta.eyebrow, hero?.titel || meta.title, hero?.kurztext || meta.intro)}
      <section class="section internal-overview"><div class="container">
        <div class="internal-mobile-list">${cards || `<div class="alert">Inhalte werden aktuell vorbereitet.</div>`}</div>
        <div class="internal-desktop-sections">${desktopSections || `<div class="alert">Inhalte werden aktuell vorbereitet.</div>`}</div>
      </div></section>`);
  };
}

export async function internalDetailPage(bereich, slug) {
  const meta = internalPageMeta[bereich];
  const blocks = await internalBlocks(bereich);
  const block = blocks.find((item) => item.slug === slug);
  if (!block) return notFoundPage();
  const cta = block.button_text ? `<div class="actions" style="margin-top:24px"><a class="button button--primary" href="${escapeHtml(block.button_ziel || `#/${meta.route}`)}">${escapeHtml(block.button_text)}</a></div>` : "";
  return publicShell(meta.active, `${subhero(meta.eyebrow, block.titel, block.kurztext)}
    <section class="section"><div class="container internal-detail"><a class="link" href="#/${meta.route}">← Zurueck</a><article class="detail-main"><div class="editorial-text">${articleParagraphs(block.langtext)}</div>${cta}</article></div></section>`);
}

function articleSourcesList(item = {}) {
  const rawSources = Array.isArray(item.sources)
    ? item.sources
    : Array.isArray(item.source_snapshot_json)
      ? item.source_snapshot_json
      : Array.isArray(item.sourceSnapshotJson)
        ? item.sourceSnapshotJson
        : [];
  const sources = rawSources
    .filter((source) => source?.url && (source.title || source.publisher || source.name))
    .slice(0, 8);
  if (!sources.length) return "";
  return `<details class="sources-list" open><summary>Quellen anzeigen</summary><ul>${sources.map((source) => `<li><a class="link" href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.publisher || source.name || "Quelle")}: ${escapeHtml(source.title || source.relevance_note || source.url)}</a></li>`).join("")}</ul></details>`;
}

function publicNewsItems(items = []) {
  return items.filter((item) => {
    const isNews = item.page === "news" || item.section === "news";
    const isHidden = item.visible === false || item.status === "archived" || item.status === "draft" || item.visibility === "internal";
    return isNews && !isHidden;
  });
}

function isRetrospectiveArticle(item = {}) {
  const category = String(item.category || "").toLowerCase();
  const inPress = item.page === "press" || item.section === "pressRelease";
  const isRetrospective = item.isRetrospective || category.includes("rückblick") || category.includes("rueckblick") || category.includes("rückblick") || category.includes("rückblick");
  const isHidden = item.status === "archived" || item.status === "draft" || item.visibility === "internal";
  return inPress && isRetrospective && !isHidden;
}

function isAiGeneratedArticle(item = {}) {
  return item.author_type === "ai" || item.authorType === "ai" || item.aiGenerated === true;
}

function editorialPrioritySort(a = {}, b = {}) {
  const manualA = isAiGeneratedArticle(a) ? 0 : 1;
  const manualB = isAiGeneratedArticle(b) ? 0 : 1;
  if (manualA !== manualB) return manualB - manualA;
  return String(b.publishDate || b.validFrom || b.updatedAt || "").localeCompare(String(a.publishDate || a.validFrom || a.updatedAt || ""));
}

function isAudioAvailableStatus(status = "") {
  return ["aktuell", "ready", "available", "fertig"].includes(String(status || "").toLowerCase());
}

function availableAudioUrl(url = "", status = "", fallbackStatus = "") {
  if (!url) return "";
  const effectiveStatus = status || fallbackStatus;
  return isAudioAvailableStatus(effectiveStatus) ? url : "";
}

function ttsReader({ title = "", text = "", audioUrl = "", audioAccessibleUrl = "", audioNaturalUrl = "", audioStatus = "", audioAccessibleStatus = "", audioNaturalStatus = "" }) {
  const fallbackUrl = availableAudioUrl(audioUrl, audioStatus);
  const accessibleUrl = availableAudioUrl(audioAccessibleUrl, audioAccessibleStatus, audioStatus) || fallbackUrl;
  const naturalUrl = availableAudioUrl(audioNaturalUrl, audioNaturalStatus, audioStatus) || accessibleUrl;
  if (!accessibleUrl && !naturalUrl) return "";
  return `<div class="tts-reader" data-tts-reader>
    <button type="button" class="tts-reader__toggle" data-tts-toggle aria-expanded="false" aria-label="Audio öffnen"><span aria-hidden="true">▶</span></button>
    <div class="tts-reader__meta"><p class="eyebrow">Audio</p><strong>${escapeHtml(title || "Vorlesen")}</strong></div>
    <template data-tts-source>${escapeHtml(text)}</template>
    <div class="tts-reader__actions" data-tts-actions hidden>
      <button type="button" class="button button--primary button--small" data-tts-play data-tts-mode="natural" data-audio-url="${escapeHtml(naturalUrl)}" ${naturalUrl ? "" : "disabled"}><span aria-hidden="true">Audio</span> Anhören</button>
      <button type="button" class="button button--secondary button--small" data-tts-play data-tts-mode="accessible" data-audio-url="${escapeHtml(accessibleUrl)}" ${accessibleUrl ? "" : "disabled"}><span aria-hidden="true">Aa</span> Barrierefrei vorlesen</button>
    </div>
  </div>`;
}

function galleryPlayCta(gallery, images) {
  if (!gallery || !images.length) return "";
  const payload = escapeHtml(JSON.stringify({
    title: gallery.title || "Bildergalerie",
    images: images.map((image) => ({
      url: image.url,
      caption: image.caption || image.title || "",
      altText: image.altText || image.caption || gallery.title || "Galeriebild"
    }))
  }));
  return `<section class="article-gallery-cta"><div><p class="eyebrow">Bildergalerie</p><h3>${escapeHtml(gallery.title || "Bilder ansehen")}</h3><p>${images.length} Bilder als Slideshow ansehen.</p></div><button class="button button--primary gallery-play-cta__button" type="button" data-gallery-play data-gallery-payload="${payload}"><span>▶</span> Galerie abspielen</button></section>`;
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
  const latestNewsItems = publicNewsItems(editorial)
    .sort((a, b) => String(b.publishDate || b.validFrom || b.updatedAt || "").localeCompare(String(a.publishDate || a.validFrom || a.updatedAt || "")))
    .slice(0, 4);
  const featuredTopic = topics[0];
  const homeTopics = topics.filter((topic) => topic.id !== featuredTopic?.id).slice(0, 3);
  const quickCards = latestNewsItems.map((item) => ({
    eyebrow: item.category || "News",
    title: item.title || "Aktuelles von PROdigitalTV",
    text: teaserText(item.subtitle || item.introText || item.shortText || item.teaserText || item.bodyText || "Meldungen, Hinweise und Neuigkeiten aus dem Verein und der digitalen Medienwirtschaft.", 130),
    url: `#/news/${item.id}`,
    link: "News lesen"
  }));
  const mobileCards = [
    ["#/events", "events", "Events", "Medienfruehstuecke, Veranstaltungen und Rueckblicke"],
    ["#/topics", "topics", "Themen", "Aktuelle Entwicklungen, Positionen und Expertise"],
    ["#/members", "members", "Mitglieder", "Unser Netzwerk, Vorteile und Mitglied werden"],
    ["#/about", "about", "Ueber uns", "Der Verband, Vorstand und Ziele"]
  ];
  const mobileHome = `<section class="pdtv-mobile-home" aria-label="Mobile tartseite">
    <div class="container">
      <div class="pdtv-mobile-hero">
        <h1>Digitaler Content.<br>Starke Verbindungen.<br>Gemeinsam fuer die <span>Medienzukunft.</span></h1>
        <p>PROdigitalTV ist das Netzwerk fuer digitale Medien, Streaming, Smart-TV, Plattformen und regionale Anbieter.</p>
        <article class="pdtv-mobile-next-event">
          <span class="pdtv-mobile-icon" aria-hidden="true">□</span>
          <div>
            <p>Naechstes Medienfruehstueck</p>
            ${next ? `<h2>${escapeHtml(formatDate(next.date))}${next.city ? ` · ${escapeHtml(next.city)}` : ""}</h2><span>${escapeHtml(next.subtitle || next.title || "")}</span><div class="pdtv-mobile-next-actions"><a class="button button--primary button--small" href="#/register/${next.id}">Anmelden</a><a href="#/event/${next.id}">Details ansehen -></a></div>` : `<h2>Neue Termine in Vorbereitung</h2><span>Die naechsten Formate werden in Kuerze veroeffentlicht.</span><div class="pdtv-mobile-next-actions"><a href="#/events">Events ansehen -></a></div>`}
          </div>
        </article>
      </div>
      <nav class="pdtv-mobile-card-grid" aria-label="Hauptbereiche">
        ${mobileCards.map(([href, type, title, text], index) => `<a class="pdtv-mobile-card pdtv-mobile-card--${type} ${index === 0 || index === 3 ? "pdtv-mobile-card--dark" : ""}" href="${href}"><span class="pdtv-mobile-card__icon" aria-hidden="true"></span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(text)}</small></a>`).join("")}
      </nav>
    </div>
  </section>`;
  return publicShell("home", `
    ${mobileHome}
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
  if (upcoming.length === 1) return eventDetailPage(upcoming[0].id);
  if (upcoming.length === 0) return archivePage();
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
  const [speakers, sponsors, topics, galleries] = await Promise.all([listPublicContent("speakers"), listPublicContent("sponsors"), listPublicContent("topics"), listPublicContent("galleries")]);
  const restricted = event.accessType === "members_only" && !isMember();
  if (restricted && !event.showPublicTeaser) return publicShell("events", subhero("Geschuetzter Bereich", "Nur fuer Mitglieder", "Bitte melden Sie sich an, um dieses Event zu sehen."));
  const assignedTopics = topics.filter((topic) => event.topicIds.includes(topic.id));
  const assignedSpeakers = speakers.filter((speaker) => event.speakerIds.includes(speaker.id));
  const eventPartners = sponsors.filter((sponsor) => event.sponsorIds.includes(sponsor.id) || event.hostId === sponsor.id);
  const assignedGallery = galleries.find((gallery) => gallery.id === event.galleryId) || galleries.find((gallery) => gallery.eventId === event.id && gallery.status === "published" && gallery.visibility === "public");
  const assignedGalleryImages = Array.isArray(assignedGallery?.images)
    ? [...assignedGallery.images].filter((entry) => entry.url).sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)).slice(0, 24)
    : [];
  const registrationAllowed = event.registrationEnabled && (!restricted || isMember());
  const eventImageUrl = archiveEventImageUrl(event);
  const introText = event.description || event.shortDescription || event.subtitle || "";
  const longText = event.postEventummary || event.archiveText || event.longDescription || event.bodyText || event.articleText || "";
  const haseparateLongText = longText.trim() && longText.trim() !== introText.trim();
  return publicShell("events", `${subhero(event.eventType, event.title, event.subtitle)}
    <section class="section"><div class="container detail-grid">
      <article class="detail-main">
        ${eventImageUrl ? `<figure class="event-detail-image"><img src="${escapeHtml(eventImageUrl)}" alt="Eventbild ${escapeHtml(event.title)}" loading="lazy"></figure>` : ""}
        ${restricted ? `<div class="alert alert--warning">Details und Anmeldung dieses Mitglieder-Events stehen nach dem Login zur Verfuegung.</div>` : ""}
        <h2>Zum Event</h2>${introText ? `<p class="lead">${escapeHtml(introText)}</p>` : ""}
        ${haseparateLongText ? `<h2>Rückblick</h2><div class="editorial-text">${articleParagraphs(longText)}</div>` : ""}
        <h2>Themen</h2><div class="filters">${assignedTopics.map((topic) => `<a class="filter" href="#/topic/${topic.id}">${escapeHtml(topic.title)}</a>`).join("")}</div>
        ${event.lunchNote ? `<div class="alert">${escapeHtml(event.lunchNote)}</div>` : ""}
        ${restricted ? "" : `<section class="venue-stage"><div class="venue-stage__place"><p class="eyebrow">Veranstaltungsort</p><h2>${escapeHtml(event.locationName)}</h2><p>${escapeHtml(event.address || "")}${event.address ? "<br>" : ""}${escapeHtml(event.city)}${event.phone ? `<br>Telefon: ${escapeHtml(event.phone)}` : ""}</p></div><div class="venue-stage__partners"><p class="eyebrow">Gastgeber und Sponsoren</p>${eventPartners.length ? eventPartners.map((partner) => `<article class="partner-spotlight"><span class="avatar">${initials(partner.name)}</span><div><span class="tag tag--red">${escapeHtml(partner.role)}</span><h3>${escapeHtml(partner.name)}</h3>${partner.description ? `<p>${escapeHtml(partner.description)}</p>` : ""}</div></article>`).join("") : `<p>Partner werden bei Bekanntgabe ergaenzt.</p>`}</div></section>
        ${assignedSpeakers.length ? `<h2>Referentinnen und Referenten</h2><div class="speaker-grid">${assignedSpeakers.map((speaker) => `<article class="speaker-profile"><div class="speaker-profile__portrait">${speakerPortrait(speaker)}</div><div class="speaker-profile__body"><h3>${escapeHtml(speaker.name)}</h3><p class="speaker-profile__position">${escapeHtml(speaker.position)}${speaker.company ? ` · ${escapeHtml(speaker.company)}` : ""}</p>${speaker.shortBio ? `<p class="speaker-profile__intro">${escapeHtml(speaker.shortBio)}</p>` : ""}${speaker.longBio ? `<p>${escapeHtml(speaker.longBio)}</p>` : ""}</div></article>`).join("")}</div>` : ""}`}
        ${assignedGalleryImages.length ? galleryPlayCta(assignedGallery, assignedGalleryImages) : ""}
      </article>
      <aside class="detail-aside">
        <span class="tag ${event.accessType !== "public" ? "tag--red" : ""}">${accessLabels[event.accessType]}</span>
        <div class="fact"><label>Datum</label><strong>${formatDate(event.date)}</strong></div>
        ${event.startTime ? `<div class="fact"><label>Zeit</label><strong>${event.startTime}${event.endTime ? ` - ${event.endTime}` : ""} Uhr</strong></div>` : ""}
        <div class="fact"><label>Ort</label><strong>${escapeHtml(event.locationName)}<br>${escapeHtml(event.city)}</strong></div>
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
    <section class="section"><div class="container"><div class="card-grid card-grid--three editorial-list editorial-list--topics">${topics.map(topicCard).join("")}</div></div></section>`);
}

export async function newsPage() {
  const cmsNews = publicNewsItems(await listPublicContent("editorialContent"));
  const news = [...cmsNews, ...editorialFallbackNews.filter((fallback) => !cmsNews.some((item) => item.id === fallback.id))]
    .sort(editorialPrioritySort);
  return publicShell("news", `${subhero("News", "Aktuelles von PROdigitalTV.", "Meldungen, Hinweise und Neuigkeiten aus dem Verein und der digitalen Medienwirtschaft.")}
    <section class="section"><div class="container">${news.length ? `<div class="card-grid card-grid--three editorial-list editorial-list--news">${news.map((item) => `<a class="quick-card news-card" href="#/news/${item.id}">${item.imageUrl ? `<figure class="news-card__thumb"><img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.title || "News")}"></figure>` : ""}<p class="eyebrow">${escapeHtml(item.category || "News")}</p><h3>${escapeHtml(item.title || "")}</h3>${item.subtitle ? `<p class="news-card__subtitle">${escapeHtml(item.subtitle)}</p>` : ""}<p>${escapeHtml(item.shortText || item.teaserText || item.introText || item.bodyText || "").slice(0, 180)}</p></a>`).join("")}</div>` : `<div class="alert">Aktuell sind keine News veroeffentlicht.</div>`}</div></section>`);
}

export async function newsDetailPage(id) {
  const item = await getOne("editorialContent", id) || editorialFallbackNews.find((entry) => entry.id === id);
  const isRetrospective = isRetrospectiveArticle(item);
  if (!item || (item.page !== "news" && item.section !== "news" && !isRetrospective)) return notFoundPage();
  if (!isRetrospective && (item.visible === false || item.status === "archived" || item.status === "draft" || item.visibility === "internal")) return notFoundPage();
  const [sponsors, galleries, events] = await Promise.all([listPublicContent("sponsors"), listPublicContent("galleries"), listPublicEvents()]);
  const date = item.publishDate || item.validFrom || item.date || item.updatedAt || "";
  const text = item.longDescription || item.articleText || item.bodyText || item.mainText || item.text || item.fullText || item.longText || item.shortText || item.teaserText || "";
  const sponsor = item.sponsorId ? sponsors.find((entry) => entry.id === item.sponsorId) : null;
  const linkedEvent = retrospectiveLinkedEvent(item, events);
  const articleImageUrl = item.imageUrl || (linkedEvent ? archiveEventImageUrl(linkedEvent) : "");
  const selectedGallery = item.galleryId ? galleries.find((gallery) => gallery.id === item.galleryId) : null;
  const attachedGalleryImages = Array.isArray(selectedGallery?.images)
    ? [...selectedGallery.images].filter((entry) => entry.url).sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)).slice(0, 12)
    : [];
  const leadMedia = attachedGalleryImages.length ? galleryPlayCta(selectedGallery, attachedGalleryImages) : "";
  const detailection = isRetrospective ? "archive" : "news";
  const detailTitle = isRetrospective ? "Rückblicke" : "News";
  const detailIntro = isRetrospective ? "Nachberichte, Bilder und Dokumentation vergangener PROdigitalTV-Veranstaltungen." : "Meldungen, Hinweise und Neuigkeiten aus dem Verein und der digitalen Medienwirtschaft.";
  const backHref = isRetrospective ? "#/archive" : "#/news";
  const backText = isRetrospective ? "Zurück zu Rückblicke" : "Zurück zu News";
  const sectionLabel = isRetrospective ? "Event-Nachlauf" : item.category || "News";
  const allText = isRetrospective ? "Alle Rückblicke" : "Alle News";
  return publicShell(detailSection, `${subhero("", detailTitle, detailIntro)}
    <section class="section"><div class="container detail-grid">
      <article class="detail-main news-detail">
        <a class="link news-detail__back" href="${backHref}">${backText}</a>
        <p class="eyebrow">${escapeHtml(item.category || "News")}${date ? ` · ${formatDate(date)}` : ""}</p>
        ${articleHeader({
          title: item.title || "",
          intro: item.subtitle || "",
          logoUrl: articleImageUrl,
          logoAlt: `Artikelmotiv ${item.title || "News"}`
        })}
        ${ttsReader({ title: item.title || "", text, audioUrl: item.audioUrl || "", audioAccessibleUrl: item.audioAccessibleUrl || "", audioNaturalUrl: item.audioNaturalUrl || "", audioStatus: item.audioStatus || "", audioAccessibleStatus: item.audioAccessibleStatus || "", audioNaturalStatus: item.audioNaturalStatus || "" })}
        <div class="editorial-text">${leadMedia}${articleParagraphs(text)}</div>
        ${articleSourcesList(item)}
      </article>
      <aside class="detail-aside">
        ${sponsor?.logoUrl ? `<div class="sponsor-logo-card"><span>${escapeHtml(sponsor.role || "Sponsor")}</span><img src="${escapeHtml(sponsor.logoUrl)}" alt="Logo ${escapeHtml(sponsor.name || "")}"><strong>${escapeHtml(sponsor.name || "")}</strong></div>` : ""}
        <div class="fact"><label>Rubrik</label><strong>${escapeHtml(item.isRetrospective ? "Rückblick" : item.category || "News")}</strong></div>
        ${date ? `<div class="fact"><label>Datum</label><strong>${formatDate(date)}</strong></div>` : ""}
        <a class="button button--secondary" href="${backHref}">${allText}</a>
      </aside>
    </div></section>`);
}

export async function topicDetailPage(id) {
  const [topic, events, sponsors, galleries, allTopics] = await Promise.all([getOne("topics", id), listPublicEvents(), listPublicContent("sponsors"), listPublicContent("galleries"), listPublicContent("topics")]);
  if (!topic) return notFoundPage();
  const linked = events.filter((event) => event.topicIds.includes(id) && event.visibility === "public" && !isPastEvent(event));
  const relatedTopics = allTopics.filter((entry) => entry.id !== topic.id).slice(0, 4);
  const topicIntro = topic.shortDescription || topic.subtitle || topic.longDescription || topic.bodyText || "";
  const topicText = topic.longDescription || topic.bodyText || topic.shortDescription || "";
  const selectedGallery = topic.galleryId ? galleries.find((gallery) => gallery.id === topic.galleryId) : null;
  const attachedGalleryImages = Array.isArray(selectedGallery?.images)
    ? [...selectedGallery.images].filter((entry) => entry.url).sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)).slice(0, 12)
    : [];
  const leadMedia = attachedGalleryImages.length ? galleryPlayCta(selectedGallery, attachedGalleryImages) : "";
  const editorialBlock = topicText
    ? `<section class="section section--white"><div class="container topic-article">${ttsReader({ title: topic.title || "", text: topicText, audioUrl: topic.audioUrl || "", audioAccessibleUrl: topic.audioAccessibleUrl || "", audioNaturalUrl: topic.audioNaturalUrl || "", audioStatus: topic.audioStatus || "", audioAccessibleStatus: topic.audioAccessibleStatus || "", audioNaturalStatus: topic.audioNaturalStatus || "" })}${articleParagraphs(topicText)}</div></section>`
    : "";
  const relatedTopicsBlock = relatedTopics.length
    ? `<section class="section section--white section--related-topics"><div class="container"><div class="section-head"><div><p class="eyebrow">Weitere Themen</p><h2>Mehr aus der Rubrik</h2></div></div><div class="card-grid card-grid--four">${relatedTopics.map(topicCard).join("")}</div></div></section>`
    : "";
  return publicShell("topics", `<section class="section section--article-head"><div class="container">
      ${articleHeader({
        eyebrow: "Thema",
        title: topic.title || "",
        intro: topicIntro,
        logoUrl: topic.imageUrl || "",
        logoAlt: `Themenmotiv ${topic.title || "Thema"}`
      })}
    </div></section>
    ${leadMedia ? `<section class="section section--flush"><div class="container">${leadMedia}</div></section>` : ""}
    ${editorialBlock}
    ${relatedTopicsBlock}
    <section class="section"><div class="container"><div class="section-head"><div><p class="eyebrow">Verknuepfte Events</p><h2>Im Dialog</h2></div></div><div class="card-grid card-grid--three">${linked.map((event) => eventCard(event, event.date < "2026-05-26", sponsors)).join("")}</div></div></section>`);
}

export const aboutPage = internalOverviewPage("ueber_uns");

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
  const [allEvents, sponsors, editorial] = await Promise.all([listPublicEvents(), listPublicContent("sponsors"), listPublicContent("editorialContent")]);
  const events = allEvents.filter((event) => isPastEvent(event))
    .sort((a, b) => (b.date || "0000-00-00").localeCompare(a.date || "0000-00-00"));
  const retrospectives = editorial
    .filter(isRetrospectiveArticle)
    .sort((a, b) => String(b.publishDate || b.validFrom || b.updatedAt || "").localeCompare(String(a.publishDate || a.validFrom || a.updatedAt || "")));
  const items = retrospectives.map((item) => archiveListEditorial(item, sponsors, events)).join("");
  return publicShell("archive", `${subhero("Event-Nachlauf", "Eventarchiv", "Nachberichte, Bilder und Dokumentation vergangener PROdigitalTV-Veranstaltungen.")}
    <section class="section"><div class="container"><div class="section-head archive-list-head"><div><p class="eyebrow">Medienfruehstuecke</p><h2>Rückblicke</h2><p>Vergangene Veranstaltungen mit Nachbericht, Ort, Gastgeber und Detailseite.</p></div></div><div class="archive-list archive-list--compact">${items || `<div class="alert">Rueckblicke werden aktuell vorbereitet.</div>`}</div></div></section>`);
}

export async function downloadsPage() {
  const downloads = (await listPublicContent("downloads"))
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
  return publicShell("downloads", `${subhero("Downloads", "Oeffentliche Downloads.", "Vereinssatzung, Beitraege und weitere oeffentliche Dokumente von PROdigitalTV.")}
    <section class="section"><div class="container">${downloads.length ? `<div class="card-grid card-grid--three">${downloads.map(downloadCard).join("")}</div>` : `<div class="alert">Oeffentliche Downloads werden aktuell vorbereitet.</div>`}</div></section>`);
}

export function webappQrPage() {
  const webappUrl = "https://prodigitaltv-da47b.web.app/#/home";
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=720x720&margin=2&data=${encodeURIComponent(webappUrl)}`;
  return publicShell("webapp-qr", `${subhero("WebApp", "QR-Code zur mobilen WebApp.", "Direkt scannen und PROdigitalTV auf dem Smartphone oeffnen.")}
    <section class="section"><div class="container webapp-qr-page">
      <article class="webapp-qr-card">
        <figure class="webapp-qr-card__code"><img src="${escapeHtml(qrUrl)}" alt="QR-Code zur PROdigitalTV WebApp" loading="lazy"></figure>
        <div class="webapp-qr-card__copy">
          <p class="eyebrow">PROdigitalTV WebApp</p>
          <h2>QR-Code scannen</h2>
          <p>Der Code fuehrt direkt zur mobilen PROdigitalTV-WebApp.</p>
          <p class="webapp-qr-card__url">${escapeHtml(webappUrl)}</p>
          <div class="actions"><a class="button button--primary" href="${escapeHtml(webappUrl)}" target="_blank" rel="noreferrer">WebApp oeffnen</a><a class="button button--secondary" href="#/home">Zur Website</a></div>
        </div>
      </article>
    </div></section>`);
}

function joinAside(downloads, editorial) {
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
  const joinCta = `<a class="join-aside-cta" href="#membership-application-form" data-join-scroll>
    ${aboutPicto("membership")}
    <span><strong>Mitglied werden</strong><small>Direkt zum Antrag springen</small></span>
  </a>`;
  return `<aside class="join-aside join-aside--overview">${joinCta}<h2>Downloads</h2>${publicDownloads.length ? `<div class="join-download-fields">${publicDownloads.map(downloadField).join("")}</div>` : `<a class="button button--secondary" href="#/downloads">Zu den oeffentlichen Downloads</a>`}</aside>`;
}

function membershipFormSection() {
  return `<section class="section"><div class="container join-form-wrap"><form id="membership-application-form" class="form-card form-grid join-form">
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
  </form></div></section>`;
}

export async function joinPage() {
  const meta = internalPageMeta.mitglied_werden;
  const [blocks, downloads, editorial] = await Promise.all([internalBlocks("mitglied_werden"), listPublicContent("downloads"), listPublicContent("editorialContent")]);
  const hero = blocks.find((block) => block.typ === "hero") || blocks[0];
  const cardBlocks = blocks.filter((block) => block.typ !== "hero");
  const joinCards = aboutCardGroups(cardBlocks, meta, { summary: "long", all: true, joinCta: true });
  const joinTexts = blocks.map((block) => aboutLongTextection(block, { joinCta: block.typ !== "hero" })).join("");
  const joinIntroCard = `<article class="join-intro-card">
    ${aboutPicto(hero?.icon || "membership")}
    <div><p class="eyebrow">Mitglied werden</p><h2>${escapeHtml(hero?.titel || meta.title)}</h2><p>${escapeHtml(hero?.langtext || hero?.kurztext || meta.intro)}</p></div>
    <button class="button button--primary" type="button" data-join-scroll>Mitgliedsantrag</button>
  </article>`;
  return publicShell("join", `<section class="section internal-overview internal-overview--join"><div class="container"><div class="internal-about-layout"><div class="internal-about-main">
    <div class="internal-page-heading"><p class="eyebrow">${escapeHtml(meta.eyebrow)}</p><h1>${escapeHtml(hero?.titel || meta.title)}</h1><p>${escapeHtml(hero?.kurztext || meta.intro)}</p></div>
    ${joinIntroCard}
    <div class="internal-mobile-list internal-mobile-list--about">${joinCards || `<div class="alert">Inhalte werden aktuell vorbereitet.</div>`}</div>
    <div class="internal-about-texts">${joinTexts}</div>
  </div>${joinAside(downloads, editorial)}</div></div></section>${membershipFormSection()}`);
}

export async function loginPage() {
  const localHost = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
  const demoAvailable = !firebaseEnabled() || localPreviewMode() || localHost;
  const demoControls = demoAvailable ? `<div class="field"><label>Demo-Rolle fuer lokale Vorschau</label><select name="role"><option value="admin">Admin</option><option value="editor">Redakteur</option><option value="member">Mitglied</option></select></div>` : "";
  const emailValue = demoAvailable ? "admin@prodigitaltv.de" : "";
  const passwordValue = demoAvailable ? "demo" : "";
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
