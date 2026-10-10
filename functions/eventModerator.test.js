const test = require("node:test");
const assert = require("node:assert/strict");
const { canModerate, cardsPatch } = require("./eventModerator");
test("moderator access is limited to the assigned event and active account", () => {
  assert.equal(canModerate({moderatorUserIds:["a"]}, "a", {status:"active"}), true);
  assert.equal(canModerate({moderatorUserIds:["b"]}, "a", {status:"active"}), false);
  assert.equal(canModerate({moderatorUserIds:["a"]}, "a", {status:"inactive"}), false);
  assert.equal(canModerate({moderatorUserIds:["a"]}, "a", null), false);
  assert.equal(canModerate({}, "a", {status:"active"}), false);
});
test("card writes discard changes to event content, permissions and publishing", () => {
  const card = Object.fromEntries(["id","time","speakerName","position","company","contributionRole","title","bio","description","notes"].map(key => [key, key]));
  const patch = cardsPatch({cards:[{...card, role:"admin"}], removedIds:["removed"], orientation:"landscape", moderatorUserIds:["attacker"], title:"hacked", showAgenda:false});
  assert.deepEqual(Object.keys(patch).sort(), ["moderationCardOrientation","moderationCardRemovedIds","moderationCards"].sort());
  assert.equal(patch.moderationCards[0].role, undefined);
  assert.equal(patch.moderationCardOrientation, "landscape");
  assert.throws(() => cardsPatch({cards:[{id:"bad"}]}));
  assert.throws(() => cardsPatch({cards:Array(201).fill(card)}));
});

const { moderatorCardOwner } = require("./eventModerator");
test("moderators can only address their own card set; CMS can view all", () => {
  const event = { moderatorUserIds: ["a", "b"] };
  assert.equal(moderatorCardOwner(event, "a", { role: "guest", status: "active" }), "a");
  assert.equal(moderatorCardOwner(event, "b", { role: "guest", status: "active" }), "b");
  assert.throws(() => moderatorCardOwner(event, "a", { role: "guest" }, "b"));
  assert.throws(() => moderatorCardOwner(event, "c", { role: "guest" }));
  assert.throws(() => moderatorCardOwner(event, "a", { role: "guest", status: "inactive" }));
  assert.equal(moderatorCardOwner(event, "admin", { role: "admin" }, "b"), "b");
});
