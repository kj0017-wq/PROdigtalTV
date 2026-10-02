import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Event-Foto-Dialog zeigt kompakten Upload vor der Thumbnail-Galerie", () => {
  const source = readFileSync(new URL("../src/utils/eventPhotos.js", import.meta.url), "utf8");
  assert.match(source, /event-photo-dialog__upload--compact/);
  assert.match(source, /participant-photo-grid--thumbs/);
  assert.match(source, /content\.innerHTML = `\$\{uploadForm\}\$\{photoGrid\}`/);
});

test("Fotomediathek-Auswahl und Thumbnails haben eigene Größenregeln", () => {
  const css = readFileSync(new URL("../src/styles/main.css", import.meta.url), "utf8");
  assert.match(css, /input\[type="file"\]::file-selector-button\s*\{[^}]*min-height:\s*38px/s);
  assert.match(css, /participant-photo-grid--thumbs\s*\{[^}]*minmax\(130px,1fr\)/s);
  assert.match(css, /participant-photo-card\.participant-photo-card--thumb img\s*\{[^}]*height:\s*108px/s);
});
