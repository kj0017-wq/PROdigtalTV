// Read-only audit for SPORT1 contribution links across events and reusable content records.
const base = "C:/Users/Klaus-HP/AppData/Roaming/npm/node_modules/firebase-tools/lib";
const auth = require(base + "/auth");
const { requireAuth } = require(base + "/requireAuth");
const { Client } = require(base + "/apiv2");

const decode = (value) => {
  if (!value) return null;
  if (value.arrayValue) return (value.arrayValue.values || []).map(decode);
  if (value.mapValue) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, item]) => [key, decode(item)]));
  return value.stringValue ?? value.timestampValue ?? value.integerValue ?? value.doubleValue ?? value.booleanValue ?? null;
};

const rows = (response) => (response.body || [])
  .filter((item) => item.document)
  .map((item) => ({
    id: item.document.name.split("/").pop(),
    ...Object.fromEntries(Object.entries(item.document.fields || {}).map(([key, value]) => [key, decode(value)]))
  }));

const contains = (record, needle) => JSON.stringify(record || {}).toLocaleLowerCase("de").includes(needle);
const ids = (value) => Array.isArray(value) ? value.filter(Boolean) : [];
const mentions = (value, path = "") => {
  if (typeof value === "string") {
    const lower = value.toLocaleLowerCase("de");
    const index = lower.indexOf("sport1");
    if (index < 0) return [];
    return [{ path, excerpt: value.slice(Math.max(0, index - 140), Math.min(value.length, index + 260)).replace(/\s+/g, " ") }];
  }
  if (Array.isArray(value)) return value.flatMap((item, index) => mentions(item, `${path}[${index}]`));
  if (value && typeof value === "object") return Object.entries(value).flatMap(([key, item]) => mentions(item, path ? `${path}.${key}` : key));
  return [];
};
const textGroups = (records) => {
  const groups = new Map();
  records.forEach((record) => Object.entries(record).forEach(([field, value]) => {
    if (typeof value !== "string" || !value.toLocaleLowerCase("de").includes("sport1")) return;
    const key = value;
    if (!groups.has(key)) groups.set(key, { fields: [], text: value });
    groups.get(key).fields.push(`${record.id}.${field}`);
  }));
  return [...groups.values()];
};

(async () => {
  const options = { project: "prodigitaltv-da47b", nonInteractive: true };
  auth.setActiveAccount(options, auth.selectAccount(null, process.cwd()));
  await requireAuth(options);
  const client = new Client({ urlPrefix: "https://firestore.googleapis.com", apiVersion: "v1", auth: true });
  const list = async (collectionId) => rows(await client.post("/projects/prodigitaltv-da47b/databases/(default)/documents:runQuery", {
    structuredQuery: { from: [{ collectionId }], limit: 1000 }
  }));

  const [events, topics, speakers, editorial, galleries, downloads, mediaAssets] = await Promise.all([
    list("events"), list("topics"), list("speakers"), list("editorialContent"),
    list("galleries"), list("downloads"), list("media_assets")
  ]);
  const sportTopics = topics.filter((topic) => contains(topic, "sport1"));
  const sportTopicIds = new Set(sportTopics.map((topic) => topic.id));
  const relevantEvents = events.filter((event) => {
    const eventTopicIds = new Set(ids(event.topicIds));
    const schedule = ids(event.scheduleItems);
    return contains({ title: event.title }, "von den besten lernen")
      || contains({ title: event.title, locationName: event.locationName }, "heuking")
      || [...sportTopicIds].some((id) => eventTopicIds.has(id))
      || schedule.some((item) => sportTopicIds.has(item?.topicId) || contains(item, "sport1"))
      || contains({ description: event.description, longDescription: event.longDescription, postEventSummary: event.postEventSummary }, "sport1");
  });
  const linkedRecords = [...speakers, ...editorial, ...galleries, ...downloads, ...mediaAssets]
    .filter((record) => contains(record, "sport1") || ids(record.topicIds).some((id) => sportTopicIds.has(id)) || sportTopicIds.has(record.topicId))
    .map((record) => ({
      id: record.id,
      title: record.title || record.name || record.fileName || "",
      eventId: record.eventId || "",
      eventIds: ids(record.eventIds),
      topicId: record.topicId || "",
      topicIds: ids(record.topicIds)
    }));

  console.log(JSON.stringify({
    sportTopics: sportTopics.map((topic) => ({
      id: topic.id,
      title: topic.title || "",
      company: topic.company || topic.companyName || "",
      status: topic.status || "",
      eventId: topic.eventId || "",
      eventIds: ids(topic.eventIds),
      speakerId: topic.speakerId || "",
      speakerIds: ids(topic.speakerIds)
    })),
    events: relevantEvents.map((event) => ({
      id: event.id,
      title: event.title || "",
      date: event.date || "",
      topicIds: ids(event.topicIds).filter((id) => sportTopicIds.has(id)),
      speakerIds: ids(event.speakerIds),
      scheduleItems: ids(event.scheduleItems)
        .filter((item) => sportTopicIds.has(item?.topicId) || contains(item, "sport1"))
        .map((item) => ({ id: item.id || "", time: item.time || "", title: item.title || "", topicId: item.topicId || "", speakerId: item.speakerId || "" })),
      textMentionsSport1: contains({ description: event.description, longDescription: event.longDescription, postEventSummary: event.postEventSummary }, "sport1")
    })),
    linkedRecords
    ,targetMentions: {
      events: relevantEvents
        .filter((event) => /von den besten lernen/i.test(event.title || ""))
        .map((event) => ({ id: event.id, mentions: mentions(event) })),
      editorial: editorial
        .filter((record) => /von den besten lernen/i.test(record.title || "") || record.eventId === "event-c5082f22-057b-44b4-8d50-8ccf3421f459" || record.sourceEventId === "event-c5082f22-057b-44b4-8d50-8ccf3421f459")
        .map((record) => ({ id: record.id, title: record.title || "", mentions: mentions(record) }))
    },
    targetTextGroups: textGroups([
      ...events.filter((event) => event.id === "event-c5082f22-057b-44b4-8d50-8ccf3421f459"),
      ...editorial.filter((record) => record.id === "retrospective-event-c5082f22-057b-44b4-8d50-8ccf3421f459")
    ])
  }, null, 2));
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
