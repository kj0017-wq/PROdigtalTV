import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import * as format from "../src/utils/format.js";
import { eventLiveRequestMeta, eventLiveRequestTime, eventLiveConnection, eventLiveInboxMarkup } from "../src/utils/eventLiveRequests.js";

const source = readFileSync(new URL("../src/main.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const start = source.indexOf("function wireEventLiveActions() {");
assert.ok(start >= 0);
const wiring = source.slice(start, source.indexOf("\n}", start) + 2);
const formatImports = source.match(/import \{([^}]+)\} from "\.\/utils\/format\.js[^\"]*"/)[1].split(",").map((name) => name.trim());
const participants = [
  { contactId: "no-photo", displayName: "Test Person", photoUrl: "" },
  { contactId: "with-photo", displayName: "Photo Person", photoUrl: "https://example.test/photo.jpg" }
];
let focused = false;
let currentRoot = null;
const mountedChats = [];
const content = { innerHTML: "", querySelector: () => ({
  focus() { focused = true; },
  insertAdjacentHTML(position, html) { content.innerHTML += html; }
}) };
const layer = { hidden: true, querySelector: () => content };
const data = { dataset: { eventLiveData: JSON.stringify({ participants, profile: { contactId: "viewer" }, requests: [] }) } };
const makeCards = () => participants.map((person, index) => ({
  dataset: { livePerson: person.contactId, livePersonIndex: String(index) },
  handlers: {},
  addEventListener(type, handler) { this.handlers[type] = handler; }
}));
let cards = makeCards();
const document = {
  documentElement: { dataset: {} },
  querySelector(selector) {
    return ({ "[data-event-live-data]": data, "[data-live-detail-layer]": layer, "[data-event-live-root]": currentRoot })[selector] || null;
  },
  querySelectorAll: () => cards,
  addEventListener() {}
};
const context = vm.createContext({ document, eventLiveRequestMeta, mountEventLiveChat: (...args) => mountedChats.push(args), ...Object.fromEntries(formatImports.map((name) => [name, format[name]])) });
vm.runInContext(`${wiring}\nwireEventLiveActions();`, context);
function checkCard(index) {
  layer.hidden = true;
  focused = false;
  currentRoot = { dataset: { eventId: "event" } };
  cards[index].handlers.click({ preventDefault() {} });
  currentRoot = null;
  assert.equal(layer.hidden, false);
  assert.ok(content.innerHTML.includes(participants[index].displayName));
  assert.ok(focused);
}
checkCard(0);
assert.ok(content.innerHTML.includes("<span>TP</span>"));
checkCard(1);
cards = makeCards();
vm.runInContext("wireEventLiveActions();", context);
checkCard(0);
const request = {
  senderContactId: "viewer", receiverContactId: "no-photo", status: "pending",
  requestedAt: { _seconds: 1790590385 }, deliveredAt: { seconds: 1790590385 }, deliveryChannel: "event_live"
};
data.dataset.eventLiveData = JSON.stringify({ participants, profile: { contactId: "viewer" }, requests: [request] });
checkCard(0);
assert.ok(content.innerHTML.includes("Anfrage gesendet"));
assert.ok(content.innerHTML.includes("Bereitgestellt:"));
assert.ok(content.innerHTML.includes("Event Chat → Kontakte"));
assert.equal(eventLiveRequestTime(request.requestedAt), eventLiveRequestTime(request.deliveredAt));
assert.equal(eventLiveRequestTime("invalid"), "");
assert.ok(!eventLiveRequestMeta({ requestedAt: request.requestedAt }).includes("Bereitgestellt:"));
request.status = "rejected";
request.answeredAt = request.requestedAt;
data.dataset.eventLiveData = JSON.stringify({ participants, profile: { contactId: "viewer" }, requests: [request] });
checkCard(0);
assert.ok(content.innerHTML.includes("Anfrage abgelehnt"));
assert.ok(content.innerHTML.includes("Beantwortet:"));
assert.ok(!content.innerHTML.includes("data-live-contact-request"));
console.log("Event Live: profiles with/without photos and after re-render open successfully.");
const pageSource = readFileSync(new URL("../src/pages/eventLivePage.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const requestStart = pageSource.indexOf("export function requestsMarkup");
vm.runInContext(pageSource.slice(requestStart, pageSource.indexOf("\n}", requestStart) + 2).replace("export ", ""), context);
const outgoingData = { participants, profile: { contactId: "viewer" }, requests: [{ ...request, status: "pending" }] };
context.fixture = outgoingData;
const outgoingMarkup = vm.runInContext("requestsMarkup(fixture)", context);
assert.ok(outgoingMarkup.includes("An Test Person"));
assert.ok(outgoingMarkup.includes('data-live-request-state="outgoing"'));
const incomingData = { participants, profile: { contactId: "viewer" }, requests: [{ ...request, senderContactId: "no-photo", receiverContactId: "viewer", status: "pending" }] };
context.fixture = incomingData;
const incomingMarkup = vm.runInContext("requestsMarkup(fixture)", context);
assert.ok(incomingMarkup.includes("Von Test Person"));
assert.ok(incomingMarkup.includes('data-live-request-answer="accepted"'));
assert.ok(incomingMarkup.includes('data-live-request-answer="rejected"'));
assert.equal(eventLiveConnection(incomingData, "no-photo").state, "incoming");
assert.ok(mountedChats.length > 0);
assert.equal(mountedChats.at(-1)[4].canSend, false);
const inboxData = { participants, conversations: [{ peerId: "no-photo", lastText: "Hello", lastMessageSelf: true, lastMessageRead: false }] };
assert.ok(eventLiveInboxMarkup(inboxData).includes('data-unread="true"'));
inboxData.conversations[0].lastMessageRead = true;
assert.ok(eventLiveInboxMarkup(inboxData).includes('data-unread="false"'));
assert.ok(eventLiveInboxMarkup(inboxData).includes('Du · Gelesen'));
console.log("Contact requests: sender/recipient names, direction, timestamps and response buttons passed.");
