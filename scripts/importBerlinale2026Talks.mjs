import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "prodigitaltv-da47b";
const eventId = "event-berlinale-2026";
const now = new Date().toISOString();

const talks = [
  {
    topicId: "berlinale-2026-gregor-blach-kreativitaet-ki",
    title: "Kreativität zwischen menschlicher Kompetenz und Künstlicher Intelligenz",
    subline: "Der Gründer und Geschäftsführer von WE DO communication zeigte, wie KI kreative Prozesse unterstützt und weshalb menschliche Erfahrung weiterhin unverzichtbar bleibt.",
    text: [
      "Gregor C. Blach beschäftigte sich mit dem Zusammenspiel von menschlicher Kreativität und Künstlicher Intelligenz. Anhand aktueller Entwicklungen zeigte er, wie KI bereits bei der Erstellung von Konzepten, Texten und Bildern eingesetzt werden kann und welche neuen Möglichkeiten sich daraus für Agenturen, Unternehmen und Medienproduktionen ergeben.",
      "Gleichzeitig machte er deutlich, dass kreative Qualität nicht allein durch technische Systeme entsteht. Erfahrung, Intuition, strategisches Denken und die Verantwortung für das Ergebnis bleiben zentrale menschliche Kompetenzen. Künstliche Intelligenz kann kreative Prozesse beschleunigen und erweitern, ersetzt jedoch nicht die Fähigkeit, Ideen einzuordnen, weiterzuentwickeln und zielgerichtet einzusetzen."
    ].join("\n\n"),
    speakers: [
      { firstName: "Gregor C.", lastName: "Blach", company: "WE DO communication", position: "Gründer und Geschäftsführer" }
    ]
  },
  {
    topicId: "berlinale-2026-michael-duderstaedt-musik-ki",
    title: "Welchen Wert hat menschengemachte Musik im KI-Zeitalter?",
    subline: "Der Direktor Politische Kommunikation der GEMA beleuchtete die Auswirkungen generativer KI auf Musikschaffende, Urheberrechte und die wirtschaftliche Verwertung von Musik.",
    text: [
      "Michael Duderstädt stellte die Frage nach dem zukünftigen Wert menschengemachter Musik in den Mittelpunkt seines Vortrags. Generative KI-Systeme sind zunehmend in der Lage, Musikstücke zu analysieren, nachzuahmen und neue Inhalte automatisiert zu erzeugen. Dadurch entstehen weitreichende Fragen für Komponistinnen, Komponisten, Textschaffende und weitere Rechteinhaber.",
      "Er ordnete die rechtlichen Auseinandersetzungen der GEMA mit Anbietern wie OpenAI und Suno ein und erläuterte, weshalb Transparenz, Lizenzierung und eine angemessene Vergütung für die Nutzung geschützter Werke erforderlich sind. Dabei wurde deutlich, dass die Musikwirtschaft neue Regeln benötigt, um Innovation zu ermöglichen und zugleich die Rechte kreativer Urheberinnen und Urheber zu schützen."
    ].join("\n\n"),
    speakers: [
      { firstName: "Michael", lastName: "Duderstädt", company: "GEMA", position: "Direktor Politische Kommunikation" }
    ]
  },
  {
    topicId: "berlinale-2026-hotze-ruemmler-generative-ki-recht",
    title: "Generative KI in Film, Fernsehen und Marketing rechtssicher einsetzen",
    subline: "Die Rechtsanwälte von HEUSSEN erläuterten regulatorische Anforderungen, vertragliche Fragen und praktische Risiken beim Einsatz generativer KI.",
    text: [
      "Marcus Hotze und Lennart Rümmler gaben einen Überblick über den damaligen Rechtsstand beim Einsatz generativer Künstlicher Intelligenz in Film, Fernsehen, Werbung und Marketing. Dabei gingen sie auf aktuelle gesetzliche Entwicklungen und die wachsenden regulatorischen Anforderungen an Unternehmen und Medienproduktionen ein.",
      "Im Mittelpunkt standen unter anderem Fragen zu Urheberrechten, Persönlichkeitsrechten, Trainingsdaten, Kennzeichnungspflichten und der vertraglichen Absicherung von KI-generierten Inhalten. Die Referenten machten deutlich, dass der Einsatz generativer KI nicht nur technische und kreative Chancen eröffnet, sondern auch neue Haftungs- und Verwertungsrisiken mit sich bringt.",
      "Für Medienunternehmen ist es daher entscheidend, klare interne Prozesse zu entwickeln, Verantwortlichkeiten festzulegen und den Einsatz von KI bereits bei der Vertragsgestaltung angemessen zu berücksichtigen."
    ].join("\n\n"),
    speakers: [
      { firstName: "Marcus", lastName: "Hotze", company: "HEUSSEN", position: "Rechtsanwalt" },
      { firstName: "Lennart", lastName: "Rümmler", company: "HEUSSEN", position: "Rechtsanwalt" }
    ]
  },
  {
    topicId: "berlinale-2026-bjoern-adamski-cloudunabhaengiges-videostreaming",
    title: "Digitale Souveränität durch cloudunabhängiges Videostreaming",
    subline: "Der CCO der 3Q GmbH zeigte, wie Medienunternehmen ihre Streaming-Infrastruktur unabhängiger, kontrollierbarer und wirtschaftlicher gestalten können.",
    text: [
      "Björn Adamski stellte cloudunabhängige Videostreaming-Infrastrukturen als Alternative zu einer vollständigen Abhängigkeit von internationalen Hyperscalern vor. Er erläuterte, wie Medienunternehmen durch flexible technische Architekturen mehr Kontrolle über ihre Inhalte, Daten und Distributionswege gewinnen können.",
      "Im Mittelpunkt standen die digitale Souveränität, transparente Kostenstrukturen und die Möglichkeit, unterschiedliche Infrastrukturpartner miteinander zu kombinieren. Durch offene und anpassbare Systeme können Unternehmen ihre Streaming-Angebote gezielter skalieren und Abhängigkeiten von einzelnen Plattform- oder Cloudanbietern reduzieren.",
      "Der Vortrag machte deutlich, dass technologische Unabhängigkeit zunehmend auch zu einer strategischen und wirtschaftlichen Frage für Medienunternehmen wird."
    ].join("\n\n"),
    speakers: [
      { firstName: "Björn", lastName: "Adamski", company: "3Q GmbH", position: "CCO" }
    ]
  },
  {
    topicId: "berlinale-2026-vogelbacher-merkl-micro-dramas",
    title: "Neue Erlöswege für Filmproduktionen durch Micro-Dramas",
    subline: "Mit Vertical Minds präsentierten die Referenten eine Plattform für kurze, vertikal produzierte Serienformate im deutschsprachigen Markt.",
    text: [
      "Markus Vogelbacher und Chriz Merkl stellten mit Vertical Minds ein neues Plattformmodell für sogenannte Micro-Dramas im DACH-Markt vor. Dabei handelt es sich um kurze, serielle Bewegtbildformate, die insbesondere für die mobile Nutzung und die Darstellung im Hochformat entwickelt werden.",
      "Die Plattform soll Produzentinnen, Produzenten und Rechteinhabern zusätzliche Möglichkeiten bieten, Inhalte zu entwickeln, bestehende Stoffe neu auszuwerten und mobile Zielgruppen zu erreichen. Durch kurze Episoden, fortlaufende Erzählstrukturen und digitale Erlösmodelle entstehen neue Formen der Produktion und Vermarktung.",
      "Der Beitrag zeigte, wie sich veränderte Nutzungsgewohnheiten auf die Entwicklung audiovisueller Inhalte auswirken und welche wirtschaftlichen Chancen daraus für unabhängige Produzenten und Rechteinhaber entstehen können."
    ].join("\n\n"),
    speakers: [
      { firstName: "Markus", lastName: "Vogelbacher", company: "Vertical Minds", position: "" },
      { firstName: "Chriz", lastName: "Merkl", company: "Vertical Minds", position: "" }
    ]
  },
  {
    topicId: "berlinale-2026-stefan-uhl-tv-pricing-modell",
    title: "Ein neues Pricing-Modell für das lineare Fernsehen",
    subline: "Der Geschäftsführer D-A-CH der Advise Media Consulting GmbH analysierte die Chancen und Risiken einer TKP-basierten Leistungsabrechnung im TV-Werbemarkt.",
    text: [
      "Stefan Uhl beschäftigte sich mit dem von der AdAlliance angekündigten neuen Pricing-Modell für lineare Fernsehwerbung. Im Mittelpunkt stand der geplante stärkere Übergang zu einer leistungsbezogenen Abrechnung auf Grundlage des Tausend-Kontakt-Preises.",
      "Er erläuterte, wie sich ein solches Modell auf Sender, Vermarkter, Mediaagenturen und werbungtreibende Unternehmen auswirken könnte. Eine stärker standardisierte und reichweitenbezogene Abrechnung kann die Vergleichbarkeit unterschiedlicher Medienangebote verbessern und neue Möglichkeiten für eine plattformübergreifende Mediaplanung schaffen.",
      "Gleichzeitig entstehen Fragen hinsichtlich der Messbarkeit, der Preisentwicklung und der Bewertung unterschiedlicher Zielgruppen und Werbeumfelder. Der Vortrag zeigte, dass das neue Modell erhebliche Veränderungen für etablierte Planungs-, Einkaufs- und Abrechnungsprozesse im TV-Werbemarkt mit sich bringen kann."
    ].join("\n\n"),
    speakers: [
      { firstName: "Stefan", lastName: "Uhl", company: "Advise Media Consulting GmbH", position: "Geschäftsführer D-A-CH" }
    ]
  }
];

const speakerName = (speaker) => [speaker.firstName, speaker.lastName].filter(Boolean).join(" ").trim();
const slug = (value = "") => String(value)
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/ä/g, "ae")
  .replace(/ö/g, "oe")
  .replace(/ü/g, "ue")
  .replace(/ß/g, "ss")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");
const unique = (items = []) => Array.from(new Set(items.filter(Boolean)));

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

async function findSpeakerId(name) {
  const snapshot = await db.collection("speakers").where("name", "==", name).limit(1).get();
  return snapshot.empty ? null : snapshot.docs[0].id;
}

const eventRef = db.collection("events").doc(eventId);
const eventSnap = await eventRef.get();
if (!eventSnap.exists) throw new Error(`Event ${eventId} wurde nicht gefunden.`);
const event = eventSnap.data();

const nextTopicIds = talks.map((talk) => talk.topicId);
const nextSpeakerIds = [];

for (const talk of talks) {
  const speakerIds = [];
  for (const speaker of talk.speakers) {
    const name = speakerName(speaker);
    const speakerId = await findSpeakerId(name) || `speakers-${slug(name)}`;
    speakerIds.push(speakerId);
    nextSpeakerIds.push(speakerId);

    const speakerRef = db.collection("speakers").doc(speakerId);
    const speakerSnap = await speakerRef.get();
    const existingSpeaker = speakerSnap.exists ? speakerSnap.data() : {};
    await speakerRef.set({
      ...existingSpeaker,
      id: speakerId,
      firstName: speaker.firstName,
      lastName: speaker.lastName,
      name,
      company: speaker.company,
      position: speaker.position,
      topicId: existingSpeaker.topicId || talk.topicId,
      topicIds: unique([...(existingSpeaker.topicIds || []), talk.topicId]),
      eventIds: unique([...(existingSpeaker.eventIds || []), eventId]),
      status: existingSpeaker.status || "published",
      visibility: existingSpeaker.visibility || "public",
      createdAt: existingSpeaker.createdAt || now,
      updatedAt: now
    }, { merge: true });
  }

  const topicRef = db.collection("topics").doc(talk.topicId);
  const topicSnap = await topicRef.get();
  const existingTopic = topicSnap.exists ? topicSnap.data() : {};
  await topicRef.set({
    ...existingTopic,
    id: talk.topicId,
    title: talk.title,
    subtitle: talk.subline,
    subline: talk.subline,
    shortDescription: talk.subline,
    longDescription: talk.text,
    description: talk.text,
    category: "Vortrag",
    page: "topics",
    section: "topics",
    eventIds: unique([...(existingTopic.eventIds || []), eventId]),
    speakerIds,
    speakerId: speakerIds[0] || existingTopic.speakerId || "",
    isTalk: true,
    status: existingTopic.status || "active",
    visibility: existingTopic.visibility || "public",
    createdAt: existingTopic.createdAt || now,
    updatedAt: now
  }, { merge: true });
}

await eventRef.set({
  ...event,
  topicIds: nextTopicIds,
  speakerIds: unique(nextSpeakerIds),
  updatedAt: now
}, { merge: true });

console.log(`Gespeichert: ${talks.length} Februar-Vortraege fuer ${eventId}.`);
console.log(`Event topicIds: ${nextTopicIds.join(", ")}`);
console.log(`Event speakerIds: ${unique(nextSpeakerIds).join(", ")}`);
