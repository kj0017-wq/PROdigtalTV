const text = (value) => String(value || "").trim();
const ids = (value) => Array.isArray(value) ? value.map(text).filter(Boolean) : [];
function eventAgendaItem(item = {}, topics = [], speakers = []) {
  const title = text(item.title || item.topicTitle || item.label || item.type);
  let topic = topics.find((entry) => entry.id === item.topicId);
  if (!topic && title) {
    const matches = topics.filter((entry) => text(entry.title).toLowerCase() === title.toLowerCase());
    if (matches.length === 1) topic = matches[0];
  }
  const speakerIds = [...new Set([
    text(item.speakerId), ...ids(item.speakerIds),
    text(topic?.speakerId), ...ids(topic?.speakerIds),
    ...speakers.filter((speaker) => topic?.id &&
      (speaker.topicId === topic.id || ids(speaker.topicIds).includes(topic.id))).map((speaker) => speaker.id)
  ].filter(Boolean))];
  const speakerById = new Map(speakers.map((speaker) => [speaker.id, speaker]));
  const names = speakerIds.map((id) => {
    const speaker = speakerById.get(id);
    return speaker ? text(speaker.name || speaker.displayName || [speaker.firstName, speaker.lastName].filter(Boolean).join(" ")) : "";
  }).filter(Boolean);
  return {
    time: text(item.time || item.startTime || item.startsAt),
    title,
    topicId: text(topic?.id || item.topicId),
    speakerIds,
    isTalk: Boolean(topic || speakerIds.length || /vortrag|talk|panel|präsentation|praesentation/i.test(text(item.type))),
    description: text(topic?.longDescription || topic?.description || topic?.shortDescription || item.description || item.abstract),
    person: [...new Set(names)].join(", ") || text(item.person || item.speaker || item.speakerName || item.presenter)
  };
}

function eventAgendaItems(event = {}, topics = [], speakers = []) {
  let rows = Array.isArray(event.scheduleItems) && event.scheduleItems.length ? event.scheduleItems : [];
  if (!rows.length) {
    rows = String(event.scheduleText || event.agendaText || event.programText || "").split(/\n+/).map(line => {
      const parts = line.trim().split("|").map(part => part.trim());
      if (parts.length >= 3) return { time: parts[0], person: parts[2] ? parts[1] : "", title: parts.slice(2).join(" | ") || parts[1] };
      if (parts.length === 2) return { time: parts[0], title: parts[1] };
      const match = line.trim().match(/^(\d{1,2}:\d{2})\s+(.+)$/);
      return { time: match?.[1] || "", title: match?.[2] || line.trim() };
    }).filter(item => item.title);
  }
  return rows.map(row => eventAgendaItem(row, topics, speakers));
}

module.exports = { eventAgendaItem, eventAgendaItems };
