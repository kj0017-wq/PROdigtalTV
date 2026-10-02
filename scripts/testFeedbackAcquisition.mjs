import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { filterFeedback, feedbackFilterOptions, isAcquisitionFilter } from "../src/utils/feedbackAcquisition.js";
import { acquisitionCsv } from "../src/utils/csv.js";
import { escapeHtml } from "../src/utils/format.js";

const records = [
  { id: "a", eventId: "event", guestName: "=FORMULA", guestEmail: "test@example.test", followUpStatus: "personal_membership_interest", contactConsent: "Ja" },
  { id: "b", eventId: "event", followUpStatus: "corporate_membership_interest", contactConsent: "Nein", manualStatus: "kontaktiert" },
  { id: "c", eventId: "other", followUpStatus: "send_information_and_follow_up" },
  { id: "d", eventId: "event", followUpStatus: "no_membership_follow_up" },
  { id: "e", eventId: "event", followUpStatus: "keep_as_event_contact" }
];
const options = feedbackFilterOptions(new URLSearchParams("followUpStatus=acquisition&eventId=event"));
assert.deepEqual(filterFeedback(records, options).map(item => item.id), ["a", "b"]);
assert.deepEqual(filterFeedback(records, { ...options, contactConsent: "Ja", manualStatus: "offen" }).map(item => item.id), ["a"]);
assert.deepEqual(filterFeedback(records, { followUpStatus: "acquisition", contactConsent: "unknown" }).map(item => item.id), ["c"]);
assert.deepEqual(filterFeedback(records, { followUpStatus: "corporate_membership_interest" }).map(item => item.id), ["b"]);
assert.equal(isAcquisitionFilter("no_membership_follow_up"), false);
const csv = acquisitionCsv([{ id: "event", title: "Test Event" }], filterFeedback(records, options));
assert.ok(csv.includes("Einzelmitgliedschaft") && csv.includes("Firmenmitgliedschaft"));
assert.ok(csv.includes("'="));
assert.ok(csv.includes('"Nein"') && csv.includes('"offen"'));

const source = await readFile("src/cms/cmsPages.js", "utf8");
const start = source.indexOf("function eventFeedbackQuestionEditor(");
const end = source.indexOf("function eventFeedbackPreviewMarkup(", start);
const questionEditor = new Function("escapeHtml", source.slice(start, end) + ";return eventFeedbackQuestionEditor;")(escapeHtml);
const question = { id: "test", title: "Wie relevant war die Veranstaltung fuer Sie und Ihr Unternehmen?", commentPrompt: "Was war fuer Sie besonders relevant und welche weiteren Themen wuenschen Sie sich?", options: ["Sehr relevant", "Teilweise relevant"] };
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || "playwright");
const browser = await chromium.launch({ headless: true, executablePath: process.env.PDTV_BROWSER_PATH });
try {
  for (const width of [390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.setContent('<main><form class="form-grid event-survey-editor event-feedback-editor"><div class="event-survey-drafts">' + questionEditor(question, 0) + '</div></form></main>');
    await page.addStyleTag({ content: await readFile("src/styles/main.css", "utf8") });
    for (const selector of ["[data-event-feedback-title]", "[data-event-feedback-comment]"]) {
      assert.equal(await page.locator(selector).evaluate(el => el.tagName), "TEXTAREA");
      assert.equal(await page.locator(selector).evaluate(el => el.clientHeight >= 80), true);
      await page.locator(selector).fill("Mehrzeilige Frage\nZweite Zeile");
      assert.equal(await page.locator(selector).inputValue(), "Mehrzeilige Frage\nZweite Zeile");
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: join(tmpdir(), `pdtv-feedback-editor-${width}.png`) });
    await page.close();
  }
} finally { await browser.close(); }
console.log("Acquisition filters, CSV and multiline editor desktop/mobile passed.");
