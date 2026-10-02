import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const layout = readFileSync(new URL("../src/cms/cmsLayout.js", import.meta.url), "utf8");
const pages = readFileSync(new URL("../src/cms/cmsPages.js", import.meta.url), "utf8");
const main = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");

test("Funktionsbeschreibung ist als interne CMS-Hilfeseite verlinkt", () => {
  assert.match(layout, /\["cms\/help", "Funktionsbeschreibung"\]/);
  assert.doesNotMatch(layout, /\["\/docs\/funktionsbeschreibung\.html", "Funktionsbeschreibung"\]/);
  assert.match(main, /current\.id === "help"\) return cmsHelpPage\(\)/);
});

test("CMS-Hilfeseite bettet die aktuelle Dokumentation ein", () => {
  assert.match(pages, /export async function cmsHelpPage/);
  assert.match(pages, /iframe class="cms-help-frame" src="\/docs\/funktionsbeschreibung\.html"/);
  assert.match(pages, /Stand 1\. Oktober 2026/);
});
