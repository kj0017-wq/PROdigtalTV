const hiddenStatuses = new Set(["inactive", "archived", "draft", "deleted", "hidden", "invisible"]);

export function isVisibleEventTalk(topic = {}) {
  return !hiddenStatuses.has(String(topic.status || "").toLowerCase());
}

export function hiddenTalkTitles(event = {}, topics = []) {
  const ids = new Set(event.topicIds || []);
  return topics.filter((topic) => ids.has(topic.id) && !isVisibleEventTalk(topic))
    .map((topic) => String(topic.title || topic.headline || "").trim()).filter(Boolean);
}

function normalized(text) {
  return String(text || "").replace(/[\u2010-\u2015]/g, "-").replace(/\s+/g, " ").trim().toLocaleLowerCase("de");
}

export function mentionedHiddenTalks(text, titles = []) {
  const content = normalized(text);
  return titles.filter((title) => content.includes(normalized(title)));
}

export function removeHiddenTalkMentions(text, titles = []) {
  if (!titles.length || !mentionedHiddenTalks(text, titles).length) return String(text || "");
  return String(text || "").split(/(\n\s*\n)/).map((part) => {
    if (!mentionedHiddenTalks(part, titles).length) return part;
    const sentences = part.split(/(?<=[.!?])\s+/);
    const kept = sentences.filter((sentence) => !mentionedHiddenTalks(sentence, titles).length).join(" ");
    return mentionedHiddenTalks(kept, titles).length ? "" : kept;
  }).join("").replace(/\n{3,}/g, "\n\n").trim();
}