import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const functionsSource = await readFile(new URL("../functions/index.js", import.meta.url), "utf8");

test("automatische Gästebefragung wird im 15-Minuten-Lauf verarbeitet", () => {
  assert.match(functionsSource, /async function processAutomaticEventFeedback/);
  assert.match(functionsSource, /feedbackAutoSendEnabled !== true/);
  assert.match(functionsSource, /event-feedback-auto-\$\{eventRecord\.id\}/);
  assert.match(functionsSource, /await processAutomaticEventFeedback\(eventDocument, eventRecord\)/);
  assert.match(functionsSource, /feedbackAutoSentAt: FieldValue\.serverTimestamp\(\)/);
  assert.match(functionsSource, /schedule: "every 15 minutes", timeZone: "Europe\/Berlin"/);
});

test("manueller und automatischer Versand nutzen dieselbe Versandlogik", () => {
  assert.match(functionsSource, /async function queueEventFeedbackInvitationsForEvent/);
  assert.ok((functionsSource.match(/queueEventFeedbackInvitationsForEvent\(\{/g) || []).length >= 2);
  assert.match(functionsSource, /createdBy: "system"/);
});
