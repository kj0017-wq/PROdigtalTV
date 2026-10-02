const test = require("node:test");
const assert = require("node:assert/strict");
const { eventAgendaItem, eventAgendaItems } = require("./eventAgenda");
const speakers = [
  { id: "anna", name: "Anna Beispiel" },
  { id: "max", name: "Max Mustermann", topicId: "talk" },
  { id: "lea", firstName: "Lea", lastName: "Muster", topicIds: ["talk"] },
  { id: "other", name: "Andere Person", topicId: "other" }
];
test("agenda resolves every linked speaker and separates names by commas", () => {
  const item = { time: "10:30", title: "Vortrag", topicId: "talk", speakerId: "anna", speakerIds: ["anna", "max"], person: "Max Mustermann" };
  const topic = { id: "talk", title: "Vortrag", speakerIds: ["anna", "max"] };
  assert.deepEqual(eventAgendaItem(item, [topic], speakers), { time: "10:30", title: "Vortrag", topicId: "talk", speakerIds: ["anna", "max", "lea"], isTalk: true, description: "", person: "Anna Beispiel, Max Mustermann, Lea Muster" });
});
test("old schedule entries resolve a uniquely matching topic; neutral agenda rows stay unchanged", () => {
  assert.equal(eventAgendaItem({ title: "Vortrag", person: "Anna Beispiel" },
    [{ id: "talk", title: "Vortrag", speakerIds: ["anna", "max"] }], speakers).person, "Anna Beispiel, Max Mustermann, Lea Muster");
  assert.equal(eventAgendaItem({ type: "Pause", person: "Pause" }, [], speakers).person, "Pause");
  assert.equal(eventAgendaItem({ title: "Unbekannt", speakerIds: ["missing"], person: "Freitext" }, [], speakers).person, "Freitext");
});
test("duplicate names are not repeated and other talk speakers are excluded", () => {
  const item = { title: "Vortrag", speakerIds: ["anna", "anna", "max"] };
  assert.equal(eventAgendaItem(item, [], speakers).person, "Anna Beispiel, Max Mustermann");
});

test("agenda includes the full description of the linked talk", () => {
  const result = eventAgendaItem({ topicId: "talk", title: "Vortrag" },
    [{ id: "talk", longDescription: "Ausführliche Beschreibung", shortDescription: "Kurztext" }], []);
  assert.equal(result.description, "Ausführliche Beschreibung");
  assert.equal(result.isTalk, true);
  assert.equal(eventAgendaItem({ title: "Pause", type: "Pause" }, [], []).isTalk, false);
});

test("legacy live agendas use program title followed by person and resolve linked talk descriptions", () => {
  const items = eventAgendaItems({scheduleText: "09:00 | Beate Busch | Begrüßung durch PROdigitalTV\n10:00 | Anna Beispiel | Vortrag"},
    [{id:"talk",title:"Vortrag",longDescription:"Beschreibung",speakerIds:["anna","max"]}],speakers);
  assert.equal(items[0].title,"Begrüßung durch PROdigitalTV");
  assert.equal(items[0].person,"Beate Busch");
  assert.equal(items[1].description,"Beschreibung");
  assert.equal(items[1].person,"Anna Beispiel, Max Mustermann, Lea Muster");
  assert.equal(items.length,2);
});

test("assigned talks absent from the schedule never appear after the event ends", () => {
  const topics = [{id:"sport1",title:"Sport1 - All Access",speakerIds:["anna"]}];
  const result = eventAgendaItems({scheduleText:"21:30 | Ende der Veranstaltung |"},topics,speakers);
  assert.equal(result.length,1);
  assert.equal(result[0].title,"Ende der Veranstaltung");
  assert.equal(result.some(item=>item.topicId==="sport1"),false);
  assert.deepEqual(eventAgendaItems({},topics,speakers),[]);
});
