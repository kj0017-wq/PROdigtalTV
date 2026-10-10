import test from "node:test";
import assert from "node:assert/strict";
import { agendaMarkup, mountEventArea } from "../src/utils/eventArea.js";
test("talk cards show time, all speakers and escaped description; pauses stay plain", () => {
  const html = agendaMarkup({ scheduleItems: [
    { topicId: "talk", isTalk: true, time: "10:00", title: "Vortrag", person: "Anna, Max", description: "Beschreibung\n\n<script>alert(1)</script>" },
    { time: "10:30", title: "Pause", person: "Pause" }
  ] });
  assert.match(html, /<details class="event-agenda-card"/);
  assert.match(html, /<summary><time>10:00<\/time>/);
  assert.match(html, /Anna, Max/);
  assert.match(html, /Beschreibung/);
  assert.equal(html.includes("<script>"), false);
  assert.equal((html.match(/<details/g) || []).length, 1);
});
test("refresh preserves open talk cards", () => {
  const card = { dataset: { agendaCard: "talk" }, open: true };
  const agenda = { querySelectorAll: () => [card], set innerHTML(value) { this.html = value; card.open = false; } };
  const nav = { querySelectorAll: () => [] };
  const root = {
    dataset: { eventArea: "agenda" },
    querySelector: (selector) => selector === "[data-event-area-nav]" ? nav : selector === "[data-event-area-agenda]" ? agenda : {},
    querySelectorAll: () => []
  };
  globalThis.location = { hash: "#/event-live/test?area=agenda" };
  mountEventArea(root, { event: { scheduleItems: [{ topicId: "talk", isTalk: true, title: "Vortrag", description: "Text" }] } });
  assert.equal(card.open, true);
});
