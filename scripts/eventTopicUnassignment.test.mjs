import test from "node:test";
import assert from "node:assert/strict";
import { buildEventTopicUnassignmentPlan } from "../src/utils/eventTopicUnassignment.js";

test("gemeinsam genutzter SPORT1-Beitrag wird nur aus dem gewählten Event entfernt", () => {
  const sportTopic = {
    id: "sport1", title: "Sport1 - All Access", speakerIds: ["andreas"],
    eventIds: ["besten", "heuking"], publicationEventId: "besten"
  };
  const plan = buildEventTopicUnassignmentPlan({
    event: {
      id: "besten", topicIds: ["sport1", "anderer"], speakerIds: ["andreas", "andere"],
      scheduleItems: [{ topicId: "sport1", title: "Sport1 - All Access" }, { topicId: "anderer", title: "Anderer Beitrag" }],
      longDescription: "Ein Abend mit Sport1 - All Access.\n\nAllgemeiner Austausch und Networking.",
      retrospectiveArticleId: "retrospective-besten"
    },
    topic: sportTopic,
    events: [{ id: "besten", topicIds: ["sport1"] }, { id: "heuking", topicIds: ["sport1"] }],
    topics: [sportTopic, { id: "anderer", speakerIds: ["andere"] }],
    speakers: [
      { id: "andreas", name: "Andreas Gerhard", company: "Sport 1 GmbH", eventIds: ["besten", "heuking"], topicIds: ["sport1"] },
      { id: "andere", name: "Andere Person", eventIds: ["besten"], topicIds: ["anderer"] }
    ],
    retrospective: { id: "retrospective-besten", automaticEventAssignment: true, bodyText: "Andreas Gerhard zeigt Sport1 - All Access." }
  });
  assert.deepEqual(plan.eventPatch.topicIds, ["anderer"]);
  assert.deepEqual(plan.eventPatch.speakerIds, ["andere"]);
  assert.deepEqual(plan.eventPatch.scheduleItems, [{ topicId: "anderer", title: "Anderer Beitrag" }]);
  assert.equal(plan.eventPatch.longDescription, "Allgemeiner Austausch und Networking.");
  assert.deepEqual(plan.topicPatch.eventIds, ["heuking"]);
  assert.equal(plan.topicPatch.publicationEventId, "heuking");
  assert.deepEqual(plan.speakerPatches.find((item) => item.id === "andreas").eventIds, ["heuking"]);
  assert.equal(plan.retrospectiveAction, "delete");
  assert.equal(plan.eventPatch.retrospectiveArticleId, "");
});

test("manuell gepflegter Rückblick wird bereinigt statt vollständig gelöscht", () => {
  const plan = buildEventTopicUnassignmentPlan({
    event: { id: "event", topicIds: ["topic"], scheduleItems: [] },
    topic: { id: "topic", title: "Gelöschter Vortrag" },
    events: [], topics: [], speakers: [],
    retrospective: { id: "article", automaticEventAssignment: false, bodyText: "Gelöschter Vortrag war dabei.\n\nDer übrige Rückblick bleibt." }
  });
  assert.equal(plan.retrospectiveAction, "update");
  assert.equal(plan.retrospectivePatch.bodyText, "Der übrige Rückblick bleibt.");
});
