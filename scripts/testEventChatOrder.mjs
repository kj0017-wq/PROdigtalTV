import fs from "node:fs";
import assert from "node:assert/strict";

const source = fs.readFileSync("src/pages/eventLivePage.js", "utf8");
const render = new Function("attendeeCard", source.slice(source.indexOf("export function participantList"), source.indexOf("function attendeeDetail")).replace("export function", "function") + "; return participantList;")((person, index) => `${person.contactId}:${index}|`);
const data = {
  profile: { contactId: "own" },
  participants: [{ contactId: "older" }, { contactId: "none" }, { contactId: "newest" }, { contactId: "own" }],
  conversations: [{ peerId: "older", lastMessageAt: "2026-09-28T10:00:00Z" }, { peerId: "newest", lastMessageAt: "2026-09-28T11:00:00Z" }]
};
assert.ok(render(data).includes("own:3|newest:2|older:0|none:1|"));
data.conversations[0].lastMessageAt = "2026-09-28T12:00:00Z";
assert.ok(render(data).includes("own:3|older:0|newest:2|none:1|"));
data.participants.pop();
assert.ok(render(data).includes("own:-1|older:0|newest:2|none:1|"));
data.conversations = [];
assert.ok(render(data).includes("own:-1|older:0|none:1|newest:2|"));
console.log("Chat order passed: own profile first, latest activity next, stable fallback, original selection indexes preserved.");
