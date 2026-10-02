import test from "node:test";
import assert from "node:assert/strict";
import { buildNameBadgePages, nameBadgeFontSize } from "../src/utils/nameBadgePrint.js";

test("start position leaves used labels empty only on the first Avery sheet", () => {
  const people = Array.from({ length: 9 }, (_, index) => ({ id: String(index), name: `Person ${index + 1}` }));
  const pages = buildNameBadgePages(people, 4);
  assert.equal(pages.length, 2);
  assert.deepEqual(pages[0].slice(0, 3), [null, null, null]);
  assert.equal(pages[0][3].name, "Person 1");
  assert.equal(pages[1][0].name, "Person 8");
});

test("each generated sheet always has the exact 2 by 5 slot count", () => {
  const pages = buildNameBadgePages(Array.from({ length: 21 }, (_, index) => ({ name: String(index) })), 1);
  assert.equal(pages.length, 3);
  pages.forEach(page => assert.equal(page.length, 10));
});

test("long names and companies receive smaller type", () => {
  assert.ok(nameBadgeFontSize("Dr. Ada Lovelace") > nameBadgeFontSize("Dr. Ada Augusta King-Noel Lovelace"));
  assert.ok(nameBadgeFontSize("Kurz GmbH", { company: true }) > nameBadgeFontSize("Eine sehr lange Unternehmensbezeichnung Gesellschaft mit beschränkter Haftung", { company: true }));
});