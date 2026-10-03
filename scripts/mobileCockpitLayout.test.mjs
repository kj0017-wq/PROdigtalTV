import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mainSource = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
const cssSource = await readFile(new URL("../src/styles/main.css", import.meta.url), "utf8");
const cmsPagesSource = await readFile(new URL("../src/cms/cmsPages.js", import.meta.url), "utf8");

test("mobiles Event-Cockpit verwendet Funktionsseiten mit kompaktem Kachelstarter", () => {
  assert.match(mainSource, /class="mobile-cms-launcher"/);
  assert.match(mainSource, /Einlass-QR/);
  assert.match(mainSource, /data-mobile-checkin-url hidden/);
  assert.doesNotMatch(mainSource, /data-mobile-checkin-pdf-link/);
  assert.doesNotMatch(mainSource, /QR Vollbild öffnen|PDF teilen|Link kopieren/);
  assert.match(mainSource, /Event Chat/);
  assert.match(mainSource, /href="#\/cms\/live-moderation"/);
  assert.match(mainSource, /Auswertung/);
  assert.match(mainSource, /href="#\/cms\/live\/qr"/);
  assert.match(mainSource, /href="#\/cms\/live\/checkin"/);
  assert.match(mainSource, /href="#\/cms\/live\/survey"/);
  assert.match(mainSource, /href="#\/cms\/live\/guests"[^>]*>[\s\S]*?<span>Gästeliste<\/span>/);
  assert.match(mainSource, /href="#\/cms\/live\/feedback"[^>]*>[\s\S]*?<span>Gästebefragung<\/span>/);
  assert.doesNotMatch(mainSource, /data-mobile-cms-scroll="mobile-cms-person-checkin"/);
  assert.doesNotMatch(mainSource, /data-mobile-cms-scroll="mobile-cms-history"[^>]*>[\s\S]*?<span>Historie<\/span>/);
  assert.doesNotMatch(mainSource, /href="#\/cms\/quality"[^>]*>[\s\S]*?<span>Qualität<\/span>/);
  assert.match(cssSource, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
});

test("Gästebefragung besitzt eine eigene Seite mit Sofortversand", () => {
  assert.match(mainSource, /async function mobileLiveAdminPage\(section = ""\)/);
  assert.match(mainSource, /mobileLiveAdminPage\(current\.section \|\| ""\)/);
  assert.match(mainSource, /id="mobile-cms-feedback"/);
  assert.match(mainSource, /data-send-event-feedback=/);
  assert.match(mainSource, />Jetzt senden<\/button>/);
  assert.match(mainSource, /syncMobileGuestFeedbackPanels\(eventId\)/);
  assert.match(cssSource, /\.mobile-feedback-send-card/);
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
  assert.match(mainSource, /\[cockpitPage\] \|\| \["Event-Cockpit"/);
  const cockpitStart = mainSource.indexOf('return `<main class="mobile-live-admin"');
  const eventChoice = mainSource.indexOf('class="panel mobile-live-event-context"', cockpitStart);
  const hero = mainSource.indexOf('class="mobile-live-hero"', cockpitStart);
  assert.ok(eventChoice > cockpitStart && eventChoice < hero, "Die Veranstaltungsauswahl muss vor dem Cockpit-Header stehen.");
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
