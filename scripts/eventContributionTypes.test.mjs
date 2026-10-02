import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const cmsSource = await readFile(new URL("../src/cms/cmsPages.js", import.meta.url), "utf8");
const mainSource = await readFile(new URL("../src/main.js", import.meta.url), "utf8");

test("CMS bietet Referat, Diskussionsrunde und Interview an", () => {
  assert.match(cmsSource, /value="lecture"[^>]*>Referat/);
  assert.match(cmsSource, /value="discussion"[^>]*>Diskussionsrunde/);
  assert.match(cmsSource, /value="interview"[^>]*>Interview/);
});

test("Diskussionen und Interviews unterscheiden Moderation und Teilnehmende", () => {
  assert.match(cmsSource, /name="contributionRole"/);
  assert.match(mainSource, /moderatorIds/);
  assert.match(mainSource, /speakerRoles/);
  assert.match(mainSource, /contributionPeople/);
});

test("bestehende Personenprofile werden wiederverwendet", () => {
  assert.match(cmsSource, /Bestehendes Personenprofil verwenden/);
  assert.match(mainSource, /reusablePersonProfile/);
});
