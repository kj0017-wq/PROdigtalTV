const assert = require("node:assert/strict");
const { PUBLIC_APP_BASE_URL, canonicalPublicAppUrl } = require("../functions/publicAppUrl");
assert.equal(PUBLIC_APP_BASE_URL, "https://prodigitaltv.de");
for (const host of ["prodigitaltv-da47b.web.app", "prodigitaltv.web.app", "prodigtaltv.web.app", "prodigitaltv-da47b.firebaseapp.com", "prodigitaltv.firebaseapp.com", "www.prodigitaltv.de"]) {
  assert.equal(canonicalPublicAppUrl("https://" + host + "/event/event-archive-63?v=943"), "https://prodigitaltv.de/event/event-archive-63?v=943");
  assert.equal(canonicalPublicAppUrl("https://" + host + "/checkin.html?v=1#/event-checkin/event?access=test%2Btoken"), "https://prodigitaltv.de/checkin.html?v=1#/event-checkin/event?access=test%2Btoken");
}
assert.equal(canonicalPublicAppUrl("/#/event/example"), "https://prodigitaltv.de/#/event/example");
assert.equal(canonicalPublicAppUrl("https://prodigitaltv.de/feedback.html?token=abc%2Bdef"), "https://prodigitaltv.de/feedback.html?token=abc%2Bdef");
for (const external of ["https://example.org/path?q=test", "https://prodigitaltv-da47b.web.app.example.org/", "mailto:test@example.org", ""]) {
  assert.equal(canonicalPublicAppUrl(external), external);
}
console.log("Public URLs: canonical domain, legacy hosts, token/query/hash preservation and external links passed.");
