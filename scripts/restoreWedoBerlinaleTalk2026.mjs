import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "prodigitaltv-da47b";
const eventId = "event-berlinale-2026";
const now = new Date().toISOString();

const originalOrder = [
  "berlinale-2026-gregor-blach-kreativitaet-ki",
  "berlinale-2026-michael-duderstaedt-musik-ki",
  "berlinale-2026-hotze-ruemmler-generative-ki-recht",
  "berlinale-2026-bjoern-adamski-cloudunabhaengiges-videostreaming",
  "berlinale-2026-vogelbacher-merkl-micro-dramas",
  "berlinale-2026-stefan-uhl-tv-pricing-modell"
];

const talk = {
  topicId: "berlinale-2026-gregor-blach-kreativitaet-ki",
  title: "Kreativitaet zwischen menschlicher Kompetenz und Kuenstlicher Intelligenz",
  subline: "Der Gruender und Geschaeftsfuehrer von WE DO communication zeigte, wie KI kreative Prozesse unterstuetzt und weshalb menschliche Erfahrung weiterhin unverzichtbar bleibt.",
  text: [
    "Gregor C. Blach beschaeftigte sich mit dem Zusammenspiel von menschlicher Kreativitaet und Kuenstlicher Intelligenz. Anhand aktueller Entwicklungen zeigte er, wie KI bereits bei der Erstellung von Konzepten, Texten und Bildern eingesetzt werden kann und welche neuen Moeglichkeiten sich daraus fuer Agenturen, Unternehmen und Medienproduktionen ergeben.",
    "Gleichzeitig machte er deutlich, dass kreative Qualitaet nicht allein durch technische Systeme entsteht. Erfahrung, Intuition, strategisches Denken und die Verantwortung fuer das Ergebnis bleiben zentrale menschliche Kompetenzen. Kuenstliche Intelligenz kann kreative Prozesse beschleunigen und erweitern, ersetzt jedoch nicht die Faehigkeit, Ideen einzuordnen, weiterzuentwickeln und zielgerichtet einzusetzen."
  ].join("\n\n"),
  speakers: [
    { id: "speakers-gregor-c-blach", firstName: "Gregor C.", lastName: "Blach", company: "WE DO communication", position: "Gruender und Geschaeftsfuehrer" }
  ]
};

const unique = (items = []) => Array.from(new Set(items.filter(Boolean)));
const speakerName = (speaker) => [speaker.firstName, speaker.lastName].filter(Boolean).join(" ").trim();

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const eventRef = db.collection("events").doc(eventId);
const eventSnap = await eventRef.get();
if (!eventSnap.exists) throw new Error(`Event ${eventId} wurde nicht gefunden.`);
const event = eventSnap.data();

const speakerIds = [];
for (const speaker of talk.speakers) {
  const speakerId = speaker.id;
  speakerIds.push(speakerId);
  const speakerRef = db.collection("speakers").doc(speakerId);
  const speakerSnap = await speakerRef.get();
  const existingSpeaker = speakerSnap.exists ? speakerSnap.data() : {};
  await speakerRef.set({
    ...existingSpeaker,
    id: speakerId,
    firstName: existingSpeaker.firstName || speaker.firstName,
    lastName: existingSpeaker.lastName || speaker.lastName,
    name: existingSpeaker.name || speakerName(speaker),
    company: existingSpeaker.company || speaker.company,
    position: existingSpeaker.position || speaker.position,
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
  title: existingTopic.title || talk.title,
  subtitle: existingTopic.subtitle || talk.subline,
  subline: existingTopic.subline || talk.subline,
  shortDescription: existingTopic.shortDescription || talk.subline,
  longDescription: existingTopic.longDescription || talk.text,
  description: existingTopic.description || talk.text,
  category: existingTopic.category || "Vortrag",
  page: existingTopic.page || "topics",
  section: existingTopic.section || "topics",
  eventIds: unique([...(existingTopic.eventIds || []), eventId]),
  speakerIds,
  speakerId: speakerIds[0],
  isTalk: true,
  status: existingTopic.status || "active",
  visibility: existingTopic.visibility || "public",
  createdAt: existingTopic.createdAt || now,
  updatedAt: now
}, { merge: true });

const currentTopicIds = event.topicIds || [];
const withRestoredTalk = unique([...currentTopicIds, talk.topicId]);
const orderedKnown = originalOrder.filter((topicId) => withRestoredTalk.includes(topicId));
const extras = withRestoredTalk.filter((topicId) => !originalOrder.includes(topicId));
const nextTopicIds = [...orderedKnown, ...extras];
const nextSpeakerIds = unique([...(event.speakerIds || []), ...speakerIds]);

await eventRef.set({
  topicIds: nextTopicIds,
  speakerIds: nextSpeakerIds,
  updatedAt: now
}, { merge: true });

console.log(`Wiederhergestellt: ${talk.topicId}`);
console.log(`Event topicIds: ${nextTopicIds.join(", ")}`);
console.log(`SpeakerIds: ${speakerIds.join(", ")}`);
