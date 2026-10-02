const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeGermanSpeechText } = require("./voiceTextNormalizer");

test("normalizes dates, times, money and percentages", () => {
  const result = normalizeGermanSpeechText("Am 09.12.2026 um 18:30 Uhr präsentiert PROdigitalTV die Ergebnisse für 2026. Der Umsatz steigt um 3,5 % auf 2,5 Mio. €.");
  assert.match(result, /neunter Dezember zweitausendsechsundzwanzig/);
  assert.match(result, /achtzehn Uhr dreißig/);
  assert.match(result, /zweitausendsechsundzwanzig/);
  assert.match(result, /drei Komma fünf Prozent/);
  assert.match(result, /zweieinhalb Millionen Euro/);
  assert.match(result, /Pro Digital T V/);
});

test("normalizes technical terms and keeps HTML content", () => {
  const result = normalizeGermanSpeechText("<p>Das Video wird in 4K mit 50 fps übertragen.</p><p>Die Datenrate beträgt 100 Mbit/s.</p>");
  assert.equal(result, "Das Video wird in vier K mit fünfzig Frames pro Sekunde übertragen. Die Datenrate beträgt hundert Megabit pro Sekunde.");
});

test("normalizes textual dates and screen resolutions", () => {
  assert.equal(normalizeGermanSpeechText("Am 7.September wird die 1080p-Version veröffentlicht."), "Am siebter September wird die tausendachtzig P-Version veröffentlicht.");
});

test("decodes numeric HTML space entities", () => {
  assert.equal(normalizeGermanSpeechText("2026&#x20;investiert"), "zweitausendsechsundzwanzig investiert");
});

test("does not mutate the source value and supports debug output", () => {
  const source = "Im Jahr 2026 investieren Unternehmen 2,5 Mio. € in KI.";
  const result = normalizeGermanSpeechText(source, { debug: true });
  assert.equal(source, "Im Jahr 2026 investieren Unternehmen 2,5 Mio. € in KI.");
  assert.match(result.text, /zweitausendsechsundzwanzig/);
  assert.ok(result.steps.some((step) => step.name === "money"));
});
