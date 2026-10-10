import test from "node:test";
import assert from "node:assert/strict";
import { removeSelectedModerationCards } from "../src/utils/moderationCardPrint.js";
test("checkbox selection deletes the checked card rather than the active first card", () => {
  const result = removeSelectedModerationCards([{ id: "first", selected: false }, { id: "checked", selected: true }], "first");
  assert.deepEqual(result.removedIds, ["checked"]);
  assert.deepEqual(result.remaining.map(card => card.id), ["first"]);
  assert.equal(result.activeId, "first");
});
test("multiple checked cards are removed and the editor selects a surviving card", () => {
  const result = removeSelectedModerationCards([{ id: "a", selected: true }, { id: "b", selected: false }, { id: "c", selected: true }], "a");
  assert.deepEqual(result.removedIds, ["a", "c"]);
  assert.equal(result.activeId, "b");
});
test("empty and complete selections are handled without deleting unchecked cards", () => {
  assert.deepEqual(removeSelectedModerationCards([{ id: "a", selected: false }], "a").removedIds, []);
  const result = removeSelectedModerationCards([{ id: "a", selected: true }], "a");
  assert.equal(result.remaining.length, 0);
  assert.equal(result.activeId, "");
});
