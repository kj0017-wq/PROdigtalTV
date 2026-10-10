import test from "node:test";
import assert from "node:assert/strict";
import { reorderModerationCards } from "../src/utils/moderationCardPrint.js";
const cards = [{ id: "a", selected: true, notes: "Keep me" }, { id: "b", selected: false }, { id: "c", selected: true }];
test("move down before or after target with checkbox state and content intact", () => {
  assert.deepEqual(reorderModerationCards(cards, "a", "c").map(card => card.id), ["b", "a", "c"]);
  const result = reorderModerationCards(cards, "a", "c", true);
  assert.deepEqual(result.map(card => card.id), ["b", "c", "a"]);
  assert.equal(result[2], cards[0]);
  assert.deepEqual(cards.map(card => card.id), ["a", "b", "c"]);
});
test("move upward and ignore self or nonexistent targets", () => {
  assert.deepEqual(reorderModerationCards(cards, "c", "a").map(card => card.id), ["c", "a", "b"]);
  assert.equal(reorderModerationCards(cards, "a", "a"), cards);
  assert.equal(reorderModerationCards(cards, "a", "missing"), cards);
});
