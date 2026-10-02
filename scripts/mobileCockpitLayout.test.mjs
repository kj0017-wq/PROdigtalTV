import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mainSource = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
const cssSource = await readFile(new URL("../src/styles/main.css", import.meta.url), "utf8");

test("mobiles Event-Cockpit verwendet einen kompakten Kachelstarter", () => {
  assert.match(mainSource, /class="mobile-cms-launcher"/);
  assert.match(mainSource, /Einlass-QR/);
  assert.match(mainSource, /Event Chat/);
  assert.match(mainSource, /Auswertung/);
  assert.match(cssSource, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
});

test("Header und Eventauswahl sind mobil verdichtet", () => {
  assert.match(mainSource, /<h1>Event-Cockpit<\/h1>/);
  assert.match(cssSource, /font-size:\s*clamp\(25px,\s*7vw,\s*34px\)/);
  assert.match(cssSource, /\.mobile-live-event-context select\s*\{\s*min-height:\s*44px/);
});
