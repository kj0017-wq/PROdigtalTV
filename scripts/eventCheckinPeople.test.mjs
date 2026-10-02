import assert from "node:assert/strict";
import test from "node:test";
import { sameCheckinPerson, splitEventCheckinPeople } from "../src/utils/eventCheckinPeople.js";

test("erkennt Vorstandsmitglied trotz Titel im Namen", () => {
  assert.equal(sameCheckinPerson(
    { name: "Michael Schmittmann" },
    { name: "RA Michael Schmittmann" }
  ), true);
});

test("fuehrt Vorstandsmitglieder nur in der Vorstandsgruppe", () => {
  const result = splitEventCheckinPeople(
    [{ id: "speaker-michael", name: "Michael Schmittmann" }, { id: "speaker-julia", name: "Julia Gloning" }],
    [{ id: "board-michael", name: "RA Michael Schmittmann", role: "Vorstand" }]
  );
  assert.deepEqual(result.boardMembers.map((person) => person.id), ["board-michael"]);
  assert.deepEqual(result.speakers.map((person) => person.id), ["speaker-julia"]);
});
