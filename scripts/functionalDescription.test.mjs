import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const markdown = readFileSync(new URL("../public/docs/funktionsbeschreibung-komplett.md", import.meta.url), "utf8");
const html = readFileSync(new URL("../public/docs/funktionsbeschreibung.html", import.meta.url), "utf8");

test("Funktionsbeschreibung dokumentiert den aktuellen Event- und CMS-Stand", () => {
  for (const term of [
    "Stand: 8. Oktober 2026", "Moderationskarten", "Namensetiketten", "Gruppenchat",
    "Kontaktanfragen", "Event-Fotos", "Mailing Queue", "Rückläufer", "Gastkonten", "Buchhaltung und Mitgliedsbeiträge", "Kreditoren und Debitoren",
    "Jahresabschluss", "Moderatorenzugang", "Versandvorschau"
  ]) assert.match(markdown, new RegExp(term));
});

test("HTML-Ausgabe enthält Navigation und alle Kapitel", () => {
  const markdownChapters = [...markdown.matchAll(/^##\s+/gm)].length;
  const htmlChapters = [...html.matchAll(/<h2\s+id=/g)].length;
  const navigationLinks = [...html.matchAll(/<a href="#[^"]+">/g)].length;
  assert.equal(markdownChapters, 25);
  assert.match(html, /Stand 8\. Oktober 2026<\/footer>/);
  assert.equal(htmlChapters, markdownChapters);
  assert.equal(navigationLinks, markdownChapters);
  assert.match(html, /<meta name="viewport"/);
  assert.match(html, /@media print/);
});
