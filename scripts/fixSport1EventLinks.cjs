// Removes the stale SPORT1 links from "Von den Besten lernen - München" only.
// Run without --apply for a dry run.
const base = "C:/Users/Klaus-HP/AppData/Roaming/npm/node_modules/firebase-tools/lib";
const auth = require(base + "/auth");
const { requireAuth } = require(base + "/requireAuth");
const { Client } = require(base + "/apiv2");

const projectId = "prodigitaltv-da47b";
const eventId = "event-c5082f22-057b-44b4-8d50-8ccf3421f459";
const heukingEventId = "event-archive-63";
const topicId = "topics-527a7339-d174-4a41-9282-9f9190bac80d";
const retrospectiveId = `retrospective-${eventId}`;
const apply = process.argv.includes("--apply");
const eventTextFields = ["longDescription", "archiveText", "bodyText", "articleText"];
const root = `/projects/${projectId}/databases/(default)/documents`;
const name = (collection, id) => `projects/${projectId}/databases/(default)/documents/${collection}/${id}`;

const decode = (value) => {
  if (!value) return null;
  if (value.arrayValue) return (value.arrayValue.values || []).map(decode);
  if (value.mapValue) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, item]) => [key, decode(item)]));
  return value.stringValue ?? value.timestampValue ?? value.integerValue ?? value.doubleValue ?? value.booleanValue ?? null;
};
const record = (document) => ({
  id: document.name.split("/").pop(),
  ...Object.fromEntries(Object.entries(document.fields || {}).map(([key, value]) => [key, decode(value)]))
});

(async () => {
  const options = { project: projectId, nonInteractive: true };
  auth.setActiveAccount(options, auth.selectAccount(null, process.cwd()));
  await requireAuth(options);
  const client = new Client({ urlPrefix: "https://firestore.googleapis.com", apiVersion: "v1", auth: true });
  const [topicResponse, eventResponse, retrospectiveResponse] = await Promise.all([
    client.get(`${root}/topics/${topicId}`),
    client.get(`${root}/events/${eventId}`),
    client.get(`${root}/editorialContent/${retrospectiveId}`)
  ]);
  const topic = record(topicResponse.body);
  const event = record(eventResponse.body);
  const retrospective = record(retrospectiveResponse.body);
  if (topic.title !== "Sport1 - All Access") throw new Error(`Unexpected topic: ${topic.title || topic.id}`);
  if (!/von den besten lernen/i.test(event.title || "")) throw new Error(`Unexpected event: ${event.title || event.id}`);
  if (!/rückblick: von den besten lernen/i.test(retrospective.title || "")) throw new Error(`Unexpected retrospective: ${retrospective.title || retrospective.id}`);
  const remainingEventIds = [...new Set((topic.eventIds || []).filter((id) => id !== eventId))];
  if (!remainingEventIds.includes(heukingEventId)) throw new Error("HEUKING link would be missing after cleanup.");
  const populatedFields = eventTextFields.filter((field) => typeof event[field] === "string" && /sport1/i.test(event[field]));
  const plan = {
    apply,
    topic: { id: topicId, removeEventId: eventId, keepEventIds: remainingEventIds },
    event: { id: eventId, title: event.title, removeFields: populatedFields },
    deleteEditorialRecord: { id: retrospectiveId, title: retrospective.title },
    preserved: { heukingEventId, topicId, speakerIds: topic.speakerIds || [topic.speakerId].filter(Boolean) }
  };
  if (!apply) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }
  const writes = [
    {
      update: {
        name: name("topics", topicId),
        fields: { eventIds: { arrayValue: { values: remainingEventIds.map((id) => ({ stringValue: id })) } } }
      },
      updateMask: { fieldPaths: ["eventIds"] },
      currentDocument: { updateTime: topicResponse.body.updateTime }
    },
    {
      update: { name: name("events", eventId), fields: {} },
      updateMask: { fieldPaths: populatedFields },
      currentDocument: { updateTime: eventResponse.body.updateTime }
    },
    {
      delete: name("editorialContent", retrospectiveId),
      currentDocument: { updateTime: retrospectiveResponse.body.updateTime }
    }
  ];
  const result = await client.post(`${root}:commit`, { writes });
  console.log(JSON.stringify({ ...plan, committed: true, writeResults: result.body.writeResults?.length || 0 }, null, 2));
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
