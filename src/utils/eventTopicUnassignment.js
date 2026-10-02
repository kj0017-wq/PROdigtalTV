const eventTextFields = [
  "description", "shortDescription", "teaserText", "introText", "longDescription",
  "postEventSummary", "postEventummary", "archiveText", "bodyText", "articleText"
];

function normalized(value = "") {
  return String(value).replace(/[\u2010-\u2015]/g, "-").replace(/\s+/g, " ").trim().toLocaleLowerCase("de");
}

function topicPersonIds(topic = {}) {
  return [...new Set([
    topic.speakerId, topic.moderatorId, topic.coModeratorId,
    ...(topic.speakerIds || []), ...(topic.speakers || []), ...(topic.moderatorIds || []),
    ...(topic.coModeratorIds || []), ...Object.keys(topic.speakerRoles || {})
  ].filter(Boolean))];
}

function topicTerms(topic = {}, speakers = []) {
  const personIds = new Set(topicPersonIds(topic));
  return [...new Set([
    topic.title, topic.headline,
    ...speakers.filter((speaker) => personIds.has(speaker.id)).flatMap((speaker) => [
      speaker.name || [speaker.firstName, speaker.lastName].filter(Boolean).join(" "),
      speaker.company
    ])
  ].map((value) => String(value || "").trim()).filter((value) => value.length >= 4))];
}

function includesTerm(value = "", terms = []) {
  const content = normalized(value);
  return terms.some((term) => content.includes(normalized(term)));
}

export function removeTopicMentions(value = "", terms = []) {
  if (!includesTerm(value, terms)) return String(value || "");
  return String(value || "").split(/(\n\s*\n)/).map((part) => {
    if (!includesTerm(part, terms)) return part;
    const sentences = part.split(/(?<=[.!?])\s+/);
    const kept = sentences.filter((sentence) => !includesTerm(sentence, terms)).join(" ").trim();
    return includesTerm(kept, terms) ? "" : kept;
  }).join("").replace(/\n{3,}/g, "\n\n").trim();
}

function cleanedTextPatch(record = {}, terms = []) {
  return Object.fromEntries(eventTextFields
    .filter((field) => typeof record[field] === "string" && includesTerm(record[field], terms))
    .map((field) => [field, removeTopicMentions(record[field], terms)]));
}

function topicUsesSpeaker(topic = {}, speakerId = "") {
  return topicPersonIds(topic).includes(speakerId);
}

export function buildEventTopicUnassignmentPlan({ event = {}, topic = {}, events = [], topics = [], speakers = [], retrospective = null } = {}) {
  const remainingTopicIds = (event.topicIds || []).filter((id) => id !== topic.id);
  const remainingTopics = topics.filter((item) => remainingTopicIds.includes(item.id));
  const relatedSpeakers = speakers.filter((speaker) => topicUsesSpeaker(topic, speaker.id)
    || speaker.topicId === topic.id || (speaker.topicIds || []).includes(topic.id));
  const speakerStillInEvent = (speaker) => remainingTopics.some((item) => topicUsesSpeaker(item, speaker.id)
    || speaker.topicId === item.id || (speaker.topicIds || []).includes(item.id));
  const removedSpeakerIds = new Set(relatedSpeakers.filter((speaker) => !speakerStillInEvent(speaker)).map((speaker) => speaker.id));
  const otherEventIds = [...new Set([
    ...(topic.eventIds || []),
    topic.eventId,
    ...events.filter((item) => item.id !== event.id && ((item.topicIds || []).includes(topic.id)
      || item.topicId === topic.id || (item.scheduleItems || []).some((entry) => entry?.topicId === topic.id))).map((item) => item.id)
  ].filter((id) => id && id !== event.id))];
  const terms = topicTerms(topic, relatedSpeakers);
  const retrospectiveMentionsTopic = retrospective ? eventTextFields.some((field) => includesTerm(retrospective[field], terms)) : false;
  const eventPatch = {
    topicIds: remainingTopicIds,
    topicId: event.topicId === topic.id ? "" : event.topicId || "",
    speakerIds: (event.speakerIds || []).filter((id) => !removedSpeakerIds.has(id)),
    scheduleItems: (event.scheduleItems || []).filter((item) => item?.topicId !== topic.id),
    ...cleanedTextPatch(event, terms)
  };
  if (retrospectiveMentionsTopic && retrospective?.id === event.retrospectiveArticleId) eventPatch.retrospectiveArticleId = "";
  return {
    eventPatch,
    topicPatch: {
      eventId: topic.eventId === event.id ? "" : topic.eventId || "",
      eventIds: otherEventIds,
      publicationEventId: topic.publicationEventId === event.id ? otherEventIds[0] || "" : topic.publicationEventId || ""
    },
    speakerPatches: relatedSpeakers.map((speaker) => ({
      id: speaker.id,
      eventId: speaker.eventId === event.id && !speakerStillInEvent(speaker) ? "" : speaker.eventId || "",
      eventIds: (speaker.eventIds || []).filter((id) => id !== event.id || speakerStillInEvent(speaker))
    })),
    retrospectiveAction: !retrospectiveMentionsTopic ? "none"
      : retrospective?.automaticEventAssignment === true ? "delete" : "update",
    retrospectivePatch: retrospectiveMentionsTopic ? cleanedTextPatch(retrospective, terms) : {},
    preservedEventIds: otherEventIds,
    terms
  };
}
