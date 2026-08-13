import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "prodigitaltv-da47b";
const eventId = "event-leica-welt-2026";
const now = new Date().toISOString();

const talks = [
  {
    speaker: { firstName: "Bert", lastName: "Sahm", company: "M-COS Group", position: "Vertreter" },
    topicId: "leica-2026-bert-sahm-ki-workflow",
    title: "Von der klassischen Produktion zum KI-gestützten Workflow",
    subline: "Der Vertreter der M-COS Group zeigte, wie Künstliche Intelligenz Produktionsprozesse verändert und neue Möglichkeiten für die Content-Erstellung eröffnet.",
    text: "Bert Sahm erläuterte, wie sich die Content-Produktion von analogen Arbeitsweisen über digitale Prozesse bis hin zu zunehmend automatisierten Produktionsabläufen entwickelt hat. Im Mittelpunkt standen KI-gestützte Werkzeuge, die einzelne Arbeitsschritte vereinfachen, beschleunigen oder vollständig neu organisieren können. Gleichzeitig wurde deutlich, dass der sinnvolle Einsatz Künstlicher Intelligenz klare Prozesse, technisches Verständnis und weiterhin die kreative und redaktionelle Verantwortung des Menschen erfordert."
  },
  {
    speaker: { firstName: "Thomas", lastName: "Schneider-Trumpp", company: "Watch Movies GmbH", position: "Gründer" },
    topicId: "leica-2026-thomas-schneider-trumpp-international-vermarktung",
    title: "Audiovisuelle Inhalte erfolgreich international vermarkten",
    subline: "Der Gründer der Watch Movies GmbH stellte Strategien vor, mit denen Produzenten globale Märkte und neue Zielgruppen erreichen können.",
    text: "Thomas Schneider-Trumpp beschäftigte sich mit den Herausforderungen und Chancen der internationalen Vermarktung audiovisueller Inhalte. Er erläuterte, welche Voraussetzungen Produktionen erfüllen müssen, um auf unterschiedlichen Märkten erfolgreich angeboten werden zu können. Neben der inhaltlichen Positionierung spielen dabei geeignete Vertriebswege, internationale Partnerschaften und ein gutes Verständnis der jeweiligen Zielgruppen eine entscheidende Rolle."
  },
  {
    speaker: { firstName: "Jan", lastName: "Isenbart", company: "ARD Media", position: "Geschaeftsleiter Forschung & Service" },
    topicId: "leica-2026-jan-isenbart-werbewirkung",
    title: "Was Werbung heute tatsächlich leisten kann",
    subline: "Der Geschäftsleiter Forschung & Service bei ARD Media präsentierte aktuelle Erkenntnisse zur Werbewirkung und zu realistischen Erwartungen an moderne Kommunikation.",
    text: "Jan Isenbart stellte aktuelle Forschungsergebnisse zur Wirkung von Werbung vor und ordnete ein, welche Ziele Werbetreibende mit ihren Kommunikationsmaßnahmen realistisch erreichen können. Dabei ging es unter anderem um Aufmerksamkeit, Markenwahrnehmung und die langfristige Wirkung unterschiedlicher Medienkontakte. Sein Vortrag machte deutlich, dass erfolgreiche Werbung nicht allein anhand kurzfristiger Reaktionen beurteilt werden sollte, sondern im Zusammenspiel verschiedener Faktoren und Kommunikationskanäle betrachtet werden muss."
  },
  {
    speaker: { firstName: "Christof", lastName: "Baron", company: "Nayoki Mediaplus GmbH & Co. KG", position: "Geschäftsführer" },
    topicId: "leica-2026-christof-baron-lokale-publisher",
    title: "Lokale Publisher im Wettbewerb mit globalen Plattformen",
    subline: "Der Geschäftsführer der Nayoki Mediaplus GmbH & Co. KG analysierte die wachsende Marktmacht internationaler Plattformen und die Perspektiven regionaler Medienanbieter.",
    text: "Christof Baron beleuchtete die zunehmende Konkurrenz durch internationale Technologie- und Medienplattformen. Er zeigte auf, welchen Herausforderungen sich lokale und nationale Publisher im Wettbewerb um Reichweite, Werbeeinnahmen und Nutzerdaten stellen müssen. Gleichzeitig diskutierte er Möglichkeiten, wie sich regionale Anbieter durch glaubwürdige Inhalte, Nähe zu ihren Zielgruppen und eine klare strategische Positionierung im Markt behaupten können."
  },
  {
    speaker: { firstName: "Dirk", lastName: "Engel", company: "", position: "Markt- und Mediaforscher" },
    topicId: "leica-2026-dirk-engel-posthumanes-marketing",
    title: "Marketing im posthumanen Zeitalter",
    subline: "Der Markt- und Mediaforscher untersuchte, wie Daten, Automatisierung und Künstliche Intelligenz zukünftige Marketingstrategien prägen werden.",
    text: "Dirk Engel widmete sich dem „Zeitalter des posthumanen Marketings“ und stellte die Frage, wie sich Marketing verändert, wenn immer mehr Entscheidungen durch Datenmodelle, Algorithmen und automatisierte Systeme vorbereitet oder getroffen werden. Er zeigte auf, welche neuen Möglichkeiten sich durch präzisere Analysen und personalisierte Kommunikation ergeben. Zugleich thematisierte er die Verantwortung der Unternehmen und die weiterhin entscheidende Bedeutung menschlicher Kreativität, Erfahrung und Urteilsfähigkeit."
  }
];

const unique = (items) => Array.from(new Set((items || []).filter(Boolean)));
const speakerName = (speaker) => [speaker.firstName, speaker.lastName].filter(Boolean).join(" ");
const slug = (value) => String(value || "")
  .toLowerCase()
  .replace(/ä/g, "ae")
  .replace(/ö/g, "oe")
  .replace(/ü/g, "ue")
  .replace(/ß/g, "ss")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

async function findSpeakerId(name) {
  const snapshot = await db.collection("speakers").where("name", "==", name).limit(1).get();
  return snapshot.empty ? null : snapshot.docs[0].id;
}

async function findTopicId(title) {
  const snapshot = await db.collection("topics").where("title", "==", title).limit(10).get();
  const match = snapshot.docs.find((doc) => (doc.data().eventIds || []).includes(eventId));
  return match?.id || null;
}

const eventRef = db.collection("events").doc(eventId);
const eventSnap = await eventRef.get();
if (!eventSnap.exists) {
  throw new Error(`Event ${eventId} wurde nicht gefunden.`);
}

const eventData = eventSnap.data();
const topicIds = [...(eventData.topicIds || [])];
const speakerIds = [...(eventData.speakerIds || [])];
const resolvedTalks = [];

for (const talk of talks) {
  const name = speakerName(talk.speaker);
  const speakerId = await findSpeakerId(name) || `speakers-${slug(name)}`;
  const topicId = await findTopicId(talk.title) || talk.topicId;
  resolvedTalks.push({ ...talk, name, speakerId, topicId });
}

const nextEventTopicIds = unique([...topicIds, ...resolvedTalks.map((talk) => talk.topicId)]);
if (nextEventTopicIds.length > 6) {
  throw new Error(`Das Event haette danach ${nextEventTopicIds.length} Vortraege. Maximal 6 sind in der CMS-Maske vorgesehen. Es wurde nichts gespeichert.`);
}

for (const talk of resolvedTalks) {
  const topicRef = db.collection("topics").doc(talk.topicId);
  const speakerRef = db.collection("speakers").doc(talk.speakerId);
  const [topicSnap, speakerSnap] = await Promise.all([topicRef.get(), speakerRef.get()]);
  const existingTopic = topicSnap.exists ? topicSnap.data() : {};
  const existingSpeaker = speakerSnap.exists ? speakerSnap.data() : {};

  const nextTopicSpeakerIds = unique([...(existingTopic.speakerIds || []), talk.speakerId]);
  const nextTopicEventIds = unique([...(existingTopic.eventIds || []), eventId]);
  const nextSpeakerTopicIds = unique([...(existingSpeaker.topicIds || []), talk.topicId]);
  const nextSpeakerEventIds = unique([...(existingSpeaker.eventIds || []), eventId]);

  await topicRef.set({
    ...existingTopic,
    id: talk.topicId,
    title: talk.title,
    subtitle: talk.subline,
    subline: talk.subline,
    shortDescription: talk.subline,
    longDescription: talk.text,
    description: talk.text,
    category: existingTopic.category || "Vortrag",
    page: existingTopic.page || "topics",
    section: existingTopic.section || "topics",
    status: existingTopic.status || "active",
    visibility: existingTopic.visibility || "public",
    eventIds: nextTopicEventIds,
    speakerIds: nextTopicSpeakerIds,
    speakerId: existingTopic.speakerId || talk.speakerId,
    createdAt: existingTopic.createdAt || now,
    updatedAt: now
  }, { merge: true });

  await speakerRef.set({
    ...existingSpeaker,
    id: talk.speakerId,
    firstName: talk.speaker.firstName,
    lastName: talk.speaker.lastName,
    name: talk.name,
    company: talk.speaker.company,
    position: talk.speaker.position,
    topicId: existingSpeaker.topicId || talk.topicId,
    topicIds: nextSpeakerTopicIds,
    eventIds: nextSpeakerEventIds,
    status: existingSpeaker.status || "published",
    visibility: existingSpeaker.visibility || "public",
    createdAt: existingSpeaker.createdAt || now,
    updatedAt: now
  }, { merge: true });

  if (!topicIds.includes(talk.topicId)) topicIds.push(talk.topicId);
  if (!speakerIds.includes(talk.speakerId)) speakerIds.push(talk.speakerId);
}

await eventRef.set({
  ...eventData,
  topicIds,
  speakerIds: unique(speakerIds),
  updatedAt: now
}, { merge: true });

console.log(`Gespeichert: ${talks.length} Vortraege/Referenten fuer ${eventId}.`);
console.log(`Event topicIds: ${topicIds.join(", ")}`);
console.log(`Event speakerIds: ${unique(speakerIds).join(", ")}`);
