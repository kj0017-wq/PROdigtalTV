import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "prodigitaltv-da47b";
const eventId = "event-salzburg-2025";

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const now = new Date().toISOString();

const talks = [
  {
    topicId: "salzburg-2025-jan-bertil-dahms-go-big-or-go-small",
    title: "Go big or go small?",
    subline: "Jan Bertil Dahms stellte zentrale Thesen aus dem Magine Pro White Paper vor und ordnete Skalierungsstrategien für digitale Medienangebote ein.",
    text: "Jan Bertil Dahms, SVP Strategy & Sales bei Magine Pro AB, widmete sich der Frage, ob Medienunternehmen bei digitalen Video- und Streamingangeboten eher auf große Plattformstrategien oder fokussierte Nischenmodelle setzen sollten. Unter dem Titel \"Go big or go small?\" gab er einen Einblick in strategische Überlegungen aus dem Magine Pro White Paper und zeigte, wie Anbieter Reichweite, technische Skalierung, Zielgruppenfokus und Monetarisierung gegeneinander abwägen können.",
    speaker: {
      id: "speakers-jan-bertil-dahms",
      firstName: "Jan Bertil",
      lastName: "Dahms",
      name: "Jan Bertil Dahms",
      company: "Magine Pro AB",
      position: "SVP Strategy & Sales"
    }
  },
  {
    topicId: "salzburg-2025-christian-schmeichel-dokumentarfilm-produktion",
    title: "Dokumentarfilm und Produktion im digitalen Wandel",
    subline: "Christian Schmeichel brachte die Perspektive des Dokumentarfilmers und Producers in das Medienfrühstück ein.",
    text: "Christian Schmeichel gab als Dokumentarfilmer und Producer einen praxisnahen Blick auf Produktionsprozesse, Stoffentwicklung und die Anforderungen an hochwertige dokumentarische Inhalte. Im Kontext des Medienfrühstücks stand dabei die Frage im Mittelpunkt, wie sich Produktion, Distribution und Publikumserwartungen durch digitale Plattformen, Social Media und neue Auswertungswege verändern.",
    speaker: {
      id: "speakers-christian-schmeichel",
      firstName: "Christian",
      lastName: "Schmeichel",
      name: "Christian Schmeichel",
      company: "",
      position: "Dokumentarfilmer / Producer"
    }
  },
  {
    topicId: "salzburg-2025-jeanine-harmtodt-social-media-trends",
    title: "Social Media Trends",
    subline: "Jeanine Harmtodt zeigte aktuelle Entwicklungen im Social-Media-Marketing aus Sicht des Red Bull Media House.",
    text: "Jeanine Harmtodt, Head of Digital Social & Campaigns beim Red Bull Media House, stellte aktuelle Social-Media-Trends und Kampagnenmechaniken vor. Ihr Vortrag zeigte, wie sich digitale Zielgruppenansprache, Community-Building, Kampagnenplanung und plattformgerechter Content weiterentwickeln und welche Rolle starke Marken im Social-Media-Umfeld spielen.",
    speaker: {
      id: "speakers-jeanine-harmtodt",
      firstName: "Jeanine",
      lastName: "Harmtodt",
      name: "Jeanine Harmtodt",
      company: "Red Bull Media House",
      position: "Head of Digital Social & Campaigns"
    }
  }
];

function mergeUnique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

const eventRef = db.collection("events").doc(eventId);
const eventSnap = await eventRef.get();
if (!eventSnap.exists) throw new Error(`Event ${eventId} nicht gefunden.`);
const event = { id: eventSnap.id, ...eventSnap.data() };

const topicIds = mergeUnique([...(event.topicIds || []), ...talks.map((talk) => talk.topicId)]);
const speakerIds = mergeUnique([...(event.speakerIds || []), ...talks.map((talk) => talk.speaker.id)]);

for (const [index, talk] of talks.entries()) {
  const topicRef = db.collection("topics").doc(talk.topicId);
  const topicSnap = await topicRef.get();
  const existingTopic = topicSnap.exists ? topicSnap.data() : {};
  const speakerRef = db.collection("speakers").doc(talk.speaker.id);
  const speakerSnap = await speakerRef.get();
  const existingSpeaker = speakerSnap.exists ? speakerSnap.data() : {};
  const speakerTopicIds = mergeUnique([...(existingSpeaker.topicIds || []), talk.topicId]);
  const speakerEventIds = mergeUnique([...(existingSpeaker.eventIds || []), eventId]);

  await topicRef.set({
    ...existingTopic,
    id: talk.topicId,
    title: existingTopic.title || talk.title,
    subtitle: existingTopic.subtitle || talk.subline,
    subline: existingTopic.subline || talk.subline,
    shortDescription: existingTopic.shortDescription || talk.subline,
    introText: existingTopic.introText || talk.subline,
    description: existingTopic.description || talk.text,
    longDescription: existingTopic.longDescription || talk.text,
    bodyText: existingTopic.bodyText || talk.text,
    articleText: existingTopic.articleText || talk.text,
    category: existingTopic.category || "Themenbeitrag",
    folder: existingTopic.folder || "Themen",
    page: existingTopic.page || "topics",
    section: existingTopic.section || "topics",
    eventId,
    eventIds: mergeUnique([...(existingTopic.eventIds || []), eventId]),
    speakerId: existingTopic.speakerId || talk.speaker.id,
    speakerIds: mergeUnique([...(existingTopic.speakerIds || []), talk.speaker.id]),
    isTalk: true,
    status: existingTopic.status || "active",
    visibility: existingTopic.visibility || "public",
    sortOrder: Number(existingTopic.sortOrder || index + 1),
    createdAt: existingTopic.createdAt || now,
    updatedAt: now
  }, { merge: true });

  await speakerRef.set({
    ...existingSpeaker,
    ...talk.speaker,
    topicId: existingSpeaker.topicId || talk.topicId,
    topicIds: speakerTopicIds,
    eventIds: speakerEventIds,
    status: existingSpeaker.status || "published",
    visibility: existingSpeaker.visibility || "public",
    createdAt: existingSpeaker.createdAt || now,
    updatedAt: now
  }, { merge: true });
}

await eventRef.set({
  topicIds,
  speakerIds,
  updatedAt: now
}, { merge: true });

console.log(`Salzburg 2025 Vortraege/Referenten angelegt: ${talks.length}`);
console.log(JSON.stringify({ eventId, topicIds, speakerIds }, null, 2));
