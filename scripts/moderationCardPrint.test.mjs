import assert from "node:assert/strict";
import test from "node:test";
import { buildModerationCards, formatModerationCardNumber, mergeSavedModerationCards, moderationCardDimensions, normalizeModerationCardOrientation } from "../src/utils/moderationCardPrint.js";

test("unterstützt DIN-A5-Hochkant und -Querformat", () => {
  assert.deepEqual(moderationCardDimensions("portrait"), { orientation: "portrait", widthMm: 148, heightMm: 210 });
  assert.deepEqual(moderationCardDimensions("landscape"), { orientation: "landscape", widthMm: 210, heightMm: 148 });
  assert.equal(normalizeModerationCardOrientation("unbekannt"), "portrait");
  assert.equal(formatModerationCardNumber(3, 8), "Karte 3 / 8");
});

test("übernimmt Agenda, Referentenprofil und Vortrag automatisch", () => {
  const cards = buildModerationCards({
    event: { scheduleItems: [{ time: "19:15", title: "Digitale Inhalte", speakerId: "speaker-1", topicId: "topic-1" }] },
    speakers: [{ id: "speaker-1", name: "Julia Beispiel", position: "Director", company: "Utiq", shortBio: "Kurze Vita." }],
    topics: [{ id: "topic-1", title: "Digitale Inhalte", shortDescription: "Kurzer Themenabriss." }]
  });
  assert.equal(cards.length, 1);
  assert.deepEqual(cards[0], {
    id: "moderation-0-speaker-1",
    time: "19:15",
    speakerName: "Julia Beispiel",
    position: "Director",
    company: "Utiq",
    contributionRole: "Referent/in",
    title: "Digitale Inhalte",
    bio: "Kurze Vita.",
    description: "Kurzer Themenabriss.",
    notes: "Referent und Funktion kurz vorstellen · Zum Thema überleiten",
    selected: true
  });
});

test("erfasst bei Diskussionen Moderation und Teilnehmende getrennt", () => {
  const cards = buildModerationCards({
    event: { scheduleItems: [{ time: "11:00", type: "Diskussionsrunde", title: "Zukunft des Fernsehens", topicId: "discussion-1" }] },
    topics: [{
      id: "discussion-1",
      title: "Zukunft des Fernsehens",
      contributionType: "discussion",
      speakerIds: ["participant-1", "participant-2"],
      moderatorIds: ["moderator-1"]
    }],
    speakers: [
      { id: "moderator-1", name: "Mara Moderation" },
      { id: "participant-1", name: "Peter Eins" },
      { id: "participant-2", name: "Paula Zwei" }
    ]
  });
  assert.deepEqual(cards.map(card => [card.speakerName, card.contributionRole]), [
    ["Peter Eins", "Teilnehmer/in"],
    ["Paula Zwei", "Teilnehmer/in"],
    ["Mara Moderation", "Moderation"]
  ]);
});

test("erzeugt für mehrere Referenten eines Vortrags je eine Karte", () => {
  const cards = buildModerationCards({
    event: { scheduleItems: [{ time: "10:00", title: "Panel", speakerIds: ["a", "b"] }] },
    speakers: [{ id: "a", name: "Ada Eins" }, { id: "b", name: "Berta Zwei" }]
  });
  assert.deepEqual(cards.map(card => card.speakerName), ["Ada Eins", "Berta Zwei"]);
});

test("erzeugt nur Karten für Vorträge, Begrüßung und Verabschiedung", () => {
  const cards = buildModerationCards({
    event: { scheduleItems: [
      { time: "09:30", person: "M. Schmidtmann", type: "Begrüßung", title: "Begrüßung" },
      { time: "10:30", person: "Pause", type: "Pause", title: "Networking" },
      { time: "13:50", person: "Beate Busch", type: "Ende", title: "Fazit, Danksagung und Verabschiedung" },
      { time: "15:00", person: "Ende der Veranstaltung", type: "Programmpunkt", title: "" }
    ] },
    boardMembers: [
      { id: "michael", name: "RA Michael Schmittmann", role: "Vorstand" },
      { id: "beate", name: "Beate Busch", role: "1. Vorsitzende" }
    ]
  });
  assert.deepEqual(cards.map(card => card.speakerName), ["RA Michael Schmittmann", "Beate Busch"]);
  assert.equal(cards[0].title, "Begrüßung");
  assert.equal(cards[1].title, "Fazit, Danksagung und Verabschiedung");
});
test("verdichtet Kartentexte nur an vollständigen Satzgrenzen", () => {
  const longBio = "Erster wichtiger Satz zur Person. Zweiter wichtiger Satz zur Erfahrung. Dieser dritte Satz ist für die Moderation nicht wesentlich.";
  const longDescription = "Der Vortrag erklärt den zentralen Zusammenhang. Er zeigt die wichtigste praktische Folge. Weitere Details bleiben im hinterlegten Langtext.";
  const longNotes = "Person kurz begrüßen. Kernaussage nennen. Zur ersten Frage überleiten. Zusätzlichen Nebenpunkt erläutern.";
  const [card] = buildModerationCards({
    event: { scheduleItems: [{ time: "12:00", title: "Langer Vortrag", speakerId: "speaker-long", topicId: "topic-long", notes: longNotes }] },
    speakers: [{ id: "speaker-long", name: "Lange Person", bio: longBio }],
    topics: [{ id: "topic-long", title: "Langer Vortrag", description: longDescription }]
  });
  assert.equal(card.bio, "Erster wichtiger Satz zur Person. Zweiter wichtiger Satz zur Erfahrung.");
  assert.equal(card.description, "Der Vortrag erklärt den zentralen Zusammenhang. Er zeigt die wichtigste praktische Folge.");
  assert.equal(card.notes, "Person kurz begrüßen. Kernaussage nennen. Zur ersten Frage überleiten.");
  assert.equal(card.bio.endsWith("…"), false);
  assert.equal(card.description.endsWith("…"), false);
  assert.equal(card.notes.endsWith("…"), false);
});
test("Begrüßungskarte unterstützt die Gastgeberin statt sie vorzustellen", () => {
  const cards = buildModerationCards({
    event: {
      title: "Medienfrühstück bei HEUKING",
      scheduleItems: [
        { time: "09:30", person: "Beate Busch", type: "Begrüßung", title: "Begrüßung" },
        { time: "09:40", title: "Vertrauen in digitale Inhalte stärken", topicId: "topic-1", speakerId: "speaker-1" }
      ]
    },
    boardMembers: [{ id: "beate", name: "Beate Busch", role: "Vorstand", company: "PROdigitalTV", bio: "Beate Busch ist Gastgeberin und Vorstandsmitglied." }],
    speakers: [{ id: "speaker-1", name: "Norbert Grill" }],
    topics: [{ id: "topic-1", title: "Vertrauen in digitale Inhalte stärken" }]
  });
  const welcome = cards[0];
  assert.equal(welcome.speakerName, "Beate Busch");
  assert.equal(welcome.position, "");
  assert.equal(welcome.company, "");
  assert.equal(welcome.bio, "");
  assert.match(welcome.description, /herzlich willkommen/i);
  assert.match(welcome.description, /Medienfrühstück bei HEUKING/);
  assert.match(welcome.description, /09:40 Uhr – Vertrauen in digitale Inhalte stärken/);
  assert.doesNotMatch(welcome.description, /Beate Busch ist|Vorstandsmitglied/);
  assert.match(welcome.notes, /Ablauf ankündigen/);
});
test("lädt gespeicherte Bearbeitungen und ergänzt neue Programmkarten", () => {
  const generated = [
    { id: "card-a", title: "Original A", description: "Originaltext A.", selected: true },
    { id: "card-b", title: "Original B", description: "Originaltext B.", selected: true }
  ];
  const restored = mergeSavedModerationCards(generated, [
    { id: "card-a", title: "Bearbeitet A", description: "Gespeicherter Text.", notes: "Gespeicherter Hinweis." }
  ]);
  assert.deepEqual(restored.map(card => card.id), ["card-a", "card-b"]);
  assert.equal(restored[0].title, "Bearbeitet A");
  assert.equal(restored[0].description, "Gespeicherter Text.");
  assert.equal(restored[0].notes, "Gespeicherter Hinweis.");
  assert.equal(restored[1].title, "Original B");
});

test("entfernte Programmkarten werden auch bei leerem Speicherstand nicht wieder erzeugt", () => {
  const generated = [{ id: "a", title: "A" }, { id: "b", title: "B" }];
  assert.deepEqual(mergeSavedModerationCards(generated, [], ["a"]).map(card => card.id), ["b"]);
  assert.deepEqual(mergeSavedModerationCards(generated, [], ["a", "b"]), []);
  assert.deepEqual(mergeSavedModerationCards(generated, [{ id: "a", title: "Gespeichert" }], ["a"]).map(card => card.id), ["b"]);
});
