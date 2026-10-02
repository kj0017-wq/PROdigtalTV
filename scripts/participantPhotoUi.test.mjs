import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

test("prefetched photos are only marked seen after visible successful image loading", async () => {
  const observers = [];
  const timers = [];
  const calls = [];
  const imageClasses = new Set(["is-broken-image"]);
  const linkClasses = new Set(["image-load-failed"]);
  const image = { naturalWidth: 0, classList: { remove: (name) => imageClasses.delete(name) } };
  const status = {};
  const link = { classList: { remove: (name) => linkClasses.delete(name) } };
  const card = { dataset: { participantPhoto: "photo", photoUnread: "1" }, querySelector: (selector) =>
    selector.includes("image") ? image : selector.includes("status") ? status : link };
  const root = { addEventListener() {}, dataset: { eventId: "heuking" }, isConnected: true,
    querySelectorAll: () => [card] };
  const context = {
    loadPortalParticipantPhoto: async () => "blob:test",
    markPortalParticipantPhotosSeen: async (eventId, ids) => { calls.push({ eventId, ids }); return { marked: ids }; },
    URL: { revokeObjectURL() {} },
    IntersectionObserver: class { constructor(callback, options) { this.callback = callback; this.options = options; observers.push(this); } observe() {} unobserve() {} disconnect() {} },
    MutationObserver: class { observe() {} disconnect() {} },
    document: { visibilityState: "visible", body: {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() {} },
    window: { setInterval() {}, clearInterval() {}, setTimeout(callback) { timers.push(callback); return timers.length; }, clearTimeout() {}, addEventListener() {}, removeEventListener() {} },
    CustomEvent: class {},
  };
  const source = readFileSync(new URL("../src/utils/participantPhotos.js", import.meta.url), "utf8")
    .replace(/^import .*;\r?\n/gm, "").replaceAll("export function", "function");
  vm.runInNewContext(source + ";mountParticipantPhotos(root);", { ...context, root });
  const loadObserver = observers.find((observer) => observer.options.rootMargin);
  const viewedObserver = observers.find((observer) => observer.options.threshold);
  loadObserver.callback([{ target: card, isIntersecting: true }]);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.length, 0);
  image.naturalWidth = 100;
  image.onload();
  assert.equal(image.hidden, false);
  assert.equal(status.hidden, true);
  assert.equal(imageClasses.has("is-broken-image"), false);
  assert.equal(linkClasses.has("image-load-failed"), false);
  assert.equal(timers.length, 0, "prefetch is not a view");
  viewedObserver.callback([{ target: card, isIntersecting: true, intersectionRatio: 0.1 }]);
  assert.equal(timers.length, 0, "a barely visible card is not a view");
  viewedObserver.callback([{ target: card, isIntersecting: true, intersectionRatio: 0.6 }]);
  await timers.pop()();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].eventId, "heuking");
  assert.equal(calls[0].ids[0], "photo");
  assert.equal(card.dataset.photoUnread, "0");
  image.onerror();
  assert.equal(status.hidden, false);
  assert.match(status.textContent, /Bildformat/);
});

test("empty QR image is not marked broken before its source is assigned", () => {
  const source = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
  const block = source.slice(source.indexOf("function markAlreadyBrokenImages"), source.indexOf("async function render()", source.indexOf("function markAlreadyBrokenImages")));
  const marked = [];
  const image = { complete: true, naturalWidth: 0, getAttribute: () => null };
  vm.runInNewContext(block + ";markAlreadyBrokenImages(scope);", { markBrokenImage: (img) => marked.push(img), scope: { querySelectorAll: () => [image] } });
  assert.equal(marked.length, 0);
  image.getAttribute = () => "bad.jpg";
  vm.runInNewContext(block + ";markAlreadyBrokenImages(scope);", { markBrokenImage: (img) => marked.push(img), scope: { querySelectorAll: () => [image] } });
  assert.equal(marked.length, 1);
});

test("an open gallery picks up photos uploaded on another device, only for its event", async () => {
  const cards = [];
  const polls = [];
  const requestedEvents = [];
  let photosDeleted = false;
  const root = {
    dataset: { eventId: "heuking" }, isConnected: true, addEventListener() {},
    querySelectorAll: () => cards, querySelector: () => null, prepend: (card) => cards.unshift(card)
  };
  const context = {
    root, escapeHtml: (value) => String(value || ""),
    listPortalParticipantPhotos: async (eventId) => {
      requestedEvents.push(eventId);
      return { photos: photosDeleted ? [] : [{ id: "new-phone-photo", eventId: "heuking", unread: true }, { id: "foreign", eventId: "other" }] };
    },
    IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} },
    MutationObserver: class { observe() {} disconnect() {} },
    document: { visibilityState: "visible", body: {}, createElement: () => { const card = { dataset: {}, querySelector: () => null, remove: () => { cards.splice(cards.indexOf(card), 1); } }; return card; },
      addEventListener() {}, removeEventListener() {}, dispatchEvent() {} },
    window: { setInterval: (callback, ms) => { polls.push({ callback, ms }); }, clearInterval() {},
      addEventListener() {}, removeEventListener() {} },
    CustomEvent: class {}
  };
  const source = readFileSync(new URL("../src/utils/participantPhotos.js", import.meta.url), "utf8")
    .replace(/^import .*;\r?\n/gm, "").replaceAll("export function", "function");
  vm.runInNewContext(source + ";mountParticipantPhotos(root);", context);
  assert.equal(cards.length, 0);
  assert.equal(polls[0].ms, 15000);
  await polls[0].callback();
  assert.equal(cards.length, 1);
  assert.equal(cards[0].dataset.participantPhoto, "new-phone-photo");
  assert.equal(requestedEvents[0], "heuking");
  await polls[0].callback();
  assert.equal(cards.length, 1, "already displayed photos are not duplicated");
  photosDeleted = true;
  await polls[0].callback();
  assert.equal(cards.length, 0, "photos deleted by an admin disappear on another device");
});
