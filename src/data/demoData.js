import { internalEditorialSeed } from "./internalEditorialSeed.js";

export const accessLabels = {
  public: "Fuer alle Interessierten",
  members_only: "Nur fuer Mitglieder",
  invitation_only: "Nur mit Einladung"
};

export const lifecycleLabels = {
  planning: "Planung",
  invitation: "Einladung",
  registration_open: "Anmeldung geoeffnet",
  registration_closed: "Anmeldung geschlossen",
  event_day: "Durchfuehrung",
  post_processing: "Nacharbeit",
  archive_published: "Im Archiv veroeffentlicht",
  archived: "Archiviert"
};

const salzburgHangarImageUrl = "/assets/official/events/event-salzburg-red-bull-hangar7-2026.svg";

export const events = [
  {
    id: "event-salzburg-red-bull-hangar7-2026",
    title: "PROdigitalTV Medienfruehstueck im Hangar-7",
    subtitle: "Branchendialog bei Red Bull in Salzburg mit anschließendem Mittagessen im Bulls Corner.",
    description: "PROdigitalTV laedt am 8. Dezember 2026 zum Medienfruehstueck in den Hangar-7 nach Salzburg ein. Im Mittelpunkt stehen persoenlicher Austausch, aktuelle Themen der digitalen Medienwirtschaft und die Vernetzung im besonderen Umfeld von Red Bull. Im Anschluss ist ein gemeinsames Mittagessen im Bulls Corner Salzburg vorgesehen.",
    date: "2026-12-08",
    startTime: "09:00",
    endTime: "14:00",
    locationName: "Red Bull Hangar-7",
    address: "Wilhelm-Spazier-Strasse 7a, 5020 Salzburg, Oesterreich",
    city: "Salzburg",
    phone: "+43 662 2197",
    eventType: "Medienfruehstueck",
    accessType: "public",
    visibility: "public",
    showPublicTeaser: true,
    requiresLogin: false,
    allowPublicRegistration: true,
    allowMemberRegistration: true,
    invitationCodeRequired: false,
    status: "published",
    lifecyclePhase: "registration_open",
    expiresAt: "2026-12-09T00:00:00",
    registrationEnabled: true,
    registrationRequired: true,
    registrationDeadline: "2026-12-01T23:59:00",
    maxParticipants: 80,
    registrationCount: 0,
    waitingListEnabled: true,
    registrationExportEnabled: true,
    topicIds: ["plattformstrategien", "ott", "monetarisierung"],
    speakerIds: [],
    sponsorIds: [],
    hostId: "red-bull-members-club",
    imageUrl: salzburgHangarImageUrl,
    postEventSummary: "",
    lunchNote: "Im Anschluss ist ein gemeinsames Mittagessen im Bulls Corner Salzburg vorgesehen.",
    internalNote: "Mittagessen im Bulls Corner Salzburg einplanen.",
    createdAt: "2026-05-26T10:00:00",
    updatedAt: "2026-05-26T10:00:00"
  },
  {
    id: "event-berlinale-2026",
    title: "Medienfruehstueck zur Berlinale",
    subtitle: "Wie hat KI die Medienwirtschaft veraendert?",
    description: "PROdigitalTV Medienfruehstueck in Berlin im Rahmen der Berlinale.",
    date: "2026-02-17",
    startTime: "",
    endTime: "",
    locationName: "HEUSSEN Rechtsanwaltsgesellschaft mbH",
    address: "",
    city: "Berlin",
    eventType: "Medienfruehstueck",
    accessType: "public",
    visibility: "public",
    showPublicTeaser: true,
    requiresLogin: false,
    allowPublicRegistration: true,
    allowMemberRegistration: true,
    invitationCodeRequired: false,
    status: "published",
    lifecyclePhase: "archive_published",
    registrationEnabled: false,
    registrationRequired: false,
    maxParticipants: null,
    registrationCount: 0,
    waitingListEnabled: false,
    registrationExportEnabled: true,
    topicIds: ["ki-medienwirtschaft"],
    speakerIds: [],
    sponsorIds: [],
    hostId: "heussen",
    postEventSummary: "Zum Auftakt des Veranstaltungsjahres in Berlin lud PROdigitalTV am 17. Februar 2026 in die Kanzlei HEUSSEN ein. Im Mittelpunkt des Medienfruehstuecks stand die Frage, wie kuenstliche Intelligenz Arbeitsweisen, Inhalte und Verantwortung in der Medienwirtschaft veraendert.",
    createdAt: "2026-02-17T10:00:00",
    updatedAt: "2026-05-26T10:00:00"
  },
  {
    id: "event-leica-welt-2026",
    title: "Medienfruehstueck in der Leica-Welt",
    subtitle: "PROdigitalTV in Wetzlar",
    description: "PROdigitalTV Medienfruehstueck im Ernst-Leitz Museum in Wetzlar.",
    date: "2026-01-13",
    startTime: "",
    endTime: "",
    locationName: "Ernst-Leitz Museum",
    address: "",
    city: "Wetzlar",
    eventType: "Medienfruehstueck",
    accessType: "public",
    visibility: "public",
    showPublicTeaser: true,
    requiresLogin: false,
    allowPublicRegistration: false,
    allowMemberRegistration: false,
    invitationCodeRequired: false,
    status: "published",
    lifecyclePhase: "archive_published",
    registrationEnabled: false,
    registrationRequired: false,
    maxParticipants: null,
    registrationCount: 0,
    waitingListEnabled: false,
    registrationExportEnabled: true,
    topicIds: [],
    speakerIds: [],
    sponsorIds: [],
    hostId: "ernst-leitz-museum",
    postEventSummary: "Mit dem Medienfruehstueck in der Leica-Welt setzte PROdigitalTV den Branchendialog am 13. Januar 2026 in Wetzlar fort. Das Ernst-Leitz Museum bildete den Rahmen fuer Austausch und persoenliche Vernetzung.",
    createdAt: "2026-01-13T10:00:00",
    updatedAt: "2026-05-26T10:00:00"
  },
  {
    id: "event-salzburg-2025",
    title: "Medienfruehstueck in Salzburg",
    subtitle: "PROdigitalTV im Red Bull Members Club Hangar 7",
    description: "PROdigitalTV Veranstaltung in Salzburg am 19. und 20. November 2025.",
    date: "2025-11-20",
    startTime: "",
    endTime: "",
    locationName: "Red Bull Members Club Hangar 7",
    address: "",
    city: "Salzburg",
    eventType: "Medienfruehstueck",
    accessType: "public",
    visibility: "public",
    showPublicTeaser: true,
    requiresLogin: false,
    allowPublicRegistration: false,
    allowMemberRegistration: false,
    invitationCodeRequired: false,
    status: "published",
    lifecyclePhase: "archive_published",
    registrationEnabled: false,
    maxParticipants: null,
    registrationCount: 0,
    waitingListEnabled: false,
    topicIds: [],
    speakerIds: [],
    sponsorIds: [],
    hostId: "red-bull-members-club",
    postEventSummary: "Am 19. und 20. November 2025 brachte PROdigitalTV Mitglieder und Gaeste in Salzburg zusammen. Der Red Bull Members Club Hangar 7 bot einen besonderen Rahmen fuer das Medienfruehstueck und den fachlichen Austausch.",
    createdAt: "2025-11-20T10:00:00",
    updatedAt: "2026-05-26T10:00:00"
  }
];

function officialArchiveEvent(officialId, date, title, locationName, city, options = {}) {
  const accessType = options.accessType || "public";
  const formattedDate = options.dateLabel || (date ? date.split("-").reverse().join(".") : "Terminangabe im Altarchiv nicht verfuegbar");
  return {
    id: `event-archive-${officialId}`,
    officialId,
    title,
    subtitle: options.subtitle || "Mitteilung aus dem Veranstaltungsarchiv",
    description: options.description || `${title} fand am ${formattedDate} in ${city || locationName || "einem Veranstaltungsformat von PROdigitalTV"} statt.`,
    date,
    displayDate: formattedDate,
    startTime: "",
    endTime: "",
    locationName,
    address: "",
    city,
    eventType: options.eventType || "Medienfruehstueck",
    accessType,
    visibility: "public",
    showPublicTeaser: true,
    requiresLogin: accessType === "members_only",
    allowPublicRegistration: false,
    allowMemberRegistration: false,
    invitationCodeRequired: false,
    status: "published",
    lifecyclePhase: "archive_published",
    registrationEnabled: false,
    registrationRequired: false,
    maxParticipants: null,
    registrationCount: 0,
    waitingListEnabled: false,
    registrationExportEnabled: false,
    topicIds: options.topicIds || [],
    speakerIds: [],
    sponsorIds: [],
    hostId: options.hostId || "",
    imageUrl: options.imageUrl || `/assets/official/events/archive-${officialId}.svg`,
    postEventSummary: options.summary || `${title} ist als Rueckblick im PROdigitalTV-Archiv erfasst. Die Veranstaltung steht fuer Dialog, Austausch und Vernetzung in der digitalen Medienwirtschaft.`,
    createdAt: `${date || "2014-01-01"}T10:00:00`,
    updatedAt: "2026-05-26T10:00:00"
  };
}

export const additionalArchiveEvents = [
  officialArchiveEvent("79", "2025-10-22", "20 Prozent Rabatt fuer die Medientage Muenchen 2025", "Medientage Muenchen", "Muenchen", { accessType: "members_only", eventType: "Mitgliederveranstaltung" }),
  officialArchiveEvent("77", "2025-09-24", "20 Prozent Rabatt fuer die MediaTech Hub Conference 2025", "Studio Babelsberg", "Babelsberg", { accessType: "members_only", eventType: "Mitgliederveranstaltung" }),
  officialArchiveEvent("76", "2025-05-15", "Medienfruehstueck in Muenchen", "Kanzlei Heuking Kuehn Lueer Wojtek", "Muenchen", { imageUrl: "/assets/official/events/archive-76.jpg", summary: "Am 15. Mai 2025 lud PROdigitalTV zum Medienfruehstueck nach Muenchen ein. Die Veranstaltung in der Kanzlei Heuking Kuehn Lueer Wojtek verband aktuelle Branchenthemen mit persoenlichem Austausch." }),
  officialArchiveEvent("75", "2025-02-18", "Medienfruehstueck in Berlin: Die Agenda", "Kanzlei HEUSSEN", "Berlin", { hostId: "heussen" }),
  officialArchiveEvent("74", "2024-11-28", "Medienfruehstueck bei Red Bull in Salzburg", "Red Bull Arena / Bull's Corner", "Salzburg", { hostId: "red-bull-members-club" }),
  officialArchiveEvent("73", "2024-10-23", "Rabatt fuer die Muenchner Medientage 2024", "Medientage Muenchen", "Muenchen", { accessType: "members_only", eventType: "Mitgliederveranstaltung" }),
  officialArchiveEvent("72", "2024-09-25", "Rabatt fuer die MediaTech Hub Conference 2024", "Studio Babelsberg", "Babelsberg", { accessType: "members_only", eventType: "Mitgliederveranstaltung" }),
  officialArchiveEvent("71", "2024-06-27", "Mitgliederversammlung 2024", "Niederlassung Adesso", "Hamburg", { accessType: "members_only", eventType: "Mitgliederveranstaltung", hostId: "adesso" }),
  officialArchiveEvent("70", "2024-02-20", "PROdigitalTV Medienfruehstueck in Berlin", "HEUSSEN Rechtsanwaltsgesellschaft mbH", "Berlin", { hostId: "heussen", imageUrl: "/assets/official/events/archive-70.jpg" }),
  officialArchiveEvent("69", "2023-11-17", "PROdigitalTV Medienfruehstueck in Salzburg", "Red Bull Hangar-7", "Salzburg", { hostId: "red-bull-members-club", imageUrl: "/assets/official/events/archive-69.jpg" }),
  officialArchiveEvent("65", "2023-08-09", "Einladung zum Medienfruehstueck", "ADESSO SE", "Koeln", { hostId: "adesso" }),
  officialArchiveEvent("64", "2023-08-08", "Jahreshauptversammlung und Medienfruehstueck", "Adesso SE", "Koeln", { accessType: "members_only", eventType: "Mitgliederveranstaltung", hostId: "adesso" }),
  officialArchiveEvent("62", "2023-06-14", "Medienfruehstueck in Wien", "SKY Bar Roofgarden", "Wien", { imageUrl: "/assets/official/events/archive-62.jpg" }),
  officialArchiveEvent("61", "2023-02-21", "53. Medienfruehstueck: VoD, Virtual Production und KI", "HEUSSEN Rechtsanwaltsgesellschaft", "Berlin", { hostId: "heussen", imageUrl: "/assets/official/events/archive-61.jpg", topicIds: ["ki-medienwirtschaft"] }),
  officialArchiveEvent("57", "2022-07-28", "Online-Jahreshauptversammlung 2022", "Online", "", { accessType: "members_only", eventType: "Mitgliederveranstaltung" }),
  officialArchiveEvent("54", "2022-05-18", "52. Medienfruehstueck in Wien", "SKY Bar Roofgarden", "Wien"),
  officialArchiveEvent("55", "2022-05-18", "Lernen von den Besten in Wien", "SKY Bar Roofgarden", "Wien", { accessType: "members_only", eventType: "Mitgliederveranstaltung" }),
  officialArchiveEvent("53", "2021-10-21", "PROdigitalTV kompakt: Barrierefreiheit in den Medien", "Online-Veranstaltung", "Hamburg", { eventType: "Webinar" }),
  officialArchiveEvent("52", "2021-06-23", "Jahreshauptversammlung Online", "Online-Veranstaltung", "Hamburg", { accessType: "members_only", eventType: "Mitgliederveranstaltung" }),
  officialArchiveEvent("48", "2020-12-08", "Erstes PROdigitalTV Online-Medienfruehstueck", "Online", "Muenchen", { eventType: "Webinar", imageUrl: "/assets/official/events/archive-48.png" }),
  officialArchiveEvent("45", "2020-02-25", "51. Medienfruehstueck in Berlin", "HEUSSEN Rechtsanwaltsgesellschaft mbH", "Berlin", { hostId: "heussen", imageUrl: "/assets/official/events/archive-45.jpg" }),
  officialArchiveEvent("41", "2019-09-19", "50. Medienfruehstueck: IT meets TV", "Kanzlei HEUKING KUEHN LUEER WOJTEK", "Duesseldorf"),
  officialArchiveEvent("40", "2019-05-15", "49. Medienfruehstueck: Distributing and Monetizing Video Content", "", "Hamburg", { topicIds: ["monetarisierung"] }),
  officialArchiveEvent("37", "2019-02-03", "48. Medienfruehstueck in Berlin", "Kanzlei HEUSSEN", "Berlin", { hostId: "heussen", imageUrl: "/assets/official/events/archive-37.jpg" }),
  officialArchiveEvent("36", "2018-09-06", "47. PROdigitalTV Medienfruehstueck in Muenchen", "Media Lab Bayern", "Muenchen"),
  officialArchiveEvent("35", "2018-07-04", "Mitgliederversammlung: Vorstand im Amt bestaetigt", "Berlin Capital Club am Gendarmenmarkt", "Berlin", { accessType: "members_only", eventType: "Mitgliederveranstaltung" }),
  officialArchiveEvent("33", "2018-03-27", "45. Medienfruehstueck: Virtual Reality", "Fraunhofer Heinrich-Hertz-Institut 3IT", "Berlin", { imageUrl: "/assets/official/events/archive-33.jpg" }),
  officialArchiveEvent("29", "2017-11-30", "44. Medienfruehstueck in Wien", "ORS Atrium", "Wien", { hostId: "ors-partner" }),
  officialArchiveEvent("32", "2017-10-18", "43. Medienfruehstueck in Koeln", "eco - Verband der Internetwirtschaft e.V.", "Koeln", { imageUrl: "/assets/official/events/archive-32.jpg" }),
  officialArchiveEvent("31", "2017-07-11", "Jahreshauptversammlung 2017", "Das Haus", "Stuttgart", { accessType: "members_only", eventType: "Mitgliederveranstaltung" }),
  officialArchiveEvent("28", "2017-06-08", "42. Medienfruehstueck von PROdigitalTV", "Hubert Burda Media", "Hamburg"),
  officialArchiveEvent("27", "2017-04-10", "41. Medienfruehstueck im Unitymedia Medialoft", "Unitymedia Medialoft", "Koeln"),
  officialArchiveEvent("25", "2016-09-27", "40. Medienfruehstueck", "", "Berlin"),
  officialArchiveEvent("23", "2016-07-20", "Jahreshauptversammlung 2016", "", "Berlin", { accessType: "members_only", eventType: "Mitgliederveranstaltung" }),
  officialArchiveEvent("22", "2016-04-19", "39. Medienfruehstueck beim eco Verband", "eco Verband", "Koeln"),
  officialArchiveEvent("21", "2016-02-11", "Medienfruehstueck in Salzburg", "Sheraton Fuschlsee", "Hof bei Salzburg"),
  officialArchiveEvent("20", "2015-10-21", "Medientage Muenchen 2015", "Medientage Muenchen", "Muenchen", { eventType: "Konferenz" }),
  officialArchiveEvent("16", "2015-10-05", "37. Medienfruehstueck in Leipzig", "", "Leipzig"),
  officialArchiveEvent("13", "2015-06-08", "Jahreshauptversammlung fuer Mitglieder", "", "Koeln", { accessType: "members_only", eventType: "Mitgliederveranstaltung" }),
  officialArchiveEvent("15", "2015-04-22", "36. Medienfruehstueck: Next Generation Media", "", "Berlin"),
  officialArchiveEvent("14", "2015-02-25", "TVKomm - Der Bewegtbildkongress", "", "Karlsruhe", { eventType: "Konferenz" }),
  officialArchiveEvent("12", "2015-02-10", "35. Medienfruehstueck in Berlin", "", "Berlin"),
  officialArchiveEvent("9", "2014-12-09", "Mitglieder-Regionaltreffen Muenchen", "Augustiner Buergerheim", "Muenchen", { accessType: "members_only", eventType: "Netzwerkveranstaltung" }),
  officialArchiveEvent("10", "2014-12-03", "Mitglieder-Regionaltreffen Hamburg", "", "Hamburg", { accessType: "members_only", eventType: "Netzwerkveranstaltung" }),
  officialArchiveEvent("11", "2014-11-27", "Mitglieder-Regionaltreffen Berlin", "", "Berlin", { accessType: "members_only", eventType: "Netzwerkveranstaltung" }),
  officialArchiveEvent("7", "2014-09-23", "34. Medienfruehstueck in Wien", "", "Wien"),
  officialArchiveEvent("2", "2014-06-18", "33. Medienfruehstueck", "", "Berlin"),
  officialArchiveEvent("5", "2014-05-19", "Mitgliederversammlung", "", "Koeln", { accessType: "members_only", eventType: "Mitgliederveranstaltung" }),
  officialArchiveEvent("1", "2014-02-27", "32. Medienfruehstueck", "", "Berlin"),
  officialArchiveEvent("34", "2004-07-20", "PROdigitalTV Mitgliederversammlung", "", "Berlin", { accessType: "members_only", eventType: "Mitgliederveranstaltung" }),
  officialArchiveEvent("60", "2023-02-21", "53. Medienfruehstueck: VoD, Virtual Production und KI (Archivdatensatz)", "HEUSSEN Rechtsanwaltsgesellschaft", "Berlin", { hostId: "heussen", topicIds: ["ki-medienwirtschaft"] }),
  officialArchiveEvent("63", "", "Archivbeitrag ohne Titelangabe", "", "", { eventType: "Netzwerkveranstaltung", dateLabel: "Keine Datumsangabe im Quellarchiv" }),
  officialArchiveEvent("66", "2023-09-27", "Rabatt fuer die MediaTech Hub Conference 2023", "MediaTech Hub Conference", "Potsdam", { accessType: "members_only", eventType: "Mitgliederveranstaltung" }),
  officialArchiveEvent("67", "2023-09-27", "Rabatt fuer die MediaTech Hub Conference 2023 (Archivdatensatz)", "MediaTech Hub Conference", "Potsdam", { accessType: "members_only", eventType: "Mitgliederveranstaltung" })
];

export const topics = [
  {
    id: "smart-tv",
    title: "Smart TV",
    shortDescription: "Plattformen, Interfaces und Reichweiten im vernetzten Wohnzimmer.",
    longDescription: "Smart-TV-Plattformen verbinden lineare Staerken mit digitaler Auffindbarkeit und messbarer Nutzung.",
    articleText: "Smart TV ist laengst mehr als ein Empfangsweg fuer lineares Fernsehen. Die Benutzeroberflaeche des Fernsehgeraets entscheidet heute darueber, welche Angebote sichtbar werden, wie Marken wahrgenommen werden und welche Inhalte im Alltag der Zuschauerinnen und Zuschauer tatsaechlich genutzt werden. Fuer Medienunternehmen entsteht damit eine strategische Aufgabe: Inhalte muessen nicht nur produziert und verbreitet, sondern in Plattformumgebungen auffindbar, nutzerfreundlich und markengerecht positioniert werden.\n\nIm Mittelpunkt stehen Startbildschirme, App-Stores, Empfehlungen, Sprachsuche, Fernbedienungslogik und die Integration hybrider Dienste. Wer Reichweite im Smart-TV-Umfeld sichern will, braucht Daten ueber Nutzungssituationen, klare Produktarchitektur und verlaessliche Partnerschaften mit Plattformbetreibern, Herstellern und Technologieanbietern. Gleichzeitig bleibt die journalistische und redaktionelle Verantwortung bestehen: Auffindbarkeit darf nicht allein von kurzfristigen Vermarktungsinteressen abhaengen.\n\nFuer PROdigitalTV ist Smart TV deshalb ein Querschnittsthema zwischen Distribution, Produktentwicklung, Vermarktung und Regulierung. Die Branche muss diskutieren, wie offene Standards, faire Platzierung, Datenschutz und wirtschaftliche Tragfaehigkeit zusammenpassen. Besonders relevant ist die Frage, wie kleinere und spezialisierte Anbieter in einer von wenigen grossen Gatekeepern gepraegten Umgebung sichtbar bleiben. Smart TV bietet enorme Chancen fuer hochwertige Bewegtbildmarken, verlangt aber auch professionelle Strategie. Das Netzwerk schafft den Raum, diese Entwicklung aus technischer, redaktioneller und geschaeftlicher Perspektive zu betrachten.\n\nIn den kommenden Jahren wird sich die Smart-TV-Oberflaeche weiter zu einem zentralen Medienportal entwickeln. Wer dort erfolgreich sein will, braucht konsistente Markenfuehrung, belastbare technische Standards und Inhalte, die schnell verstanden werden. Gleichzeitig wird die Zusammenarbeit zwischen Inhalteanbietern, Plattformen und Geraeteherstellern professioneller werden muessen. Transparente Daten, faire Konditionen und redaktionell verantwortete Auffindbarkeit bilden die Grundlage dafuer, dass Smart TV nicht nur ein Vertriebskanal bleibt, sondern ein hochwertiger Zugang zu Vielfalt, Information und Unterhaltung.\n\nPraktisch bedeutet das: Anbieter sollten Smart-TV-Projekte nicht als technische Nebenaufgabe behandeln, sondern als redaktionelles und kommerzielles Kernprodukt. Entscheidend sind klare Verantwortlichkeiten, regelmaessige Auswertung und eine Roadmap, die Nutzererlebnis, Distribution und Vermarktung gemeinsam weiterentwickelt. Ergaenzend braucht es kontinuierliche Marktbeobachtung, weil neue Betriebssysteme, Fernbedienungskonzepte und Werbeformate die Nutzungserwartungen regelmaessig veraendern.",
    imageUrl: "/assets/official/topics/smart-tv.svg",
    icon: "TV",
    accentColor: "#e30613",
    status: "active",
    sortOrder: 1
  },
  {
    id: "fast-channels",
    title: "FAST Channels",
    shortDescription: "Kuratiertes Streaming und werbefinanzierte Distribution.",
    longDescription: "FAST entwickelt sich vom Experiment zum tragfaehigen Baustein digitaler Portfolios.",
    articleText: "FAST Channels verbinden die Einfachheit linearer Programmangebote mit der Flexibilitaet digitaler Streamingdistribution. Fuer Zuschauerinnen und Zuschauer entsteht ein kuratiertes Nutzungserlebnis ohne klassische Programmsuche: einschalten, entdecken, dranbleiben. Fuer Anbieter entsteht zugleich ein attraktiver Weg, bestehende Inhalte neu zu buendeln, Markenwelten aufzubauen und werbefinanzierte Reichweite in digitalen Umgebungen zu erschliessen.\n\nDer Erfolg von FAST haengt jedoch nicht allein von grossen Inhaltsbibliotheken ab. Entscheidend sind redaktionelle Programmierung, klare Zielgruppenprofile, technische Zuverlaessigkeit, Metadatenqualitaet und eine Vermarktung, die Inventar wertstiftend und markensicher macht. Ein Kanal muss ein Versprechen geben: Was erwartet das Publikum, warum lohnt sich Wiederkehr, und wie unterscheidet sich das Angebot von austauschbaren Playlisten? Genau an dieser Stelle wird FAST zu einer professionellen Medienaufgabe.\n\nAuch fuer Plattformen ist das Modell interessant, weil es Aufenthaltsdauer erhoeht und thematische Vielfalt sichtbar machen kann. Gleichzeitig stellen sich Fragen nach Messbarkeit, Frequenzsteuerung, Werbequalitaet und internationaler Skalierung. Fuer deutsche und europaeische Anbieter ist zudem wichtig, wie Rechte, Lokalisierung und Datenschutz sauber abgebildet werden.\n\nPROdigitalTV betrachtet FAST Channels als Wachstumsfeld fuer Sender, Produzenten, Plattformbetreiber und Technologiepartner. Das Thema verbindet Content-Strategie, Distribution und Monetarisierung in besonderer Weise. Im Netzwerk geht es darum, Best Practices sichtbar zu machen, realistische Geschaeftsmodelle zu diskutieren und die Rolle kuratierter Bewegtbildangebote in einer fragmentierten Streamingwelt einzuordnen.\n\nFuer die naechste Entwicklungsphase wird entscheidend sein, ob FAST-Angebote dauerhaft redaktionelle Qualitaet und wirtschaftliche Skalierung verbinden. Erfolgreiche Anbieter werden ihre Kanaele nicht als Resteverwertung verstehen, sondern als klare Produkte mit Programmidee, Markenprofil und Datenstrategie. Auch lokale und spezialisierte Inhalte koennen profitieren, wenn sie professionell verpackt und ueber passende Plattformen verbreitet werden. Damit entsteht ein Markt, in dem kuratierte Einfachheit wieder an Bedeutung gewinnt und digitale Vermarktung neue Formen findet.\n\nFuer Unternehmen im PROdigitalTV-Umfeld ist dabei besonders interessant, wie bestehende Inhalte, Live-Elemente und thematische Markenraeume kombiniert werden koennen. FAST kann ein Labor fuer neue Programmideen sein, wenn Redaktion, Technik und Vermarktung frueh gemeinsam planen.",
    imageUrl: "/assets/official/topics/fast-channels.svg",
    icon: "FS",
    accentColor: "#0f2f5c",
    status: "active",
    sortOrder: 2
  },
  {
    id: "ki-medienwirtschaft",
    title: "KI in der Medienwirtschaft",
    shortDescription: "Produktive Workflows, Governance und Verantwortung.",
    longDescription: "Das Netzwerk schafft Orientierung fuer den verantwortungsvollen KI-Einsatz.",
    articleText: "Kuenstliche Intelligenz veraendert die Medienwirtschaft auf mehreren Ebenen zugleich. Sie unterstuetzt Recherche, Transkription, Untertitelung, Schnitt, Personalisierung, Archivsuche, Vermarktung und Kundenkommunikation. Damit entstehen neue Produktivitaetspotenziale, aber auch neue Anforderungen an Kontrolle, Transparenz und Verantwortung. Entscheidend ist nicht die Frage, ob KI eingesetzt wird, sondern wie professionell Organisationen ihren Einsatz gestalten.\n\nMedienunternehmen muessen klaeren, welche Aufgaben automatisiert werden duerfen, wo redaktionelle Abnahme zwingend bleibt und wie Quellen, Rechte und Trainingsdaten bewertet werden. KI kann Prozesse beschleunigen, Fehler reduzieren und Inhalte besser auffindbar machen. Sie kann aber auch falsche Informationen erzeugen, Urheberrechte beruehren oder Vertrauen beschaedigen, wenn sie ohne klare Regeln verwendet wird. Governance wird damit zu einem Wettbewerbsfaktor.\n\nBesonders relevant sind nachvollziehbare Workflows: Wer hat einen Inhalt erstellt, welche Systeme wurden genutzt, wo fand menschliche Pruefung statt, und welche Daten sind in den Prozess eingeflossen? Fuer B2B-Plattformen, Sender, Produzenten und Dienstleister geht es darum, Effizienzgewinne mit Qualitaet und Glaubwuerdigkeit zu verbinden.\n\nPROdigitalTV versteht KI als strategisches Branchenthema. Im Mittelpunkt stehen praktische Anwendungen, rechtliche Orientierung, ethische Standards und die Frage, wie Unternehmen ihre Mitarbeitenden befähigen. Der Austausch zwischen Technologieanbietern, Medienhaeusern, Juristen und Vermarktern ist entscheidend, damit KI nicht als kurzfristiger Hype behandelt wird, sondern als verantwortungsvoll integrierter Bestandteil moderner Medienproduktion und -distribution.\n\nBesonders fuer mittelstaendische Medienunternehmen ist Orientierung wichtig. Sie muessen entscheiden, welche Werkzeuge eingefuehrt werden, wie Mitarbeitende geschult werden und welche Risiken akzeptabel sind. Gleichzeitig duerfen Chancen nicht durch Unsicherheit blockiert werden. KI kann Routinearbeiten reduzieren, Archive erschliessen, Barrierefreiheit verbessern und neue Formen der Auswertung ermoeglichen. Der Mehrwert entsteht jedoch erst, wenn Technologie in klare Prozesse eingebettet wird. Deshalb gehoeren Strategie, Recht, Redaktion und Technik an denselben Tisch.\n\nIn der Praxis sollten Unternehmen kleine, kontrollierte Anwendungsfaelle definieren und deren Nutzen messbar machen. So entsteht Erfahrung, ohne operative Risiken zu ueberdehnen. Wichtig bleibt, dass KI-Kompetenz nicht nur in der Technik liegt, sondern in der gesamten Organisation waechst.",
    imageUrl: "/assets/official/topics/ki-medienwirtschaft.svg",
    icon: "KI",
    accentColor: "#e30613",
    status: "active",
    sortOrder: 3
  },
  {
    id: "monetarisierung",
    title: "Monetarisierung",
    shortDescription: "Werthaltige Vermarktung digitaler Bewegtbildangebote.",
    longDescription: "Neue Inventare und Datenstrategien fuer nachhaltiges Wachstum.",
    articleText: "Die Monetarisierung digitaler Medienangebote ist komplexer geworden. Klassische Werbevermarktung, Abonnements, Transaktionsmodelle, Sponsoring, Datenkooperationen und hybride Plattformmodelle stehen nebeneinander. Fuer Anbieter reicht es nicht mehr, Reichweite zu erzeugen; sie muessen diese Reichweite qualifizieren, messen und in verlaessliche Erlosmodelle uebersetzen. Gerade im Bewegtbildbereich entscheidet die Kombination aus hochwertigem Umfeld, technischer Auslieferung und sauberer Datenlogik ueber wirtschaftlichen Erfolg.\n\nWerthaltige Monetarisierung beginnt bei der Produktstrategie. Welche Zielgruppe wird erreicht? Welche Nutzungssituation entsteht? Welche Werbeformen sind akzeptabel? Wie werden Inventare gebuendelt, ohne die Nutzererfahrung zu verschlechtern? Gleichzeitig muessen Vermarkter Transparenz schaffen: Werbetreibende erwarten Nachweise zu Sichtbarkeit, Zielgruppen, Brand Safety und Wirkung. Medienanbieter erwarten faire Beteiligung an der Wertschoepfung.\n\nNeue Chancen entstehen durch Addressable TV, FAST Channels, Connected TV, kontextuelle Daten, dynamische Werbeeinspielung und direkte Kundenbeziehungen. Doch jede zusaetzliche Erlosquelle bringt technische und organisatorische Anforderungen mit sich. Rechte, Datenschutz, Consent, Messmethoden und Reporting muessen sauber zusammenspielen.\n\nPROdigitalTV behandelt Monetarisierung als zentrales Managementthema. Es geht nicht um kurzfristige Auslastung, sondern um nachhaltige Geschaeftsmodelle fuer hochwertige digitale Medienangebote. Der Branchendialog hilft, Erfahrungen zu vergleichen, Standards zu verstehen und Partnerschaften zu entwickeln, die fuer Anbieter, Plattformen, Vermarkter und Werbekunden tragfaehig sind.\n\nEin professioneller Monetarisierungsansatz betrachtet Erlosquellen nicht isoliert. Werbung, Abonnements, Sponsoring, Datenprodukte und Partnerschaften muessen zu Marke, Zielgruppe und Nutzungskontext passen. Gerade kleinere Anbieter sollten pruefen, wo Kooperationen sinnvoll sind und wo eigene Kundenzugaenge aufgebaut werden koennen. Gleichzeitig braucht der Markt Vertrauen in Messung und Abrechnung. Nur wenn Leistungswerte nachvollziehbar sind, koennen Budgets langfristig in hochwertige digitale Medienangebote fliessen. Monetarisierung bleibt damit eine Frage von Strategie, Technologie und Glaubwuerdigkeit.\n\nFuer Entscheider heisst das, Erlosmodelle regelmaessig gegen Marktentwicklung, Nutzungsdaten und technische Moeglichkeiten zu pruefen. Wer frueh experimentiert, aber sauber misst, kann neue Einnahmen erschliessen, ohne die eigene Marke oder die Beziehung zum Publikum zu ueberfordern. Ebenso wichtig ist ein gemeinsames Verstaendnis zwischen Redaktion, Vermarktung und Management, damit neue Erloswege die publizistische Qualitaet nicht schwaechen.",
    imageUrl: "/assets/official/topics/monetarisierung.svg",
    icon: "€",
    accentColor: "#0f2f5c",
    status: "active",
    sortOrder: 4
  },
  {
    id: "content-management",
    title: "Content Management",
    shortDescription: "Inhalte effizient orchestrieren und ausspielen.",
    longDescription: "Systeme und Prozesse fuer skalierbare Mediaprodukte.",
    articleText: "Content Management ist in der digitalen Medienwirtschaft weit mehr als die Pflege einzelner Webseiten. Inhalte muessen geplant, produziert, versioniert, beschrieben, freigegeben, verteilt und ausgewertet werden. Je mehr Kanaele, Plattformen und Ausspielwege hinzukommen, desto wichtiger wird eine robuste Content-Architektur. Ohne saubere Prozesse verlieren Organisationen Geschwindigkeit, Qualitaet und Uebersicht.\n\nEin modernes Content-Management-System muss redaktionelle Arbeit, technische Metadaten und betriebliche Anforderungen zusammenbringen. Dazu gehoeren Rollen und Rechte, Medienverwaltung, strukturierte Inhalte, Barrierefreiheit, Mehrsprachigkeit, Suchmaschinenoptimierung, Schnittstellen und Archivlogik. Besonders im Bewegtbildumfeld spielen Transcodierung, Untertitel, Rechtefenster, Vorschaubilder, Kapitelmarken und Distribution an externe Plattformen eine zentrale Rolle.\n\nDie eigentliche Herausforderung liegt haeufig nicht in der Software, sondern in der Organisation. Wer entscheidet, wann ein Inhalt veroeffentlicht wird? Welche Daten sind Pflicht? Wie werden alte Inhalte aktualisiert? Welche Inhalte duerfen intern bleiben, welche sind oeffentlich, welche exklusiv fuer Mitglieder oder Partner? Gute Systeme machen diese Regeln sichtbar und einfach bedienbar.\n\nPROdigitalTV betrachtet Content Management als Infrastruktur fuer professionelle Medienangebote. Effiziente Workflows schaffen Freiraum fuer redaktionelle Qualitaet und strategische Entwicklung. Im Netzwerk koennen Unternehmen Erfahrungen austauschen, technische Anforderungen schaerfen und zeigen, wie skalierbare Systeme die Zusammenarbeit zwischen Redaktion, Marketing, Vertrieb, Technik und Management verbessern.\n\nWichtig ist dabei eine klare Trennung zwischen Inhalt, Design und Ausspielung. Strukturierte Inhalte lassen sich leichter wiederverwenden, personalisieren und archivieren. Das erhoeht die Lebensdauer redaktioneller Arbeit und reduziert Doppelpflege. Gute Content-Management-Prozesse verbessern ausserdem Compliance, weil Freigaben, Rechte und Aenderungen nachvollziehbar bleiben. Fuer Organisationen, die Veranstaltungen, Mitglieder, Medien und redaktionelle Inhalte parallel betreuen, wird Content Management damit zum Rueckgrat der digitalen Kommunikation. Es entscheidet, wie professionell eine Plattform nach innen und aussen arbeitet.\n\nGerade fuer eine Branchenplattform zeigt sich der Wert solcher Strukturen im Alltag. Events, Referenten, Sponsoren, Mitglieder, Bilder und Nachberichte koennen nur dann konsistent erscheinen, wenn Inhalte einmal sauber erfasst und danach flexibel ausgespielt werden. Besonders wertvoll wird dies, wenn Inhalte spaeter fuer Archiv, Newsletter, Eventkommunikation und Mitgliederbereich erneut genutzt werden.",
    imageUrl: "/assets/official/topics/content-management.svg",
    icon: "CM",
    accentColor: "#0f2f5c",
    status: "active",
    sortOrder: 5
  },
  {
    id: "ott",
    title: "OTT",
    shortDescription: "Streaming-Angebote und direkte Kundenbeziehungen.",
    longDescription: "OTT als Kern moderner Medienstrategien.",
    articleText: "OTT-Angebote ermoeglichen Medienunternehmen, Inhalte direkt ueber das offene Internet zum Publikum zu bringen. Damit veraendert sich die Beziehung zwischen Anbieter und Nutzer grundlegend. Sender, Produzenten und Plattformen koennen eigene Markenraeume schaffen, Daten besser verstehen und Angebote unabhaengiger von klassischen Distributionswegen entwickeln. Gleichzeitig steigen die Anforderungen an Produktqualitaet, Technik und Marketing.\n\nEin erfolgreiches OTT-Angebot braucht mehr als einen Videoplayer. Entscheidend sind eine klare Positionierung, verlaessliche Streamingqualitaet, einfache Registrierung, gute Suche, personalisierte Empfehlungen, Abrechnung, Kundenservice und konsistente Gestaltung auf Smartphone, Tablet, Smart TV und Desktop. Auch Rechteverwaltung, Jugendschutz, Datenschutz und Barrierefreiheit muessen professionell geloest sein.\n\nDie wirtschaftlichen Modelle sind vielfaeltig: werbefinanziert, abonnementbasiert, transaktional oder hybrid. Jedes Modell verlangt andere Kennzahlen. Bei Abonnements stehen Bindung und Zahlungsbereitschaft im Fokus, bei werbefinanzierten Angeboten Reichweite, Inventarqualitaet und Nutzungsdauer. Fuer viele Anbieter wird die Kombination verschiedener Modelle entscheidend.\n\nPROdigitalTV sieht OTT als strategisches Feld, in dem Technologie, Content, Marke und Vermarktung eng zusammenarbeiten muessen. Besonders wichtig ist der Austausch darueber, welche Angebote eigenstaendig tragfaehig sind, wann Partnerschaften sinnvoller sind und wie europaeische Anbieter gegen internationale Plattformen bestehen koennen. OTT ist kein einzelnes Produkt, sondern ein langfristiger Transformationsprozess fuer die gesamte Medienorganisation.\n\nDer Aufbau eines OTT-Angebots verlangt Geduld und klare Prioritaeten. Viele Projekte scheitern nicht an der Idee, sondern an zu ungenauer Zielsetzung, zu komplexer Technik oder fehlender Vermarktung. Erfolgreiche Anbieter denken Produkt, Redaktion, Daten und Kundenbeziehung gemeinsam. Sie testen Nutzungspfade, verbessern kontinuierlich die Oberflaeche und messen, welche Inhalte Bindung erzeugen. Gleichzeitig muessen Kosten fuer Betrieb, Entwicklung und Lizenzen realistisch geplant werden. OTT wird damit zu einem Feld, in dem Medienkompetenz und digitale Produktkompetenz untrennbar zusammengehoeren.\n\nFuer die Branche bleibt deshalb wichtig, OTT nicht nur als App-Projekt zu verstehen. Es geht um Kundenzugang, Datenverantwortung, Markenbindung und langfristige Produktpflege. Wer diese Ebenen zusammendenkt, schafft digitale Angebote mit Substanz. Diese Verbindung macht OTT zu einem dauerhaften Lernfeld fuer alle, die direkte digitale Medienbeziehungen aufbauen wollen.",
    imageUrl: "/assets/official/topics/ott.svg",
    icon: "OT",
    accentColor: "#e30613",
    status: "active",
    sortOrder: 6
  },
  {
    id: "plattformstrategien",
    title: "Plattformstrategien",
    shortDescription: "Reichweite in fragmentierten Maerkten sichern.",
    longDescription: "Strategische Partnerschaften fuer Distribution.",
    articleText: "Plattformstrategien entscheiden heute massgeblich darueber, ob Medienangebote sichtbar, nutzbar und wirtschaftlich erfolgreich sind. Inhalte konkurrieren nicht nur mit aehnlichen Angeboten, sondern mit der gesamten Aufmerksamkeitslogik grosser Plattformen. Smart-TV-Oberflaechen, App-Stores, Streamingdienste, soziale Netzwerke, Suchsysteme und Aggregatoren bestimmen, wie Menschen Inhalte entdecken und bewerten.\n\nFuer Medienunternehmen stellt sich deshalb die Frage, welche Rolle eigene Plattformen, Partnerplattformen und offene Distributionswege spielen sollen. Eine starke eigene Marke ist wichtig, reicht aber selten allein. Gleichzeitig kann zu grosse Abhaengigkeit von externen Plattformen Risiken erzeugen: veraenderte Algorithmen, neue Gebuehrenmodelle, eingeschraenkter Datenzugang oder schwierige Auffindbarkeit.\n\nEine tragfaehige Plattformstrategie verbindet Reichweite, Kontrolle und Wirtschaftlichkeit. Sie definiert, welche Inhalte exklusiv bleiben, welche breit verteilt werden, welche Daten benoetigt werden und welche Partnerschaften strategisch sinnvoll sind. Auch technische Standards, Metadatenqualitaet, Rechteverwaltung und Markenfuehrung muessen zusammen gedacht werden.\n\nPROdigitalTV bietet fuer diese Fragen einen professionellen B2B-Rahmen. Im Netzwerk treffen Anbieter, Plattformbetreiber, Technologiepartner, Juristen und Vermarkter aufeinander. Der Austausch hilft, Interessen auszugleichen, Marktveraenderungen frueh zu erkennen und gemeinsame Standards zu diskutieren. Plattformstrategien sind damit nicht nur Vertriebsfragen, sondern Kernfragen der digitalen Medienwirtschaft.\n\nEine gute Strategie beantwortet auch, welche Abhaengigkeiten akzeptiert werden. Nicht jede Plattformpartnerschaft ist gleich wertvoll, und nicht jede Reichweite ist wirtschaftlich sinnvoll. Medienunternehmen brauchen Kriterien, mit denen sie Sichtbarkeit, Datenzugang, Erlospotenzial und Markenwirkung bewerten. Gleichzeitig sollten sie eigene Kanaele so entwickeln, dass sie nicht nur als Pflichtauftritt existieren, sondern echte Nutzerbeziehungen schaffen. Plattformstrategien bleiben dynamisch: Neue Geraete, neue Benutzeroberflaechen und neue Regulierung koennen etablierte Modelle schnell veraendern. Kontinuierlicher Austausch hilft, rechtzeitig zu reagieren.\n\nFuer PROdigitalTV ist dieser Austausch wertvoll, weil Plattformentscheidungen selten rein technisch sind. Sie betreffen Investitionen, Rechte, Verhandlungsmacht und Markenpositionierung. Gute Strategien machen diese Zusammenhaenge transparent und helfen, Prioritaeten belastbar zu setzen. Gerade deshalb sollten Plattformentscheidungen regelmaessig im Fuehrungskreis diskutiert werden. Sie beeinflussen Investitionen, Partnerschaften, Datenzugang und die langfristige Unabhaengigkeit der Marke.",
    imageUrl: "/assets/official/topics/plattformstrategien.svg",
    icon: "PS",
    accentColor: "#0f2f5c",
    status: "active",
    sortOrder: 7
  },
  {
    id: "addressable-tv",
    title: "Addressable TV",
    shortDescription: "Zielgenaue Kommunikation im TV-Umfeld.",
    longDescription: "Daten und Kreation in hochwertigen Videoumfeldern.",
    articleText: "Addressable TV verbindet die Reichweite und Markenqualitaet des Fernsehens mit der Zielgenauigkeit digitaler Werbung. Werbung kann in geeigneten technischen Umgebungen dynamischer, regionaler oder zielgruppenspezifischer ausgespielt werden, ohne den Charakter hochwertiger TV-Umfelder aufzugeben. Fuer Werbekunden entsteht dadurch die Moeglichkeit, Kampagnen praeziser zu planen und Streuverluste zu reduzieren.\n\nFuer Sender und Vermarkter bietet Addressable TV neue Erlospotenziale. Gleichzeitig steigen die Anforderungen an Technologie, Datenqualitaet, Consent, Messung und Kreation. Spots, Overlays oder interaktive Formate muessen zur Nutzungssituation passen und duerfen das Vertrauen in das Programmumfeld nicht beschaedigen. Die Balance zwischen Relevanz und Zurueckhaltung ist entscheidend.\n\nBesonders wichtig ist die Frage, welche Daten genutzt werden duerfen und wie transparent dies gegenueber Nutzerinnen und Nutzern geschieht. Datenschutz und Akzeptanz sind keine Nebenthemen, sondern Voraussetzungen fuer nachhaltige Geschaeftsmodelle. Auch technische Fragmentierung bleibt eine Herausforderung: Geraete, Plattformen, HbbTV-Versionen und Vermarktungssysteme muessen zusammenspielen.\n\nPROdigitalTV betrachtet Addressable TV als Schnittstelle zwischen klassischer TV-Staerke und digitaler Weiterentwicklung. Das Thema verbindet Sender, Plattformen, Agenturen, Technologieanbieter und Regulierung. Im Branchendialog geht es darum, Standards zu verstehen, Erfolgsmodelle zu vergleichen und hochwertige Werbung in digitalen TV-Umgebungen so zu gestalten, dass sie fuer Nutzer, Anbieter und Werbekunden Mehrwert schafft.\n\nDie weitere Entwicklung wird stark davon abhaengen, wie einfach Addressable-TV-Kampagnen buchbar, messbar und vergleichbar werden. Werbekunden erwarten digitale Steuerbarkeit, aber auch die Verlaesslichkeit klassischer TV-Umfelder. Anbieter muessen daher technische Komplexitaet reduzieren und gleichzeitig Qualitaet sichern. Kreative Formate sollten nicht nur Daten nutzen, sondern echten Kontext verstehen. Wenn Relevanz, Datenschutz und Nutzererlebnis zusammenspielen, kann Addressable TV ein wichtiger Baustein fuer die Zukunft der Bewegtbildvermarktung werden.\n\nFuer Medienanbieter entsteht daraus eine klare Aufgabe: Sie muessen Technologie, Daten und Kreation so verbinden, dass Werbung wirksamer wird, ohne das Programmumfeld zu entwerten. Professionelle Standards und gemeinsames Lernen sind dafuer entscheidend. Fuer die Branche bleibt wichtig, Nutzervertrauen nicht als gegeben anzusehen. Transparenz und Qualitaet entscheiden, ob adressierbare Werbung akzeptiert wird.",
    imageUrl: "/assets/official/topics/addressable-tv.svg",
    icon: "AT",
    accentColor: "#e30613",
    status: "active",
    sortOrder: 8
  }
];

function newsArticleFromTopic(topic, index = 0) {
  const publishDates = ["2026-06-05", "2026-06-04", "2026-06-03", "2026-06-02", "2026-06-01", "2026-05-31"];
  const publishDate = publishDates[index] || "2026-05-30";
  return {
    id: `news-topic-${topic.id}`,
    key: `news.topic.${topic.id}`,
    page: "news",
    section: "news",
    title: `${topic.title}: Was die Medienwirtschaft jetzt beschaeftigt`,
    subtitle: topic.longDescription || topic.shortDescription || "",
    introText: topic.shortDescription || topic.longDescription || "",
    bodyText: topic.articleText || topic.longDescription || topic.shortDescription || "",
    category: topic.title,
    publishDate,
    validFrom: publishDate,
    validTo: "",
    visibility: "public",
    visible: true,
    status: "published",
    imageUrl: topic.imageUrl || "",
    topicId: topic.id,
    sortOrder: 1500 - index
  };
}

const topicalNewsArticles = topics
  .filter((topic) => !["fast-channels", "ki-medienwirtschaft"].includes(topic.id))
  .map(newsArticleFromTopic);

export const speakers = [];

export const sponsors = [
  { id: "heussen", name: "HEUSSEN Rechtsanwaltsgesellschaft mbH", role: "Gastgeber", description: "", city: "Berlin", status: "published" },
  { id: "ernst-leitz-museum", name: "Ernst-Leitz Museum", role: "Gastgeber", description: "", city: "Wetzlar", status: "published" },
  { id: "red-bull-members-club", name: "Red Bull Members Club Hangar 7", role: "Gastgeber", description: "", city: "Salzburg", status: "published" },
  { id: "adesso", name: "Adesso Niederlassung Hamburg", role: "Partner", description: "", city: "Hamburg", status: "published" },
  { id: "medientage-muenchen", name: "Medientage Muenchen", role: "Partner", description: "", city: "Muenchen", status: "published" },
  { id: "ors-partner", name: "ORS", role: "Partner", description: "", city: "Wien", status: "published" }
];

export const members = [
  { id: "3q", name: "3Q GmbH", logoUrl: "/assets/official/members/3q.png", description: "Europaeische Plattform fuer sicheres Video-Hosting sowie skalierbares Live- und On-Demand-Streaming.", city: "Muenchen", country: "Deutschland", website: "https://3q.video/de", category: "Streaming und Video-Hosting", status: "active", visibility: "public", featured: true, sortOrder: 0 },
  { id: "about360", name: "about360", description: "Foerdert Co-Creation und Talente in digitalen und Live-Raeumen.", city: "Berlin", country: "Deutschland", website: "https://www.about360.de", status: "active", visibility: "public", featured: true, sortOrder: 1 },
  { id: "adf-international", name: "ADF International", logoUrl: "/assets/official/members/adf-international.jpg", description: "Internationale Organisation mit Fokus auf Grundfreiheiten und Rechtsvertretung.", city: "Wien", country: "Oesterreich", website: "https://adfinternational.org", status: "active", visibility: "public", featured: false, sortOrder: 2 },
  { id: "adviqo", name: "adviqo GmbH", logoUrl: "/assets/official/members/adviqo.png", description: "Betreiber von AstroTV mit Live-Programm zu Spiritualitaet und Lifestyle.", city: "Berlin", country: "Deutschland", website: "https://www.astrotv.de", status: "active", visibility: "public", featured: true, sortOrder: 3 },
  { id: "anixe-hd", name: "Anixe HD", logoUrl: "/assets/official/members/anixe-hd.png", description: "Frei empfangbarer TV-Sender mit werbefinanzierten Programmangeboten.", city: "Muenchen", country: "Deutschland", website: "https://www.anixehd.tv", status: "active", visibility: "public", featured: true, sortOrder: 4 },
  { id: "apfel-tv-kontor", name: "Apfel TV Kontor", logoUrl: "/assets/official/members/apfel-tv-kontor.png", description: "Beratung und Vernetzung fuer Marketing- und Vertriebsstrategien im TV-Markt.", city: "Neustadt/Weinstrasse", country: "Deutschland", website: "https://www.apfeltvkontor.de", status: "active", visibility: "public", featured: false, sortOrder: 5 },
  { id: "bibel-tv", name: "Bibel TV", logoUrl: "/assets/official/members/bibel-tv.jpg", description: "Christlicher Fernsehsender und digitales Medienangebot.", city: "Hamburg", country: "Deutschland", website: "https://www.bibeltv.de", status: "active", visibility: "public", featured: true, sortOrder: 6 },
  { id: "blu-tec-one", name: "BLU TEC ONE GmbH", logoUrl: "/assets/official/members/blu-tec-one.png", description: "Mitgliedsunternehmen der digitalen Medienwirtschaft aus Tangstedt.", city: "Tangstedt", country: "Deutschland", website: "https://www.blume-tv.de", status: "active", visibility: "public", featured: false, sortOrder: 7 },
  { id: "moderne-werbung", name: "BUERO FUER MODERNE WERBUNG.TV", logoUrl: "/assets/official/members/moderne-werbung.png", description: "Hamburger Medien- und Werbeunternehmen mit TV-Bezug.", city: "Hamburg", country: "Deutschland", website: "https://www.moderne-werbung.tv", status: "active", visibility: "public", featured: false, sortOrder: 8 },
  { id: "channel-21", name: "Channel 21", logoUrl: "/assets/official/members/channel-21.jpg", description: "Teleshopping-Sender mit einem breiten Sortiment von Mode bis Haushalt.", city: "Hannover", country: "Deutschland", website: "https://www.channel21.de", status: "active", visibility: "public", featured: true, sortOrder: 9 },
  { id: "deutsches-musik-fernsehen", name: "Deutsches Musik Fernsehen", logoUrl: "/assets/official/members/deutsches-musik-fernsehen.png", description: "Fernsehsender fuer deutschsprachige Musik und Unterhaltung.", city: "Berlin", country: "Deutschland", website: "https://www.deutsches-musik-fernsehen.de", status: "active", visibility: "public", featured: false, sortOrder: 10 },
  { id: "dsc", name: "DSC Dietmar Schickel Consulting GmbH", logoUrl: "/assets/official/members/dsc.jpg", description: "Beratung fuer Strategie- und Ausbauvorhaben in Telekommunikation und Medien.", city: "Berlin", country: "Deutschland", website: "https://www.schickel.de", status: "active", visibility: "public", featured: false, sortOrder: 11 },
  { id: "erf", name: "ERF - Der Sinnsender", logoUrl: "/assets/official/members/erf.png", description: "Medienunternehmen mit christlichen Inhalten ueber Radio, TV und digitale Kanaele.", city: "Wetzlar", country: "Deutschland", website: "https://www.erf.de", status: "active", visibility: "public", featured: true, sortOrder: 12 },
  { id: "eutelsat", name: "Eutelsat", logoUrl: "/assets/official/members/eutelsat.png", description: "Internationaler Satellitenbetreiber fuer Medien- und Kommunikationsdienste.", city: "Koeln", country: "Deutschland", status: "active", visibility: "public", featured: true, sortOrder: 13 },
  { id: "farbi-flora", name: "Farbi-Flora", logoUrl: "/assets/official/members/farbi-flora.png", description: "Produzent von Fernsehsendungen sowie Bild-, Ton- und Fachmedien.", city: "Gosen-Neu Zittau", country: "Deutschland", website: "https://www.farbi-flora.eu", status: "active", visibility: "public", featured: false, sortOrder: 14 },
  { id: "fashion-tv-production", name: "Fashion TV Production", logoUrl: "/assets/official/members/fashion-tv-production.jpg", description: "Produktionspartner fuer bewegte Kommunikation und Medienformate.", city: "Hamburg", country: "Deutschland", website: "https://www.fashion-tv-production.de", status: "active", visibility: "public", featured: true, sortOrder: 15 },
  { id: "flame-media", name: "Flame Media", logoUrl: "/assets/official/members/flame-media.png", description: "Entwickelt und realisiert Dokumentationen, Magazine und Reportagen.", city: "Muenchen", country: "Deutschland", status: "active", visibility: "public", featured: false, sortOrder: 16 },
  { id: "goldbach-germany", name: "Goldbach Germany", logoUrl: "/assets/official/members/goldbach-germany.jpg", description: "Technologieorientierte Vermarkterin fuer videobasierte Plattformen.", city: "Unterfoehring", country: "Deutschland", website: "https://www.goldbachgermany.de", status: "active", visibility: "public", featured: true, sortOrder: 17 },
  { id: "hardy-heine", name: "Hardy Heine - Consulting & More", logoUrl: "/assets/official/members/hardy-heine.png", description: "Beratung mit Erfahrung in IT, Telekommunikation und Medien.", city: "Bad Nenndorf", country: "Deutschland", website: "https://www.hardy-heine.com", status: "active", visibility: "public", featured: false, sortOrder: 18 },
  { id: "health-tv", name: "Health TV", logoUrl: "/assets/official/members/health-tv.png", description: "Privater Fernsehsender mit klarem Programmschwerpunkt Gesundheit.", city: "Koenigstein im Taunus", country: "Deutschland", website: "https://www.healthtv.de", status: "active", visibility: "public", featured: true, sortOrder: 19 },
  { id: "house-of-research", name: "House of Research", logoUrl: "/assets/official/members/house-of-research.png", description: "Institut fuer Kommunikations- und Medienforschung mit Studien- und Beratungskompetenz.", city: "Berlin", country: "Deutschland", website: "https://www.house-of-research.de", status: "active", visibility: "public", featured: false, sortOrder: 20 },
  { id: "idee-medien", name: "Idee Medien", logoUrl: "/assets/official/members/idee-medien.jpg", description: "Partner fuer Reichweitenmarketing und Lizenzfragen von Radio- und TV-Anbietern.", city: "Delmenhorst", country: "Deutschland", website: "https://www.ideemedien.de", status: "active", visibility: "public", featured: false, sortOrder: 21 },
  { id: "itsmaxsuhr", name: "itsmaxsuhr", logoUrl: "/assets/official/members/itsmaxsuhr.png", description: "Unterstuetzt Unternehmen bei Digitalisierung und digitalen Kundenerlebnissen.", city: "Hamburg", country: "Deutschland", website: "https://itsmaxsuhr.com", status: "active", visibility: "public", featured: false, sortOrder: 22 },
  { id: "js-consult", name: "JS Consult", logoUrl: "/assets/official/members/js-consult.jpg", description: "TV-Branchenberatung mit Fokus auf Reichweite, Smart TV und HbbTV.", city: "Pulheim", country: "Deutschland", website: "https://www.jsconsult.net", status: "active", visibility: "public", featured: false, sortOrder: 23 },
  { id: "labcom", name: "LABcom", logoUrl: "/assets/official/members/labcom.jpg", description: "Mitgliedsunternehmen der digitalen Medienwirtschaft aus Klein-Winternheim.", city: "Klein-Winternheim", country: "Deutschland", status: "active", visibility: "public", featured: false, sortOrder: 24 },
  { id: "men", name: "M.E.N Media Entertainment Networks GmbH", logoUrl: "/assets/official/members/men.png", description: "Dienstleister fuer Playout, Storage, Live- und Eventstreaming sowie CMS-Hosting.", city: "Berlin", country: "Deutschland", website: "https://www.men-gmbh.de", status: "active", visibility: "public", featured: true, sortOrder: 25 },
  { id: "mbs", name: "mbs medienberatung sterzenbach", logoUrl: "/assets/official/members/mbs.jpg", description: "Medienberatung fuer Orientierung und Entwicklung im dynamischen Markt.", city: "Potsdam", country: "Deutschland", website: "https://www.medienberatung-sterzenbach.de", status: "active", visibility: "public", featured: false, sortOrder: 26 },
  { id: "no-limits-media", name: "NO-LIMITS-MEDIA", logoUrl: "/assets/official/members/no-limits-media.png", description: "Spezialist fuer Untertitel, Audiodeskription, Barrierefreiheit und Live-Transkription.", city: "Berlin", country: "Deutschland", website: "https://www.no-limits-media.de", status: "active", visibility: "public", featured: false, sortOrder: 27 },
  { id: "ors", name: "ORS", logoUrl: "/assets/official/members/ors.jpg", description: "Oesterreichisches Medien- und Rundfunkinfrastruktur-Unternehmen.", city: "Wien", country: "Oesterreich", website: "https://www.ors.at", status: "active", visibility: "public", featured: true, sortOrder: 28 },
  { id: "red-bull-media-house", name: "Red Bull Media House", logoUrl: "/assets/official/members/red-bull-media-house.jpg", description: "Internationales Multi-Plattform-Medienunternehmen fuer hochwertige Geschichten und Formate.", city: "Salzburg", country: "Oesterreich", website: "https://www.redbull.com", status: "active", visibility: "public", featured: true, sortOrder: 29 },
  { id: "sattechnik", name: "SATTECHNIK", logoUrl: "/assets/official/members/sattechnik.jpg", description: "Anbieter professioneller Programmlisten und technischer TV-Dienstleistungen.", city: "Suedliches Anhalt", country: "Deutschland", website: "https://www.programmlisten-update.de", status: "active", visibility: "public", featured: false, sortOrder: 30 },
  { id: "schneider-enterprise", name: "Schneider-Enterprise", description: "Mitgliedsunternehmen der digitalen Medienwirtschaft aus Koblenz.", city: "Koblenz", country: "Deutschland", website: "https://schneider-enterprise.de", status: "active", visibility: "public", featured: false, sortOrder: 31 },
  { id: "stingray-music", name: "STINGRAY MUSIC", logoUrl: "/assets/official/members/stingray-music.jpg", description: "Multimediale Musikplattform mit Kanaelen fuer Web, App und TV.", city: "London", country: "U.K.", website: "https://www.stingray.com", status: "active", visibility: "public", featured: true, sortOrder: 32 },
  { id: "tvn-group", name: "TVN GROUP HOLDING", logoUrl: "/assets/official/members/tvn-group.png", description: "Produziert Film-, TV- und Streamingprojekte von der Konzeption bis zur Ausstrahlung.", city: "Hannover", country: "Deutschland", website: "https://www.tvn.de", status: "active", visibility: "public", featured: true, sortOrder: 33 },
  { id: "xroadmedia", name: "xroadmedia", logoUrl: "/assets/official/members/xroadmedia.jpg", description: "Anbieter fuer Content Discovery, Empfehlungen und zielgerichtete Medienangebote.", city: "Wien", country: "Oesterreich", website: "https://www.xroadmedia.com", status: "active", visibility: "public", featured: true, sortOrder: 34 },
  { id: "zattoo", name: "Zattoo", logoUrl: "/assets/official/members/zattoo.jpg", description: "TV-Streaming-Plattform fuer internetbasiertes Fernsehen.", city: "Zuerich", country: "Schweiz", website: "https://www.zattoo.com", status: "active", visibility: "public", featured: true, sortOrder: 35 }
];

export const boardMembers = [
  { id: "board-beate-busch", name: "Beate Busch", photoUrl: "/assets/official/board/beate-busch.jpg", role: "Vorstand, 1. Vorsitzende", company: "Bibel TV", shortBio: "Executive Vice President, stellvertretende Geschaeftsfuehrung und Prokuristin.", email: "busch@prodigitaltv.de", website: "https://www.bibeltv.de", status: "active", visibility: "public", sortOrder: 1 },
  { id: "board-manuela-brodersen-horn", name: "Manuela Brodersen-Horn", photoUrl: "/assets/official/board/manuela-brodersen-horn.jpg", role: "Vorstand, stellv. Vorsitzende", company: "Fashion TV Production", shortBio: "Geschaeftsfuehrerin.", email: "brodersen-horn@prodigitaltv.de", website: "https://www.fashion-tv-production.de", status: "active", visibility: "public", sortOrder: 2 },
  { id: "board-klaus-juli", name: "Klaus Juli", photoUrl: "/assets/official/board/klaus-juli.jpg", role: "Vorstand", company: "M.E.N. Media Entertainment Networks GmbH", shortBio: "Geschaeftsfuehrender Gesellschafter.", email: "kj@men-gmbh.de", website: "https://www.men-gmbh.de", status: "active", visibility: "public", sortOrder: 3 },
  { id: "board-dirk-martens", name: "Dirk Martens", photoUrl: "/assets/official/board/dirk-martens.jpg", role: "Vorstand", company: "House of Research", shortBio: "Geschaeftsfuehrer.", email: "martens@prodigitaltv.de", website: "https://www.house-of-research.de", status: "active", visibility: "public", sortOrder: 4 },
  { id: "board-gerhard-fischer", name: "Gerhard Fischer", photoUrl: "/assets/official/board/gerhard-fischer.jpg", role: "Vorstand", company: "Major Seven Consulting", shortBio: "Geschaeftsfuehrender Gesellschafter.", email: "fischer@prodigitaltv.de", website: "https://www.majorsevenconsulting.com", status: "active", visibility: "public", sortOrder: 5 },
  { id: "board-michael-schmittmann", name: "RA Michael Schmittmann", photoUrl: "/assets/official/board/michael-schmittmann.jpg", role: "Justiziar des Vereins / Vorstandes", company: "HEUKING KUEHN LUER WOJTEK", shortBio: "Begleitet den Verein und seinen Vorstand in rechtlichen Angelegenheiten.", website: "https://www.heuking.de", status: "active", visibility: "public", sortOrder: 6 }
];

export const registrations = [];
export const membershipApplications = [];
export const downloads = [
  { id: "download-satzung", title: "Vereinssatzung", description: "Satzung von PROdigitalTV e.V.", fileName: "Vereinssatzung.pdf", fileUrl: "", assetUrl: "", documentUrl: "", visibility: "public", status: "published", category: "Verein", sortOrder: 1 },
  { id: "download-membership-fees", title: "Mitgliederbeitraege", description: "Uebersicht der Mitgliederbeitraege.", fileName: "Mitgliederbeitraege.pdf", fileUrl: "", assetUrl: "", documentUrl: "", visibility: "public", status: "published", category: "Mitgliedschaft", sortOrder: 2 }
];

export const eventMedia = [
  {
    id: "event-media-salzburg-hangar7-2026-cover",
    eventId: "event-salzburg-red-bull-hangar7-2026",
    fileName: "event-salzburg-red-bull-hangar7-2026.svg",
    fileUrl: salzburgHangarImageUrl,
    storagePath: "assets/official/events/event-salzburg-red-bull-hangar7-2026.svg",
    mediaType: "image",
    title: "Red Bull Hangar-7 Salzburg",
    description: "Eventbild fuer das PROdigitalTV Medienfruehstueck im Hangar-7 Salzburg.",
    altText: "Eventbild Red Bull Hangar-7 Salzburg",
    photographer: "",
    copyright: "",
    visibility: "public",
    status: "approved",
    sortOrder: 1,
    isCoverImage: true,
    uploadedBy: "firebase-storage",
    uploadedAt: "2026-05-26T10:00:00",
    updatedAt: "2026-05-26T10:00:00"
  }
];

export const galleries = [
  {
    id: "gallery-salzburg-hangar7-2026",
    title: "Medienfruehstueck im Hangar-7 Salzburg",
    description: "Bildergalerie zum PROdigitalTV Medienfruehstueck im Red Bull Hangar-7.",
    status: "published",
    visibility: "public",
    eventId: "event-salzburg-red-bull-hangar7-2026",
    images: [
      {
        id: "gallery-salzburg-hangar7-2026-1",
        url: salzburgHangarImageUrl,
        fileName: "event-salzburg-red-bull-hangar7-2026.svg",
        storagePath: "assets/official/events/event-salzburg-red-bull-hangar7-2026.svg",
        caption: "Red Bull Hangar-7 Salzburg",
        altText: "Eventbild Red Bull Hangar-7 Salzburg",
        sortOrder: 1
      }
    ],
    createdAt: "2026-05-26T10:00:00",
    updatedAt: "2026-05-26T10:00:00"
  },
  {
    id: "gallery-prodigtaltv-branchendialog",
    title: "PROdigitalTV Branchendialog",
    description: "Allgemeine Bildergalerie fuer redaktionelle Rueckblicke und Veranstaltungsbeitraege.",
    status: "draft",
    visibility: "internal",
    images: [],
    createdAt: "2026-05-26T10:00:00",
    updatedAt: "2026-05-26T10:00:00"
  }
];

function pressArticleFromEvent(event, index = 0) {
  const dateLabel = event.displayDate || (event.date ? event.date.split("-").reverse().join(".") : "");
  const location = [event.locationName, event.city].filter(Boolean).join(", ");
  const introText = event.postEventSummary || event.description || event.subtitle || "";
  const bodyText = [
    event.postEventSummary || event.description || `${event.title} ist als Rueckblick im PROdigitalTV-Archiv erfasst.`,
    location || dateLabel
      ? `Der Beitrag dokumentiert das PROdigitalTV-Format${dateLabel ? ` vom ${dateLabel}` : ""}${location ? ` in ${location}` : ""} und macht den Branchendialog redaktionell auffindbar.`
      : "Der Beitrag macht den Branchendialog redaktionell auffindbar.",
    "Im Fokus stehen Austausch, Vernetzung und die kontinuierliche Begleitung zentraler Themen der digitalen Medienwirtschaft."
  ].filter(Boolean).join("\n\n");
  return {
    id: `press-retrospective-${event.id}`,
    key: `press.retrospective.${event.id}`,
    page: "press",
    section: "pressRelease",
    title: `Rueckblick: ${event.title}`,
    subtitle: event.subtitle || `${event.eventType || "PROdigitalTV-Veranstaltung"} im Rueckblick`,
    introText,
    bodyText,
    category: "Rueckblicke",
    publishDate: event.date || "",
    validFrom: event.date || "",
    validTo: "",
    visibility: "public",
    visible: true,
    status: "published",
    imageUrl: event.imageUrl || "",
    linkedEventId: event.id,
    isRetrospective: true,
    sortOrder: 2000 - index
  };
}

const pressRetrospectiveArticles = [...events, ...additionalArchiveEvents]
  .filter((event) => event.date || event.postEventSummary || event.description)
  .filter((event) => event.id !== "event-salzburg-red-bull-hangar7-2026")
  .map(pressArticleFromEvent);

export const editorialContent = [
  ...internalEditorialSeed,
  { id: "home-hero", key: "home.hero", page: "home", section: "hero", title: "Die Zukunft digitaler Medien gemeinsam gestalten.", subtitle: "PROdigitalTV verbindet Entscheider, Impulsgeber und Unternehmen der digitalen Medienwirtschaft.", teaserText: "Das Branchennetzwerk der digitalen Medienwirtschaft.", buttonText: "Naechstes Event", buttonUrl: "#/events", validFrom: "", validTo: "", visibility: "public", status: "published", sortOrder: 1 },
  { id: "press-hangar7-salzburg-2026", key: "press.hangar7.2026", page: "press", section: "pressRelease", title: "PROdigitalTV Medienfruehstueck im Hangar-7", subtitle: "Branchendialog in Salzburg mit Gaesten aus Medien, Technik und Vermarktung.", introText: "PROdigitalTV laedt zum Medienfruehstueck im Red Bull Hangar-7 nach Salzburg ein.", bodyText: "Das Medienfruehstueck bringt Entscheiderinnen und Entscheider aus TV, Streaming, Produktion, Technologie und Vermarktung zusammen. Im Mittelpunkt stehen aktuelle Fragen der digitalen Medienwirtschaft: Wie entwickeln sich Plattformen, welche Rolle spielen neue Distributionsmodelle, und wie koennen Anbieter ihre Inhalte sichtbar und wirtschaftlich tragfaehig positionieren?\n\nDer Austausch im Netzwerk soll Orientierung geben und konkrete Erfahrungen aus der Branche sichtbar machen. PROdigitalTV versteht das Format als kompakten Rahmen fuer Wissenstransfer, persoenliche Begegnung und neue Kooperationen.", category: "Presse", publishDate: "2026-05-20", validFrom: "2026-05-20", validTo: "", visibility: "public", visible: true, status: "published", sortOrder: 10 },
  ...pressRetrospectiveArticles,
  { id: "news-ki-medienwirtschaft", key: "news.ki.medienwirtschaft", page: "news", section: "news", title: "KI bleibt ein zentrales Thema der Medienwirtschaft", subtitle: "Redaktion, Produktion und Distribution brauchen klare Regeln fuer KI-Werkzeuge.", introText: "Kuenstliche Intelligenz veraendert Arbeitsablaeufe in Redaktion, Produktion und Auswertung.", bodyText: "KI-Werkzeuge koennen Medienunternehmen bei Recherche, Transkription, Untertitelung, Archivsuche und Content-Planung unterstuetzen. Gleichzeitig steigen die Anforderungen an Kontrolle, Transparenz und Verantwortung.\n\nFuer die Branche ist entscheidend, dass automatisierte Prozesse nicht zu ungeprueften Aussagen, unklaren Quellen oder rechtlichen Risiken fuehren. PROdigitalTV betrachtet KI deshalb als strategisches Thema, das Technik, Redaktion, Recht und Management gemeinsam betrifft.", category: "KI", publishDate: "2026-05-22", validFrom: "2026-05-22", validTo: "", visibility: "public", visible: true, status: "published", sortOrder: 11 },
  { id: "news-fast-channels-distribution", key: "news.fast.distribution", page: "news", section: "news", title: "FAST-Channels gewinnen als Distributionsmodell an Bedeutung", subtitle: "Lineare Streaming-Angebote schaffen neue Optionen fuer Reichweite und Vermarktung.", introText: "FAST-Channels verbinden kuratierte Programme mit digitaler Ausspielung.", bodyText: "Werbefinanzierte lineare Streaming-Kanaele koennen vorhandene Inhalte neu buendeln und Zielgruppen in digitalen Umgebungen erreichen. Fuer Anbieter entstehen Chancen bei Reichweite, Markenbildung und Vermarktung.\n\nEntscheidend bleiben redaktionelle Programmierung, verlaessliche Technik, Rechteklaerung und klare Messbarkeit. Damit wird FAST nicht nur zu einem technischen, sondern auch zu einem strategischen Thema fuer Medienanbieter und Plattformen.", category: "Distribution", publishDate: "2026-05-24", validFrom: "2026-05-24", validTo: "", visibility: "public", visible: true, status: "published", sortOrder: 12 },
  ...topicalNewsArticles,
  { id: "about-intro", key: "about.intro", page: "about", section: "intro", title: "Das Branchennetzwerk der digitalen Medienwirtschaft.", introText: "PROdigitalTV vernetzt Unternehmen und Akteure der digitalen Medienwirtschaft im deutschsprachigen Raum.", bodyText: "PROdigitalTV e.V. vernetzt Unternehmen und Akteure der digitalen Medienwirtschaft im deutschsprachigen Raum und begleitet die Branche aktiv im digitalen Wandel. In einer Zeit, in der sich Mediennutzung, Technologien und Geschaeftsmodelle rasant veraendern, schaffen wir eine Plattform fuer Austausch, Kooperation und praxisnahes Lernen. Unsere Mitglieder kommen aus den Bereichen TV, Streaming, Plattformen, Produktion, Distribution, Technologie, Start-ups und Medienservices - verbunden durch das gemeinsame Ziel, die Zukunft digitaler Medien aktiv mitzugestalten.\n\nDer Verein foerdert den Dialog zwischen etablierten Marktteilnehmern und innovativen Unternehmen, unterstuetzt den Wissenstransfer zu aktuellen Entwicklungen und bietet Raum fuer neue Ideen und Partnerschaften. Durch Veranstaltungen wie Medienfruehstuecke, Fachgespraeche und Interviewformate wie \"Von den Besten lernen\" entstehen wertvolle Kontakte und Impulse zu Themen wie digitale Transformation, Content-Strategien, neue Technologien, Monetarisierung, KI, Streaming oder die Zukunft des Fernsehens.\n\nMitglieder profitieren von einem starken Netzwerk, hoher Branchenkompetenz und einer Plattform, die den persoenlichen Austausch in den Mittelpunkt stellt. Gleichzeitig unterstuetzt PROdigitalTV die Sichtbarkeit seiner Mitglieder innerhalb der Medienbranche und schafft Verbindungen zwischen Technologie, Content und Vermarktung. Fuer TV-Sender bietet der Verein darueber hinaus die Moeglichkeit, von einem Vereinsrabatt bei der GEMA zu profitieren.\n\nPROdigitalTV versteht sich als unabhaengiges Netzwerk und Impulsgeber fuer die digitale Medienwelt - offen, praxisorientiert und zukunftsgerichtet.", validFrom: "", validTo: "", visibility: "public", status: "published", sortOrder: 1 },
  { id: "join-intro", key: "join.intro", page: "join", section: "intro", title: "Mitglied werden", introText: "Werden Sie Teil eines aktiven B2B-Netzwerks mit direktem Zugang zu Expertise und Entscheiderinnen und Entscheidern.", validFrom: "", validTo: "", visibility: "public", status: "published", sortOrder: 1 },
  { id: "download-info-satzung", key: "join.downloadInfo.satzung", page: "join", section: "internal", title: "Vereinssatzung", bodyText: "Die Vereinssatzung regelt Zweck, Mitgliedschaft, Organe und grundlegende Arbeitsweise von PROdigitalTV e.V. Bitte lesen Sie die Satzung vor dem Absenden des Mitgliedsantrags.", validFrom: "", validTo: "", visibility: "public", status: "published", sortOrder: 2 },
  { id: "download-info-membership-fees", key: "join.downloadInfo.membershipFees", page: "join", section: "internal", title: "Mitgliederbeitraege", bodyText: "Die Beitragsuebersicht informiert ueber die aktuellen Mitgliedsbeitraege fuer Unternehmensmitglieder und Einzelmitglieder. Die Angaben dienen als Grundlage fuer den Mitgliedsantrag.", validFrom: "", validTo: "", visibility: "public", status: "published", sortOrder: 3 },
  { id: "join-benefit-events", key: "join.benefit.events", page: "join", section: "internal", title: "Exklusive Events", bodyText: "Mitglieder erhalten Zugang zu ausgewaehlten PROdigitalTV-Formaten, Fachgespraechen und Netzwerkveranstaltungen. Sie koennen Gaeste zu exklusiven Events einladen und Vortraege sowie Themen im Rahmen der Medienfruehstuecke aktiv mitgestalten.", validFrom: "", validTo: "", visibility: "public", status: "published", sortOrder: 4 },
  { id: "join-benefit-visibility", key: "join.benefit.visibility", page: "join", section: "internal", title: "Sichtbarkeit", bodyText: "Mitglieder koennen ihre Expertise, Projekte und Themen innerhalb des Netzwerks sichtbar machen und werden Teil einer etablierten Branchenplattform.", validFrom: "", validTo: "", visibility: "public", status: "published", sortOrder: 5 },
  { id: "join-benefit-impulses", key: "join.benefit.impulses", page: "join", section: "internal", title: "Impulse", bodyText: "Der Verein schafft Raum fuer Wissenstransfer, Austausch und praxisnahe Impulse zu Digitalisierung, Content, Plattformen, Technologie und Medienstrategie.", validFrom: "", validTo: "", visibility: "public", status: "published", sortOrder: 6 },
  { id: "footer-downloads", key: "footer.downloads", page: "join", section: "footer", title: "Downloads", bodyText: "Downloadbereich fuer Vereinssatzung und Mitgliederbeitraege.", validFrom: "", validTo: "", visibility: "public", status: "published", sortOrder: 4 },
  { id: "footer-contact", key: "footer.contact", page: "contact", section: "footer", title: "Kontakt", bodyText: "post@prodigitaltv.de\n+49 40 44506617", validFrom: "", validTo: "", visibility: "public", status: "published", sortOrder: 5 },
  { id: "footer-cookie-settings", key: "footer.cookieSettings", page: "legal", section: "footer", title: "Cookie Einstellungen", bodyText: "Cookie-Einstellungen fuer die Website.", validFrom: "", validTo: "", visibility: "public", status: "published", sortOrder: 6 },
  { id: "footer-login", key: "footer.login", page: "login", section: "footer", title: "Log-In", bodyText: "Login fuer Mitglieder und Redaktionszugriff.", validFrom: "", validTo: "", visibility: "public", status: "published", sortOrder: 7 },
  { id: "footer-copyright", key: "footer.copyright", page: "contact", section: "footer", title: "ProDigitalTV e.V. 2026", bodyText: "ProDigitalTV e.V. 2026", validFrom: "", validTo: "", visibility: "public", status: "published", sortOrder: 8 },
  { id: "legal-imprint", key: "legal.imprint", page: "imprint", section: "legal", title: "Impressum", introText: "Angaben gemaess den gesetzlichen Informationspflichten.", bodyText: "Vereins- und Geschaeftssitz:\nWandalenweg 26\n20097 Hamburg\nTelefon: +49 40 44506617\nE-Mail: post@prodigitaltv.de\nInternet: www.prodigitaltv.de\n\nEingetragen im Vereinsregister Hamburg: VR 19974\nVerantwortliche Personen: Vorstand von PROdigitalTV.", validFrom: "", validTo: "", visibility: "public", status: "published", sortOrder: 1 },
  { id: "legal-privacy", key: "legal.privacy", page: "privacy", section: "legal", title: "Datenschutz", introText: "Informationen zur Verarbeitung personenbezogener Daten.", bodyText: "Wir freuen uns sehr über Ihr Interesse an unserem Verein. Datenschutz hat einen besonders hohen Stellenwert für die Vereinsleitung der PROdigitalTV e.V.. Eine Nutzung der Internetseiten der PROdigitalTV e.V. ist grundsätzlich ohne jede Angabe personenbezogener Daten möglich. Sofern eine betroffene Person besondere Services unseres Vereins über unsere Internetseite in Anspruch nehmen möchte, könnte jedoch eine Verarbeitung personenbezogener Daten erforderlich werden. Ist die Verarbeitung personenbezogener Daten erforderlich und besteht für eine solche Verarbeitung keine gesetzliche Grundlage, holen wir generell eine Einwilligung der betroffenen Person ein.\n\nDie Verarbeitung personenbezogener Daten, beispielsweise des Namens, der Anschrift, E-Mail-Adresse oder Telefonnummer einer betroffenen Person, erfolgt stets im Einklang mit der Datenschutz-Grundverordnung und in Übereinstimmung mit den für die PROdigitalTV e.V. geltenden landesspezifischen Datenschutzbestimmungen. Mittels dieser Datenschutzerklärung möchte unser Verein die Öffentlichkeit über Art, Umfang und Zweck der von uns erhobenen, genutzten und verarbeiteten personenbezogenen Daten informieren. Ferner werden betroffene Personen mittels dieser Datenschutzerklärung über die ihnen zustehenden Rechte aufgeklärt.\n\nDie PROdigitalTV e.V. hat als für die Verarbeitung Verantwortlicher zahlreiche technische und organisatorische Maßnahmen umgesetzt, um einen möglichst lückenlosen Schutz der über diese Internetseite verarbeiteten personenbezogenen Daten sicherzustellen. Dennoch können Internetbasierte Datenübertragungen grundsätzlich Sicherheitslücken aufweisen, sodass ein absoluter Schutz nicht gewährleistet werden kann. Aus diesem Grund steht es jeder betroffenen Person frei, personenbezogene Daten auch auf alternativen Wegen, beispielsweise telefonisch, an uns zu übermitteln.\n\n1. Begriffsbestimmungen\n\nDie Datenschutzerklärung der PROdigitalTV e.V. beruht auf den Begrifflichkeiten, die durch den Europäischen Richtlinien- und Verordnungsgeber beim Erlass der Datenschutz-Grundverordnung (DS-GVO) verwendet wurden. Unsere Datenschutzerklärung soll sowohl für die Öffentlichkeit als auch für unsere Kunden und Vereinspartner einfach lesbar und verständlich sein. Um dies zu gewährleisten, möchten wir vorab die verwendeten Begrifflichkeiten erläutern.\n\nWir verwenden in dieser Datenschutzerklärung unter anderem die folgenden Begriffe:\n\n-\n\na) personenbezogene Daten\n\nPersonenbezogene Daten sind alle Informationen, die sich auf eine identifizierte oder identifizierbare natürliche Person (im Folgenden „betroffene Person“) beziehen. Als identifizierbar wird eine natürliche Person angesehen, die direkt oder indirekt, insbesondere mittels Zuordnung zu einer Kennung wie einem Namen, zu einer Kennnummer, zu Standortdaten, zu einer Online-Kennung oder zu einem oder mehreren besonderen Merkmalen, die Ausdruck der physischen, physiologischen, genetischen, psychischen, wirtschaftlichen, kulturellen oder sozialen Identität dieser natürlichen Person sind, identifiziert werden kann.\n\n-\n\nb) betroffene Person\n\nBetroffene Person ist jede identifizierte oder identifizierbare natürliche Person, deren personenbezogene Daten von dem für die Verarbeitung Verantwortlichen verarbeitet werden.\n\n-\n\nc) Verarbeitung\n\nVerarbeitung ist jeder mit oder ohne Hilfe automatisierter Verfahren ausgeführte Vorgang oder jede solche Vorgangsreihe im Zusammenhang mit personenbezogenen Daten wie das Erheben, das Erfassen, die Organisation, das Ordnen, die Speicherung, die Anpassung oder Veränderung, das Auslesen, das Abfragen, die Verwendung, die Offenlegung durch Übermittlung, Verbreitung oder eine andere Form der Bereitstellung, den Abgleich oder die Verknüpfung, die Einschränkung, das Löschen oder die Vernichtung.\n\n-\n\nd) Einschränkung der Verarbeitung\n\nEinschränkung der Verarbeitung ist die Markierung gespeicherter personenbezogener Daten mit dem Ziel, ihre künftige Verarbeitung einzuschränken.\n\n-\n\ne) Profiling\n\nProfiling ist jede Art der automatisierten Verarbeitung personenbezogener Daten, die darin besteht, dass diese personenbezogenen Daten verwendet werden, um bestimmte persönliche Aspekte, die sich auf eine natürliche Person beziehen, zu bewerten, insbesondere, um Aspekte bezüglich Arbeitsleistung, wirtschaftlicher Lage, Gesundheit, persönlicher Vorlieben, Interessen, Zuverlässigkeit, Verhalten, Aufenthaltsort oder Ortswechsel dieser natürlichen Person zu analysieren oder vorherzusagen.\n\n-\n\nf) Pseudonymisierung\n\nPseudonymisierung ist die Verarbeitung personenbezogener Daten in einer Weise, auf welche die personenbezogenen Daten ohne Hinzuziehung zusätzlicher Informationen nicht mehr einer spezifischen betroffenen Person zugeordnet werden können, sofern diese zusätzlichen Informationen gesondert aufbewahrt werden und technischen und organisatorischen Maßnahmen unterliegen, die gewährleisten, dass die personenbezogenen Daten nicht einer identifizierten oder identifizierbaren natürlichen Person zugewiesen werden.\n\n-\n\ng) Verantwortlicher oder für die Verarbeitung Verantwortlicher\n\nVerantwortlicher oder für die Verarbeitung Verantwortlicher ist die natürliche oder juristische Person, Behörde, Einrichtung oder andere Stelle, die allein oder gemeinsam mit anderen über die Zwecke und Mittel der Verarbeitung von personenbezogenen Daten entscheidet. Sind die Zwecke und Mittel dieser Verarbeitung durch das Unionsrecht oder das Recht der Mitgliedstaaten vorgegeben, so kann der Verantwortliche beziehungsweise können die bestimmten Kriterien seiner Benennung nach dem Unionsrecht oder dem Recht der Mitgliedstaaten vorgesehen werden.\n\n-\n\nh) Auftragsverarbeiter\n\nAuftragsverarbeiter ist eine natürliche oder juristische Person, Behörde, Einrichtung oder andere Stelle, die personenbezogene Daten im Auftrag des Verantwortlichen verarbeitet.\n\n-\n\ni) Empfänger\n\nEmpfänger ist eine natürliche oder juristische Person, Behörde, Einrichtung oder andere Stelle, der personenbezogene Daten offengelegt werden, unabhängig davon, ob es sich bei ihr um einen Dritten handelt oder nicht. Behörden, die im Rahmen eines bestimmten Untersuchungsauftrags nach dem Unionsrecht oder dem Recht der Mitgliedstaaten möglicherweise personenbezogene Daten erhalten, gelten jedoch nicht als Empfänger.\n\n-\n\nj) Dritter\n\nDritter ist eine natürliche oder juristische Person, Behörde, Einrichtung oder andere Stelle außer der betroffenen Person, dem Verantwortlichen, dem Auftragsverarbeiter und den Personen, die unter der unmittelbaren Verantwortung des Verantwortlichen oder des Auftragsverarbeiters befugt sind, die personenbezogenen Daten zu verarbeiten.\n\n-\n\nk) Einwilligung\n\nEinwilligung ist jede von der betroffenen Person freiwillig für den bestimmten Fall in informierter Weise und unmissverständlich abgegebene Willensbekundung in Form einer Erklärung oder einer sonstigen eindeutigen bestätigenden Handlung, mit der die betroffene Person zu verstehen gibt, dass sie mit der Verarbeitung der sie betreffenden personenbezogenen Daten einverstanden ist.\n\n2. Name und Anschrift des für die Verarbeitung Verantwortlichen\n\nVerantwortlicher im Sinne der Datenschutz-Grundverordnung, sonstiger in den Mitgliedstaaten der Europäischen Union geltenden Datenschutzgesetze und anderer Bestimmungen mit datenschutzrechtlichem Charakter ist die:\n\nPROdigitalTV e.V.\n\nWandalenweg 26\n\n20097 Hamburg\n\nDeutschland\n\nTel.: 040 - 21091522\n\nE-Mail: info@prodigitaltv.de\n\nWebsite: www.prodigitaltv.de\n\n3. Cookies\n\nDie Internetseiten der PROdigitalTV e.V. verwenden Cookies. Cookies sind Textdateien, welche über einen Internetbrowser auf einem Computersystem abgelegt und gespeichert werden.\n\nZahlreiche Internetseiten und Server verwenden Cookies. Viele Cookies enthalten eine sogenannte Cookie-ID. Eine Cookie-ID ist eine eindeutige Kennung des Cookies. Sie besteht aus einer Zeichenfolge, durch welche Internetseiten und Server dem konkreten Internetbrowser zugeordnet werden können, in dem das Cookie gespeichert wurde. Dies ermöglicht es den besuchten Internetseiten und Servern, den individuellen Browser der betroffenen Person von anderen Internetbrowsern, die andere Cookies enthalten, zu unterscheiden. Ein bestimmter Internetbrowser kann über die eindeutige Cookie-ID wiedererkannt und identifiziert werden.\n\nDurch den Einsatz von Cookies kann die PROdigitalTV e.V. den Nutzern dieser Internetseite nutzerfreundlichere Services bereitstellen, die ohne die Cookie-Setzung nicht möglich wären.\n\nMittels eines Cookies können die Informationen und Angebote auf unserer Internetseite im Sinne des Benutzers optimiert werden. Cookies ermöglichen uns, wie bereits erwähnt, die Benutzer unserer Internetseite wiederzuerkennen. Zweck dieser Wiedererkennung ist es, den Nutzern die Verwendung unserer Internetseite zu erleichtern. Der Benutzer einer Internetseite, die Cookies verwendet, muss beispielsweise nicht bei jedem Besuch der Internetseite erneut seine Zugangsdaten eingeben, weil dies von der Internetseite und dem auf dem Computersystem des Benutzers abgelegten Cookie übernommen wird. Ein weiteres Beispiel ist das Cookie eines Warenkorbes im Online-Shop. Der Online-Shop merkt sich die Artikel, die ein Kunde in den virtuellen Warenkorb gelegt hat, über ein Cookie.\n\nDie betroffene Person kann die Setzung von Cookies durch unsere Internetseite jederzeit mittels einer entsprechenden Einstellung des genutzten Internetbrowsers verhindern und damit der Setzung von Cookies dauerhaft widersprechen. Ferner können bereits gesetzte Cookies jederzeit über einen Internetbrowser oder andere Softwareprogramme gelöscht werden. Dies ist in allen gängigen Internetbrowsern möglich. Deaktiviert die betroffene Person die Setzung von Cookies in dem genutzten Internetbrowser, sind unter Umständen nicht alle Funktionen unserer Internetseite vollumfänglich nutzbar.\n\n4. Erfassung von allgemeinen Daten und Informationen\n\nDie Internetseite der PROdigitalTV e.V. erfasst mit jedem Aufruf der Internetseite durch eine betroffene Person oder ein automatisiertes System eine Reihe von allgemeinen Daten und Informationen. Diese allgemeinen Daten und Informationen werden in den Logfiles des Servers gespeichert. Erfasst werden können die (1) verwendeten Browsertypen und Versionen, (2) das vom zugreifenden System verwendete Betriebssystem, (3) die Internetseite, von welcher ein zugreifendes System auf unsere Internetseite gelangt (sogenannte Referrer), (4) die Unterwebseiten, welche über ein zugreifendes System auf unserer Internetseite angesteuert werden, (5) das Datum und die Uhrzeit eines Zugriffs auf die Internetseite, (6) eine Internet-Protokoll-Adresse (IP-Adresse), (7) der Internet-Service-Provider des zugreifenden Systems und (8) sonstige ähnliche Daten und Informationen, die der Gefahrenabwehr im Falle von Angriffen auf unsere informationstechnologischen Systeme dienen.\n\nBei der Nutzung dieser allgemeinen Daten und Informationen zieht die PROdigitalTV e.V. keine Rückschlüsse auf die betroffene Person. Diese Informationen werden vielmehr benötigt, um (1) die Inhalte unserer Internetseite korrekt auszuliefern, (2) die Inhalte unserer Internetseite sowie die Werbung für diese zu optimieren, (3) die dauerhafte Funktionsfähigkeit unserer informationstechnologischen Systeme und der Technik unserer Internetseite zu gewährleisten sowie (4) um Strafverfolgungsbehörden im Falle eines Cyberangriffes die zur Strafverfolgung notwendigen Informationen bereitzustellen. Diese anonym erhobenen Daten und Informationen werden durch die PROdigitalTV e.V. daher einerseits statistisch und ferner mit dem Ziel ausgewertet, den Datenschutz und die Datensicherheit in unserem Verein zu erhöhen, um letztlich ein optimales Schutzniveau für die von uns verarbeiteten personenbezogenen Daten sicherzustellen. Die anonymen Daten der Server-Logfiles werden getrennt von allen durch eine betroffene Person angegebenen personenbezogenen Daten gespeichert.\n\n5. Registrierung auf unserer Internetseite\n\nDie betroffene Person hat die Möglichkeit, sich auf der Internetseite des für die Verarbeitung Verantwortlichen unter Angabe von personenbezogenen Daten zu registrieren. Welche personenbezogenen Daten dabei an den für die Verarbeitung Verantwortlichen übermittelt werden, ergibt sich aus der jeweiligen Eingabemaske, die für die Registrierung verwendet wird. Die von der betroffenen Person eingegebenen personenbezogenen Daten werden ausschließlich für die interne Verwendung bei dem für die Verarbeitung Verantwortlichen und für eigene Zwecke erhoben und gespeichert. Der für die Verarbeitung Verantwortliche kann die Weitergabe an einen oder mehrere Auftragsverarbeiter, beispielsweise einen Paketdienstleister, veranlassen, der die personenbezogenen Daten ebenfalls ausschließlich für eine interne Verwendung, die dem für die Verarbeitung Verantwortlichen zuzurechnen ist, nutzt.\n\nDurch eine Registrierung auf der Internetseite des für die Verarbeitung Verantwortlichen wird ferner die vom Internet-Service-Provider (ISP) der betroffenen Person vergebene IP-Adresse, das Datum sowie die Uhrzeit der Registrierung gespeichert. Die Speicherung dieser Daten erfolgt vor dem Hintergrund, dass nur so der Missbrauch unserer Dienste verhindert werden kann, und diese Daten im Bedarfsfall ermöglichen, begangene Straftaten aufzuklären. Insofern ist die Speicherung dieser Daten zur Absicherung des für die Verarbeitung Verantwortlichen erforderlich. Eine Weitergabe dieser Daten an Dritte erfolgt grundsätzlich nicht, sofern keine gesetzliche Pflicht zur Weitergabe besteht oder die Weitergabe der Strafverfolgung dient.\n\nDie Registrierung der betroffenen Person unter freiwilliger Angabe personenbezogener Daten dient dem für die Verarbeitung Verantwortlichen dazu, der betroffenen Person Inhalte oder Leistungen anzubieten, die aufgrund der Natur der Sache nur registrierten Benutzern angeboten werden können. Registrierten Personen steht die Möglichkeit frei, die bei der Registrierung angegebenen personenbezogenen Daten jederzeit abzuändern oder vollständig aus dem Datenbestand des für die Verarbeitung Verantwortlichen löschen zu lassen.\n\nDer für die Verarbeitung Verantwortliche erteilt jeder betroffenen Person jederzeit auf Anfrage Auskunft darüber, welche personenbezogenen Daten über die betroffene Person gespeichert sind. Ferner berichtigt oder löscht der für die Verarbeitung Verantwortliche personenbezogene Daten auf Wunsch oder Hinweis der betroffenen Person, soweit dem keine gesetzlichen Aufbewahrungspflichten entgegenstehen. Ein in dieser Datenschutzerklärung namentlich benannter Datenschutzbeauftragter und die Gesamtheit der Mitarbeiter des für die Verarbeitung Verantwortlichen stehen der betroffenen Person in diesem Zusammenhang als Ansprechpartner zur Verfügung.\n\n6. Kontaktmöglichkeit über die Internetseite\n\nDie Internetseite der PROdigitalTV e.V. enthält aufgrund von gesetzlichen Vorschriften Angaben, die eine schnelle elektronische Kontaktaufnahme zu unserem Verein sowie eine unmittelbare Kommunikation mit uns ermöglichen, was ebenfalls eine allgemeine Adresse der sogenannten elektronischen Post (E-Mail-Adresse) umfasst. Sofern eine betroffene Person per E-Mail oder über ein Kontaktformular den Kontakt mit dem für die Verarbeitung Verantwortlichen aufnimmt, werden die von der betroffenen Person übermittelten personenbezogenen Daten automatisch gespeichert. Solche auf freiwilliger Basis von einer betroffenen Person an den für die Verarbeitung Verantwortlichen übermittelten personenbezogenen Daten werden für Zwecke der Bearbeitung oder der Kontaktaufnahme zur betroffenen Person gespeichert. Es erfolgt keine Weitergabe dieser personenbezogenen Daten an Dritte.\n\n7. Routinemäßige Löschung und Sperrung von personenbezogenen Daten\n\nDer für die Verarbeitung Verantwortliche verarbeitet und speichert personenbezogene Daten der betroffenen Person nur für den Zeitraum, der zur Erreichung des Speicherungszwecks erforderlich ist oder sofern dies durch den Europäischen Richtlinien- und Verordnungsgeber oder einen anderen Gesetzgeber in Gesetzen oder Vorschriften, welchen der für die Verarbeitung Verantwortliche unterliegt, vorgesehen wurde.\n\nEntfällt der Speicherungszweck oder läuft eine vom Europäischen Richtlinien- und Verordnungsgeber oder einem anderen zuständigen Gesetzgeber vorgeschriebene Speicherfrist ab, werden die personenbezogenen Daten routinemäßig und entsprechend den gesetzlichen Vorschriften gesperrt oder gelöscht.\n\n8. Rechte der betroffenen Person\n\n-\n\na) Recht auf Bestätigung\n\nJede betroffene Person hat das vom Europäischen Richtlinien- und Verordnungsgeber eingeräumte Recht, von dem für die Verarbeitung Verantwortlichen eine Bestätigung darüber zu verlangen, ob sie betreffende personenbezogene Daten verarbeitet werden. Möchte eine betroffene Person dieses Bestätigungsrecht in Anspruch nehmen, kann sie sich hierzu jederzeit an unseren Datenschutzbeauftragten oder einen anderen Mitarbeiter des für die Verarbeitung Verantwortlichen wenden.\n\n-\n\nb) Recht auf Auskunft\n\nJede von der Verarbeitung personenbezogener Daten betroffene Person hat das vom Europäischen Richtlinien- und Verordnungsgeber gewährte Recht, jederzeit von dem für die Verarbeitung Verantwortlichen unentgeltliche Auskunft über die zu seiner Person gespeicherten personenbezogenen Daten und eine Kopie dieser Auskunft zu erhalten. Ferner hat der Europäische Richtlinien- und Verordnungsgeber der betroffenen Person Auskunft über folgende Informationen zugestanden:\n\n- die Verarbeitungszwecke\n\n- die Kategorien personenbezogener Daten, die verarbeitet werden\n\n- die Empfänger oder Kategorien von Empfängern, gegenüber denen die personenbezogenen Daten offengelegt worden sind oder noch offengelegt werden, insbesondere bei Empfängern in Drittländern oder bei internationalen Organisationen\n\n- falls möglich die geplante Dauer, für die die personenbezogenen Daten gespeichert werden, oder, falls dies nicht möglich ist, die Kriterien für die Festlegung dieser Dauer\n\n- das Bestehen eines Rechts auf Berichtigung oder Löschung der sie betreffenden personenbezogenen Daten oder auf Einschränkung der Verarbeitung durch den Verantwortlichen oder eines Widerspruchsrechts gegen diese Verarbeitung\n\n- das Bestehen eines Beschwerderechts bei einer Aufsichtsbehörde\n\n- wenn die personenbezogenen Daten nicht bei der betroffenen Person erhoben werden: Alle verfügbaren Informationen über die Herkunft der Daten\n\n- das Bestehen einer automatisierten Entscheidungsfindung einschließlich Profiling gemäß Artikel 22 Abs.1 und 4 DS-GVO und — zumindest in diesen Fällen — aussagekräftige Informationen über die involvierte Logik sowie die Tragweite und die angestrebten Auswirkungen einer derartigen Verarbeitung für die betroffene Person\n\nFerner steht der betroffenen Person ein Auskunftsrecht darüber zu, ob personenbezogene Daten an ein Drittland oder an eine internationale Organisation übermittelt wurden. Sofern dies der Fall ist, so steht der betroffenen Person im Übrigen das Recht zu, Auskunft über die geeigneten Garantien im Zusammenhang mit der Übermittlung zu erhalten.\n\nMöchte eine betroffene Person dieses Auskunftsrecht in Anspruch nehmen, kann sie sich hierzu jederzeit an unseren Datenschutzbeauftragten oder einen anderen Mitarbeiter des für die Verarbeitung Verantwortlichen wenden.\n\n-\n\nc) Recht auf Berichtigung\n\nJede von der Verarbeitung personenbezogener Daten betroffene Person hat das vom Europäischen Richtlinien- und Verordnungsgeber gewährte Recht, die unverzügliche Berichtigung sie betreffender unrichtiger personenbezogener Daten zu verlangen. Ferner steht der betroffenen Person das Recht zu, unter Berücksichtigung der Zwecke der Verarbeitung, die Vervollständigung unvollständiger personenbezogener Daten — auch mittels einer ergänzenden Erklärung — zu verlangen.\n\nMöchte eine betroffene Person dieses Berichtigungsrecht in Anspruch nehmen, kann sie sich hierzu jederzeit an unseren Datenschutzbeauftragten oder einen anderen Mitarbeiter des für die Verarbeitung Verantwortlichen wenden.\n\n-\n\nd) Recht auf Löschung (Recht auf Vergessen werden)\n\nJede von der Verarbeitung personenbezogener Daten betroffene Person hat das vom Europäischen Richtlinien- und Verordnungsgeber gewährte Recht, von dem Verantwortlichen zu verlangen, dass die sie betreffenden personenbezogenen Daten unverzüglich gelöscht werden, sofern einer der folgenden Gründe zutrifft und soweit die Verarbeitung nicht erforderlich ist:\n\n- Die personenbezogenen Daten wurden für solche Zwecke erhoben oder auf sonstige Weise verarbeitet, für welche sie nicht mehr notwendig sind.\n\n- Die betroffene Person widerruft ihre Einwilligung, auf die sich die Verarbeitung gemäß Art. 6 Abs. 1 Buchstabe a DS-GVO oder Art. 9 Abs. 2 Buchstabe a DS-GVO stützte, und es fehlt an einer anderweitigen Rechtsgrundlage für die Verarbeitung.\n\n- Die betroffene Person legt gemäß Art. 21 Abs. 1 DS-GVO Widerspruch gegen die Verarbeitung ein, und es liegen keine vorrangigen berechtigten Gründe für die Verarbeitung vor, oder die betroffene Person legt gemäß Art. 21 Abs. 2 DS-GVO Widerspruch gegen die Verarbeitung ein.\n\n- Die personenbezogenen Daten wurden unrechtmäßig verarbeitet.\n\n- Die Löschung der personenbezogenen Daten ist zur Erfüllung einer rechtlichen Verpflichtung nach dem Unionsrecht oder dem Recht der Mitgliedstaaten erforderlich, dem der Verantwortliche unterliegt.\n\n- Die personenbezogenen Daten wurden in Bezug auf angebotene Dienste der Informationsgesellschaft gemäß Art. 8 Abs. 1 DS-GVO erhoben.\n\nSofern einer der oben genannten Gründe zutrifft und eine betroffene Person die Löschung von personenbezogenen Daten, die bei der PROdigitalTV e.V. gespeichert sind, veranlassen möchte, kann sie sich hierzu jederzeit an unseren Datenschutzbeauftragten oder einen anderen Mitarbeiter des für die Verarbeitung Verantwortlichen wenden. Der Datenschutzbeauftragte der PROdigitalTV e.V. oder ein anderer Mitarbeiter wird veranlassen, dass dem Löschverlangen unverzüglich nachgekommen wird.\n\nWurden die personenbezogenen Daten von der PROdigitalTV e.V. öffentlich gemacht und ist unser Verein als Verantwortlicher gemäß Art. 17 Abs. 1 DS-GVO zur Löschung der personenbezogenen Daten verpflichtet, so trifft die PROdigitalTV e.V. unter Berücksichtigung der verfügbaren Technologie und der Implementierungskosten angemessene Maßnahmen, auch technischer Art, um andere für die Datenverarbeitung Verantwortliche, welche die veröffentlichten personenbezogenen Daten verarbeiten, darüber in Kenntnis zu setzen, dass die betroffene Person von diesen anderen für die Datenverarbeitung Verantwortlichen die Löschung sämtlicher Links zu diesen personenbezogenen Daten oder von Kopien oder Replikationen dieser personenbezogenen Daten verlangt hat, soweit die Verarbeitung nicht erforderlich ist. Der Datenschutzbeauftragte der PROdigitalTV e.V. oder ein anderer Mitarbeiter wird im Einzelfall das Notwendige veranlassen.\n\n-\n\ne) Recht auf Einschränkung der Verarbeitung\n\nJede von der Verarbeitung personenbezogener Daten betroffene Person hat das vom Europäischen Richtlinien- und Verordnungsgeber gewährte Recht, von dem Verantwortlichen die Einschränkung der Verarbeitung zu verlangen, wenn eine der folgenden Voraussetzungen gegeben ist:\n\n- Die Richtigkeit der personenbezogenen Daten wird von der betroffenen Person bestritten, und zwar für eine Dauer, die es dem Verantwortlichen ermöglicht, die Richtigkeit der personenbezogenen Daten zu überprüfen.\n\n- Die Verarbeitung ist unrechtmäßig, die betroffene Person lehnt die Löschung der personenbezogenen Daten ab und verlangt stattdessen die Einschränkung der Nutzung der personenbezogenen Daten.\n\n- Der Verantwortliche benötigt die personenbezogenen Daten für die Zwecke der Verarbeitung nicht länger, die betroffene Person benötigt sie jedoch zur Geltendmachung, Ausübung oder Verteidigung von Rechtsansprüchen.\n\n- Die betroffene Person hat Widerspruch gegen die Verarbeitung gem. Art. 21 Abs. 1 DS-GVO eingelegt und es steht noch nicht fest, ob die berechtigten Gründe des Verantwortlichen gegenüber denen der betroffenen Person überwiegen.\n\nSofern eine der oben genannten Voraussetzungen gegeben ist und eine betroffene Person die Einschränkung von personenbezogenen Daten, die bei der PROdigitalTV e.V. gespeichert sind, verlangen möchte, kann sie sich hierzu jederzeit an unseren Datenschutzbeauftragten oder einen anderen Mitarbeiter des für die Verarbeitung Verantwortlichen wenden. Der Datenschutzbeauftragte der PROdigitalTV e.V. oder ein anderer Mitarbeiter wird die Einschränkung der Verarbeitung veranlassen.\n\n-\n\nf) Recht auf Datenübertragbarkeit\n\nJede von der Verarbeitung personenbezogener Daten betroffene Person hat das vom Europäischen Richtlinien- und Verordnungsgeber gewährte Recht, die sie betreffenden personenbezogenen Daten, welche durch die betroffene Person einem Verantwortlichen bereitgestellt wurden, in einem strukturierten, gängigen und maschinenlesbaren Format zu erhalten. Sie hat außerdem das Recht, diese Daten einem anderen Verantwortlichen ohne Behinderung durch den Verantwortlichen, dem die personenbezogenen Daten bereitgestellt wurden, zu übermitteln, sofern die Verarbeitung auf der Einwilligung gemäß Art. 6 Abs. 1 Buchstabe a DS-GVO oder Art. 9 Abs. 2 Buchstabe a DS-GVO oder auf einem Vertrag gemäß Art. 6 Abs. 1 Buchstabe b DS-GVO beruht und die Verarbeitung mithilfe automatisierter Verfahren erfolgt, sofern die Verarbeitung nicht für die Wahrnehmung einer Aufgabe erforderlich ist, die im öffentlichen Interesse liegt oder in Ausübung öffentlicher Gewalt erfolgt, welche dem Verantwortlichen übertragen wurde.\n\nFerner hat die betroffene Person bei der Ausübung ihres Rechts auf Datenübertragbarkeit gemäß Art. 20 Abs. 1 DS-GVO das Recht, zu erwirken, dass die personenbezogenen Daten direkt von einem Verantwortlichen an einen anderen Verantwortlichen übermittelt werden, soweit dies technisch machbar ist und sofern hiervon nicht die Rechte und Freiheiten anderer Personen beeinträchtigt werden.\n\nZur Geltendmachung des Rechts auf Datenübertragbarkeit kann sich die betroffene Person jederzeit an den von der PROdigitalTV e.V. bestellten Datenschutzbeauftragten oder einen anderen Mitarbeiter wenden.\n\n-\n\ng) Recht auf Widerspruch\n\nJede von der Verarbeitung personenbezogener Daten betroffene Person hat das vom Europäischen Richtlinien- und Verordnungsgeber gewährte Recht, aus Gründen, die sich aus ihrer besonderen Situation ergeben, jederzeit gegen die Verarbeitung sie betreffender personenbezogener Daten, die aufgrund von Art. 6 Abs. 1 Buchstaben e oder f DS-GVO erfolgt, Widerspruch einzulegen. Dies gilt auch für ein auf diese Bestimmungen gestütztes Profiling.\n\nDie PROdigitalTV e.V. verarbeitet die personenbezogenen Daten im Falle des Widerspruchs nicht mehr, es sei denn, wir können zwingende schutzwürdige Gründe für die Verarbeitung nachweisen, die den Interessen, Rechten und Freiheiten der betroffenen Person überwiegen, oder die Verarbeitung dient der Geltendmachung, Ausübung oder Verteidigung von Rechtsansprüchen.\n\nVerarbeitet die PROdigitalTV e.V. personenbezogene Daten, um Direktwerbung zu betreiben, so hat die betroffene Person das Recht, jederzeit Widerspruch gegen die Verarbeitung der personenbezogenen Daten zum Zwecke derartiger Werbung einzulegen. Dies gilt auch für das Profiling, soweit es mit solcher Direktwerbung in Verbindung steht. Widerspricht die betroffene Person gegenüber der PROdigitalTV e.V. der Verarbeitung für Zwecke der Direktwerbung, so wird die PROdigitalTV e.V. die personenbezogenen Daten nicht mehr für diese Zwecke verarbeiten.\n\nZudem hat die betroffene Person das Recht, aus Gründen, die sich aus ihrer besonderen Situation ergeben, gegen die sie betreffende Verarbeitung personenbezogener Daten, die bei der PROdigitalTV e.V. zu wissenschaftlichen oder historischen Forschungszwecken oder zu statistischen Zwecken gemäß Art. 89 Abs. 1 DS-GVO erfolgen, Widerspruch einzulegen, es sei denn, eine solche Verarbeitung ist zur Erfüllung einer im öffentlichen Interesse liegenden Aufgabe erforderlich.\n\nZur Ausübung des Rechts auf Widerspruch kann sich die betroffene Person direkt an den Datenschutzbeauftragten der PROdigitalTV e.V. oder einen anderen Mitarbeiter wenden. Der betroffenen Person steht es ferner frei, im Zusammenhang mit der Nutzung von Diensten der Informationsgesellschaft, ungeachtet der Richtlinie 2002/58/EG, ihr Widerspruchsrecht mittels automatisierter Verfahren auszuüben, bei denen technische Spezifikationen verwendet werden.\n\n-\n\nh) Automatisierte Entscheidungen im Einzelfall einschließlich Profiling\n\nJede von der Verarbeitung personenbezogener Daten betroffene Person hat das vom Europäischen Richtlinien- und Verordnungsgeber gewährte Recht, nicht einer ausschließlich auf einer automatisierten Verarbeitung — einschließlich Profiling — beruhenden Entscheidung unterworfen zu werden, die ihr gegenüber rechtliche Wirkung entfaltet oder sie in ähnlicher Weise erheblich beeinträchtigt, sofern die Entscheidung (1) nicht für den Abschluss oder die Erfüllung eines Vertrags zwischen der betroffenen Person und dem Verantwortlichen erforderlich ist, oder (2) aufgrund von Rechtsvorschriften der Union oder der Mitgliedstaaten, denen der Verantwortliche unterliegt, zulässig ist und diese Rechtsvorschriften angemessene Maßnahmen zur Wahrung der Rechte und Freiheiten sowie der berechtigten Interessen der betroffenen Person enthalten oder (3) mit ausdrücklicher Einwilligung der betroffenen Person erfolgt.\n\nIst die Entscheidung (1) für den Abschluss oder die Erfüllung eines Vertrags zwischen der betroffenen Person und dem Verantwortlichen erforderlich oder (2) erfolgt sie mit ausdrücklicher Einwilligung der betroffenen Person, trifft die PROdigitalTV e.V. angemessene Maßnahmen, um die Rechte und Freiheiten sowie die berechtigten Interessen der betroffenen Person zu wahren, wozu mindestens das Recht auf Erwirkung des Eingreifens einer Person seitens des Verantwortlichen, auf Darlegung des eigenen Standpunkts und auf Anfechtung der Entscheidung gehört.\n\nMöchte die betroffene Person Rechte mit Bezug auf automatisierte Entscheidungen geltend machen, kann sie sich hierzu jederzeit an unseren Datenschutzbeauftragten oder einen anderen Mitarbeiter des für die Verarbeitung Verantwortlichen wenden.\n\n-\n\ni) Recht auf Widerruf einer datenschutzrechtlichen Einwilligung\n\nJede von der Verarbeitung personenbezogener Daten betroffene Person hat das vom Europäischen Richtlinien- und Verordnungsgeber gewährte Recht, eine Einwilligung zur Verarbeitung personenbezogener Daten jederzeit zu widerrufen.\n\nMöchte die betroffene Person ihr Recht auf Widerruf einer Einwilligung geltend machen, kann sie sich hierzu jederzeit an unseren Datenschutzbeauftragten oder einen anderen Mitarbeiter des für die Verarbeitung Verantwortlichen wenden.\n\n9. Datenschutz bei Bewerbungen und im Bewerbungsverfahren\n\nDer für die Verarbeitung Verantwortliche erhebt und verarbeitet die personenbezogenen Daten von Bewerbern zum Zwecke der Abwicklung des Bewerbungsverfahrens. Die Verarbeitung kann auch auf elektronischem Wege erfolgen. Dies ist insbesondere dann der Fall, wenn ein Bewerber entsprechende Bewerbungsunterlagen auf dem elektronischen Wege, beispielsweise per E-Mail oder über ein auf der Internetseite befindliches Webformular, an den für die Verarbeitung Verantwortlichen übermittelt. Schließt der für die Verarbeitung Verantwortliche einen Anstellungsvertrag mit einem Bewerber, werden die übermittelten Daten zum Zwecke der Abwicklung des Beschäftigungsverhältnisses unter Beachtung der gesetzlichen Vorschriften gespeichert. Wird von dem für die Verarbeitung Verantwortlichen kein Anstellungsvertrag mit dem Bewerber geschlossen, so werden die Bewerbungsunterlagen zwei Monate nach Bekanntgabe der Absageentscheidung automatisch gelöscht, sofern einer Löschung keine sonstigen berechtigten Interessen des für die Verarbeitung Verantwortlichen entgegenstehen. Sonstiges berechtigtes Interesse in diesem Sinne ist beispielsweise eine Beweispflicht in einem Verfahren nach dem Allgemeinen Gleichbehandlungsgesetz (AGG).\n\n10. Rechtsgrundlage der Verarbeitung\n\nArt. 6 I lit. a DS-GVO dient unserem Verein als Rechtsgrundlage für Verarbeitungsvorgänge, bei denen wir eine Einwilligung für einen bestimmten Verarbeitungszweck einholen. Ist die Verarbeitung personenbezogener Daten zur Erfüllung eines Vertrags, dessen Vertragspartei die betroffene Person ist, erforderlich, wie dies beispielsweise bei Verarbeitungsvorgängen der Fall ist, die für eine Lieferung von Waren oder die Erbringung einer sonstigen Leistung oder Gegenleistung notwendig sind, so beruht die Verarbeitung auf Art. 6 I lit. b DS-GVO. Gleiches gilt für solche Verarbeitungsvorgänge die zur Durchführung vorvertraglicher Maßnahmen erforderlich sind, etwa in Fällen von Anfragen zur unseren Produkten oder Leistungen. Unterliegt unser Verein einer rechtlichen Verpflichtung durch welche eine Verarbeitung von personenbezogenen Daten erforderlich wird, wie beispielsweise zur Erfüllung steuerlicher Pflichten, so basiert die Verarbeitung auf Art. 6 I lit. c DS-GVO. In seltenen Fällen könnte die Verarbeitung von personenbezogenen Daten erforderlich werden, um lebenswichtige Interessen der betroffenen Person oder einer anderen natürlichen Person zu schützen. Dies wäre beispielsweise der Fall, wenn ein Besucher in unserem Betrieb verletzt werden würde und daraufhin sein Name, sein Alter, seine Krankenkassendaten oder sonstige lebenswichtige Informationen an einen Arzt, ein Krankenhaus oder sonstige Dritte weitergegeben werden müssten. Dann würde die Verarbeitung auf Art. 6 I lit. d DS-GVO beruhen. Letztlich könnten Verarbeitungsvorgänge auf Art. 6 I lit. f DS-GVO beruhen. Auf dieser Rechtsgrundlage basieren Verarbeitungsvorgänge, die von keiner der vorgenannten Rechtsgrundlagen erfasst werden, wenn die Verarbeitung zur Wahrung eines berechtigten Interesses unseres Vereins oder eines Dritten erforderlich ist, sofern die Interessen, Grundrechte und Grundfreiheiten des Betroffenen nicht überwiegen. Solche Verarbeitungsvorgänge sind uns insbesondere deshalb gestattet, weil sie durch den Europäischen Gesetzgeber besonders erwähnt wurden. Er vertrat insoweit die Auffassung, dass ein berechtigtes Interesse anzunehmen sein könnte, wenn die betroffene Person ein Kunde des Verantwortlichen ist (Erwägungsgrund 47 Satz 2 DS-GVO).\n\n11. Berechtigte Interessen an der Verarbeitung, die von dem Verantwortlichen oder einem Dritten verfolgt werden\n\nBasiert die Verarbeitung personenbezogener Daten auf Artikel 6 I lit. f DS-GVO ist unser berechtigtes Interesse die Durchführung unserer Vereinstätigkeit zugunsten des Wohlergehens all unserer Mitarbeiter und unserer Anteilseigner.\n\n12. Dauer, für die die personenbezogenen Daten gespeichert werden\n\nDas Kriterium für die Dauer der Speicherung von personenbezogenen Daten ist die jeweilige gesetzliche Aufbewahrungsfrist. Nach Ablauf der Frist werden die entsprechenden Daten routinemäßig gelöscht, sofern sie nicht mehr zur Vertragserfüllung oder Vertragsanbahnung erforderlich sind.\n\n13. Gesetzliche oder vertragliche Vorschriften zur Bereitstellung der personenbezogenen Daten; Erforderlichkeit für den Vertragsabschluss; Verpflichtung der betroffenen Person, die personenbezogenen Daten bereitzustellen; mögliche Folgen der Nichtbereitstellung\n\nWir klären Sie darüber auf, dass die Bereitstellung personenbezogener Daten zum Teil gesetzlich vorgeschrieben ist (z.B. Steuervorschriften) oder sich auch aus vertraglichen Regelungen (z.B. Angaben zum Vertragspartner) ergeben kann. Mitunter kann es zu einem Vertragsschluss erforderlich sein, dass eine betroffene Person uns personenbezogene Daten zur Verfügung stellt, die in der Folge durch uns verarbeitet werden müssen. Die betroffene Person ist beispielsweise verpflichtet uns personenbezogene Daten bereitzustellen, wenn unser Verein mit ihr einen Vertrag abschließt. Eine Nichtbereitstellung der personenbezogenen Daten hätte zur Folge, dass der Vertrag mit dem Betroffenen nicht geschlossen werden könnte. Vor einer Bereitstellung personenbezogener Daten durch den Betroffenen muss sich der Betroffene an unseren Datenschutzbeauftragten wenden. Unser Datenschutzbeauftragter klärt den Betroffenen einzelfallbezogen darüber auf, ob die Bereitstellung der personenbezogenen Daten gesetzlich oder vertraglich vorgeschrieben oder für den Vertragsabschluss erforderlich ist, ob eine Verpflichtung besteht, die personenbezogenen Daten bereitzustellen, und welche Folgen die Nichtbereitstellung der personenbezogenen Daten hätte.\n\n14. Bestehen einer automatisierten Entscheidungsfindung\n\nAls verantwortungsbewusster Verein verzichten wir auf eine automatische Entscheidungsfindung oder ein Profiling.", validFrom: "", validTo: "", visibility: "public", status: "published", sortOrder: 2 }
];

export const mailQueue = [];

export const settings = [
  { id: "accessTypes", key: "accessTypes", group: "events", value: ["public", "members_only", "invitation_only"], description: "Zugangsarten fuer Events" },
  { id: "eventTypes", key: "eventTypes", group: "events", value: ["Fachgespraech", "Konferenz", "Medienfruehstueck", "Mitgliederveranstaltung", "Netzwerkveranstaltung", "Panel", "Roundtable", "Summit", "Webinar", "Workshop"], description: "Eventtypen fuer CMS-Auswahl" },
  { id: "lifecyclePhases", key: "lifecyclePhases", group: "events", value: Object.keys(lifecycleLabels), description: "Lebenszyklus von Events" },
  { id: "registrationStatuses", key: "registrationStatuses", group: "registrations", value: ["pending_email_confirmation", "confirmed", "waitlist", "cancelled", "attended", "no_show", "expired"], description: "Status einer Anmeldung" },
  { id: "roles", key: "roles", group: "authorization", value: ["admin", "editor", "member", "guest"], description: "Systemrollen" }
];

export const verified_sources = [
  { id: "verified-source-eu-commission", name: "Europaeische Kommission", domain: "ec.europa.eu", url: "https://commission.europa.eu", source_type: "Behoerde", source_status: "bevorzugt", category: "Plattformregulierung", trust_score: 95, language: "de/en", country: "EU", notes: "Primaerquelle fuer EU-Regulierung.", priority: 1, default_for_categories: ["Plattformregulierung", "Barrierefreiheit", "Medienrecht"], created_at: "2026-05-29T10:00:00", updated_at: "2026-05-29T10:00:00", checked_at: "2026-05-29T10:00:00", checked_by: "System" },
  { id: "verified-source-eurlex", name: "EUR-Lex", domain: "eur-lex.europa.eu", url: "https://eur-lex.europa.eu", source_type: "Rechtsquelle", source_status: "bevorzugt", category: "Medienrecht", trust_score: 98, language: "de/en", country: "EU", notes: "Rechtsakte und Gesetzesstaende der EU.", priority: 1, default_for_categories: ["Medienrecht", "Urheberrecht", "Plattformregulierung"], created_at: "2026-05-29T10:00:00", updated_at: "2026-05-29T10:00:00", checked_at: "2026-05-29T10:00:00", checked_by: "System" },
  { id: "verified-source-hbbtv", name: "HbbTV Association", domain: "hbbtv.org", url: "https://www.hbbtv.org", source_type: "Technischer Standard", source_status: "bevorzugt", category: "HbbTV", trust_score: 92, language: "en", country: "international", notes: "Primaerquelle fuer HbbTV-Standards.", priority: 2, default_for_categories: ["HbbTV", "Smart-TV", "Streaming-Technologie"], created_at: "2026-05-29T10:00:00", updated_at: "2026-05-29T10:00:00", checked_at: "2026-05-29T10:00:00", checked_by: "System" },
  { id: "verified-source-w3c", name: "W3C", domain: "w3.org", url: "https://www.w3.org", source_type: "Technischer Standard", source_status: "bevorzugt", category: "Webstandards", trust_score: 96, language: "en", country: "international", notes: "Technische Standards fuer Web und Medien.", priority: 2, default_for_categories: ["Streaming-Technologie", "Barrierefreiheit", "Untertitel"], created_at: "2026-05-29T10:00:00", updated_at: "2026-05-29T10:00:00", checked_at: "2026-05-29T10:00:00", checked_by: "System" },
  { id: "verified-source-gema", name: "GEMA", domain: "gema.de", url: "https://www.gema.de", source_type: "Verwertungsgesellschaft", source_status: "erlaubt", category: "Musikrechte", trust_score: 88, language: "de", country: "DE", notes: "Quelle fuer Musikrechte und GEMA-Informationen.", priority: 3, default_for_categories: ["Musikrechte", "GEMA", "Verwertungsrecht"], created_at: "2026-05-29T10:00:00", updated_at: "2026-05-29T10:00:00", checked_at: "2026-05-29T10:00:00", checked_by: "System" }
];

export const ai_prompts = [
  { id: "ai-prompt-editorial-final-check", name: "Endpruefung Quellen, Dubletten und Halluzinationen", prompt_type: "Endpruefung", description: "Prueft, ob ein KI-Beitrag gespeichert oder veroeffentlicht werden darf.", prompt_text: "Pruefe {{BEITRAGSTEXT}} gegen {{QUELLEN}}, {{DUBLETTENLISTE}} und {{VERIFIZIERTE_QUELLEN}}. Antworte nur als JSON mit status, blockers, warnings, publication_status und explanation.", system_instructions: "Keine Halluzinationen. Keine Veroeffentlichung ohne mindestens zwei belastbare gepruefte Quellen. Keine Veroeffentlichung bei Dubletten.", output_format: "json", model: "gpt-4.1-mini", temperature: 0.1, max_tokens: 1200, is_active: true, status: "aktiv", version: 1, created_at: "2026-05-29T10:00:00", updated_at: "2026-05-29T10:00:00", created_by: "System", updated_by: "System" },
  { id: "ai-prompt-editorial-keywords", name: "Keyword-Erstellung mit Relevanz", prompt_type: "Keywords", description: "Erzeugt Keywords mit Typ und Relevanzscore.", prompt_text: "Erzeuge Keywords fuer {{BEITRAGSTEXT}}. Speichere nur Begriffe ab Relevanz 50. Antworte als JSON-array mit keyword, keyword_type, relevance_score, is_primary und explanation.", system_instructions: "Nur aus dem Beitrag und den Quellen ableiten, keine Trendbegriffe erfinden.", output_format: "json", model: "gpt-4.1-mini", temperature: 0.2, max_tokens: 900, is_active: true, status: "aktiv", version: 1, created_at: "2026-05-29T10:00:00", updated_at: "2026-05-29T10:00:00", created_by: "System", updated_by: "System" }
];

export const ai_prompt_versions = ai_prompts.map((prompt) => ({
  id: `${prompt.id}-v1`,
  prompt_id: prompt.id,
  version: 1,
  prompt_text: prompt.prompt_text,
  system_instructions: prompt.system_instructions,
  output_format: prompt.output_format,
  model: prompt.model,
  temperature: prompt.temperature,
  max_tokens: prompt.max_tokens,
  change_note: "Initiale Systemversion.",
  status: prompt.status,
  created_at: prompt.created_at,
  created_by: prompt.created_by
}));

export const article_sources = [];
export const article_keywords = [];
export const ai_prompt_tests = [];
export const ai_editorial_logs = [
  { id: "ai-editorial-log-initial", article_id: "", task_name: "KI_Redaktion_Taeglicher_Beitrag", status: "blocked", message: "Initialer Sicherheitsstatus: Ohne aktuelle Quellenrecherche wird kein Beitrag erzeugt.", found_topics_json: [], rejected_topics_json: [], used_sources_json: [], source_check_json: { source_status: "unzureichend" }, duplicate_check_json: {}, keyword_result_json: {}, ai_check_json: { status: "nicht bestanden" }, error_json: {}, created_at: "2026-05-29T10:00:00" }
];

function mediaAssetFromRecord(record, collection, type, urlField = "imageUrl") {
  const url = record[urlField];
  if (!url) return null;
  const fileName = url.split("/").filter(Boolean).pop() || `${record.id}.jpg`;
  return {
    id: `asset-${collection}-${record.id}`,
    title: record.title || record.name || record.titel || fileName,
    alt_text: record.title || record.name || record.titel || fileName,
    description: record.description || record.shortDescription || record.shortBio || "",
    media_type: type,
    source_type: url.includes("/assets/official/") ? "official" : "upload",
    aspect_ratio: type === "board" || type === "person" ? "4x5" : type === "member" || type === "logo" ? "4x3" : "16x9",
    imageUrl: url,
    file_path_original_url: url,
    file_path_web_url: url,
    file_path_thumb_url: url,
    filename_original: fileName,
    filename_web: fileName,
    filename_thumb: fileName,
    target_collection: collection,
    target_id: record.id,
    status: "active",
    visibility: "public",
    created_at: "2026-06-08T08:00:00",
    updated_at: "2026-06-08T08:00:00"
  };
}

export const media_assets = [
  ...events.map((event) => mediaAssetFromRecord(event, "events", "event")),
  ...additionalArchiveEvents.map((event) => mediaAssetFromRecord(event, "events", "event")),
  ...topics.map((topic) => mediaAssetFromRecord(topic, "topics", "topic")),
  ...members.map((member) => mediaAssetFromRecord(member, "members", "member", "logoUrl")),
  ...boardMembers.map((member) => mediaAssetFromRecord(member, "boardMembers", "board", "photoUrl"))
].filter(Boolean);

export const media_variants = [];

export const memberDocuments = [
  {
    id: "member-doc-verfassung-projekt-2026",
    title: "Projekt neue Vereinsverfassung",
    category: "Vereinsverfassung",
    year: "2026",
    meetingDate: "2026-06-08",
    description: "Arbeitsstand und Unterlagen zur neuen Vereinsverfassung.",
    documentUrl: "",
    visibility: "members",
    status: "published",
    createdAt: "2026-06-08T10:00:00",
    updatedAt: "2026-06-08T10:00:00"
  },
  {
    id: "member-doc-jhv-protokoll-2026",
    title: "Protokoll Jahreshauptversammlung 2025",
    category: "Jahreshauptversammlung",
    year: "2025",
    meetingDate: "2026-06-08",
    description: "Ablage fuer das Protokoll der Jahreshauptversammlung zum Vorjahr.",
    documentUrl: "",
    visibility: "members",
    status: "published",
    createdAt: "2026-06-08T10:00:00",
    updatedAt: "2026-06-08T10:00:00"
  },
  {
    id: "member-doc-kassenbericht-2026",
    title: "Kassenbericht 2025",
    category: "Kassenbericht",
    year: "2025",
    description: "Interner Kassenbericht fuer das Vorjahr.",
    documentUrl: "",
    visibility: "members",
    status: "published",
    createdAt: "2026-06-08T10:00:00",
    updatedAt: "2026-06-08T10:00:00"
  }
];

export const memberDirectories = [
  {
    id: "member-directory-2026",
    title: "Mitgliederverzeichnis 2026",
    year: "2026",
    description: "Aktuelles internes Mitgliederverzeichnis.",
    documentUrl: "",
    visibility: "members",
    status: "active",
    createdAt: "2026-06-08T10:00:00",
    updatedAt: "2026-06-08T10:00:00"
  }
];

export const demoDatabase = {
  events: [...events, ...additionalArchiveEvents], topics, speakers, sponsors, members, boardMembers, registrations, membershipApplications, downloads, eventMedia, galleries,
  memberDocuments, memberDirectories,
  media_assets, media_variants,
  editorialContent, mailQueue, settings, verified_sources, article_sources, article_keywords, ai_prompts, ai_prompt_versions, ai_prompt_tests, ai_editorial_logs,
  users: [{ id: "demo-admin", email: "admin@prodigitaltv.de", displayName: "Demo Administrator", role: "admin", status: "active" }],
  system: [{ id: "setup", installed: true, version: "1.0.0-demo", demoDataInstalled: true, installedAt: "2026-05-26T08:00:00" }],
  auditLog: []
};
