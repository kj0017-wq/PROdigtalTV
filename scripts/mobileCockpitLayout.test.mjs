import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mainSource = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
const cssSource = await readFile(new URL("../src/styles/main.css", import.meta.url), "utf8");
const cmsPagesSource = await readFile(new URL("../src/cms/cmsPages.js", import.meta.url), "utf8");

test("mobiles Event-Cockpit verwendet einen kompakten Kachelstarter", () => {
  assert.match(mainSource, /class="mobile-cms-launcher"/);
  assert.match(mainSource, /Einlass-QR/);
  assert.match(mainSource, /data-mobile-checkin-url hidden/);
  assert.doesNotMatch(mainSource, /data-mobile-checkin-pdf-link/);
  assert.doesNotMatch(mainSource, /QR Vollbild öffnen|PDF teilen|Link kopieren/);
  assert.match(mainSource, /Event Chat/);
  assert.match(mainSource, /href="#\/cms\/live-moderation"/);
  assert.match(mainSource, /Auswertung/);
  assert.match(cssSource, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
});

test("Moderationskarten sind eventbezogen als Klappkarten im Cockpit verfügbar", () => {
  assert.match(mainSource, /async function mobileModerationCardsPage/);
  assert.match(mainSource, /current\.id === "live-moderation"/);
  assert.match(mainSource, /id="mobile-cms-moderation-cards"/);
  assert.match(mainSource, /data-mobile-moderation-event-panel/);
  assert.match(mainSource, /data-mobile-moderation-open/);
  assert.match(mainSource, /buildModerationCards/);
  assert.match(mainSource, /mergeSavedModerationCards/);
  assert.match(cssSource, /\.mobile-moderation-card-list/);
  assert.match(cssSource, /\.mobile-moderation-card__body/);
  assert.doesNotMatch(mainSource, /data-mobile-cms-scroll="mobile-cms-moderation-cards"/);
});

test("Header und Eventauswahl sind mobil verdichtet", () => {
  assert.match(mainSource, /<h1>Event-Cockpit<\/h1>/);
  assert.match(cssSource, /font-size:\s*clamp\(25px,\s*7vw,\s*34px\)/);
  assert.match(cssSource, /\.mobile-live-event-context select\s*\{\s*min-height:\s*44px/);
});

test("alle Cockpit-Seiten besitzen einen Zurück-Button", () => {
  assert.ok((mainSource.match(/data-cockpit-back/g) || []).length >= 4);
  assert.match(mainSource, /Zurück zur CMS-Übersicht/);
  assert.match(mainSource, /Zurück zum Event-Cockpit/);
  assert.match(cmsPagesSource, /data-cockpit-back href="#\/cms\/live"/);
  assert.match(cssSource, /\.mobile-cockpit-back/);
});
