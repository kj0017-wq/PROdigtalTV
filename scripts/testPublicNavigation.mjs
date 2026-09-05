import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

// Exercise the delegated handlers without loading Firebase or changing real data.
const source = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
const start = source.indexOf('document.addEventListener("pointerdown", (event) => {');
const end = source.indexOf('window.addEventListener("hashchange", stopAllAudioPlayback', start);
assert.ok(start >= 0 && end > start);
const handlers = new Map();
let renders = 0;
let pendingIndicators = 0;
const location = { hash: "#/home" };
const context = vm.createContext({
  document: { addEventListener(type, handler) {
    handlers.set(type, [...(handlers.get(type) || []), handler]);
  } },
  window: { location, scrollTo() {}, requestAnimationFrame(fn) { fn(); } },
  clickedAnchor: (event) => event.target,
  preloadPublicRouteFromLink() {},
  showRoutePending() { pendingIndicators++; },
  clearRoutePending() {},
  closePublicTts() {},
  closePublicMenu() {},
  stopAllAudioPlayback() {},
  isExternalPortalLink: () => false,
  linkTargetHash: (link) => link.href,
  isCurrentInternalRouteLink: (link) => link.href === location.hash,
  render() { renders++; },
  pendingRenderHash: ""
});
vm.runInContext(source.slice(start, end), context);
function dispatch(type, href, options = {}) {
  const event = {
    target: { href, matches: () => true, closest: () => null },
    button: 0, defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; },
    stopPropagation() {}, ...options
  };
  for (const handler of handlers.get(type) || []) handler(event);
  return event;
}
dispatch("pointerdown", "#/imprint");
dispatch("touchstart", "#/imprint");
assert.equal(pendingIndicators, 0, "Touching a link while scrolling must not start a loading state");
dispatch("click", "#/imprint");
assert.equal(location.hash, "#/imprint");
context.pendingRenderHash = "#/imprint";
for (let index = 0; index < 5; index++) dispatch("click", "#/imprint");
assert.equal(renders, 0, "Repeated taps must not restart an in-flight page load");
context.pendingRenderHash = "";
dispatch("click", "#/imprint");
assert.equal(renders, 1, "Retry must work after loading has finished or failed");
dispatch("click", "#/privacy", { defaultPrevented: true });
assert.equal(location.hash, "#/imprint", "Cookie settings handlers must retain control of their click");
dispatch("click", "#/privacy", { ctrlKey: true });
assert.equal(location.hash, "#/imprint", "Modified clicks must retain browser behavior");
dispatch("click", "#/privacy");
assert.equal(location.hash, "#/privacy", "A different destination must remain accessible");
console.log("Public navigation regression checks passed.");
