const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync(require.resolve("../functions/index.js"), "utf8");
const helperStart = source.indexOf("async function deleteEventLiveContactRequests");
const helperEnd = source.indexOf("\nconst { createEventChatAttachments", helperStart);
const clearStart = source.indexOf("exports.clearEventLiveMessages =");
const clearEnd = source.indexOf("\nexports.getEventLiveMessages", clearStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart && clearStart >= 0 && clearEnd > clearStart);

let admin = false;
let queried = "";
const deleted = [];
const context = {
  exports: {}, region: "test", clean: value => String(value || "").trim(),
  HttpsError: class extends Error {},
  requireAdmin: async () => { if (!admin) throw Error("denied"); },
  onCall: (_, fn) => fn,
  db: {
    collection: name => {
      assert.equal(name, "eventLiveContactRequests");
      return { where: (field, op, value) => {
        assert.equal(field, "eventId"); assert.equal(op, "=="); queried = value;
        return { get: async () => ({ docs: Array.from({ length: 405 }, (_, index) => ({ ref: `request-${index}` })) }) };
      } };
    },
    batch: () => {
      const pending = [];
      return { delete: ref => pending.push(ref), commit: async () => { assert.ok(pending.length <= 400); deleted.push(...pending); } };
    }
  }
};

vm.runInNewContext(source.slice(helperStart, helperEnd), context);

(async () => {
  const reset = context.exports.resetEventLiveContactRequests;
  await assert.rejects(() => reset({ data: { eventId: "heuking", confirmed: true } }));
  admin = true;
  await assert.rejects(() => reset({ data: { eventId: "heuking" } }));
  const resetResult = await reset({ data: { eventId: "heuking", confirmed: true } });
  assert.equal(queried, "heuking");
  assert.equal(resetResult.resetCount, 405);
  assert.equal(deleted.length, 405);

  let cleared = "";
  let marker = false;
  queried = "";
  deleted.length = 0;
  context.FieldValue = { serverTimestamp: () => 123 };
  context.db = {
    collection: name => {
      if (name === "eventLiveConversations") return { doc: id => ({ id, set: async value => { assert.equal(value.resetAt, 123); marker = true; } }) };
      assert.equal(name, "eventLiveContactRequests");
      return { where: (field, op, value) => {
        assert.equal(field, "eventId"); assert.equal(op, "=="); queried = value;
        return { get: async () => ({ docs: [{ ref: "contact-a" }, { ref: "contact-b" }] }) };
      } };
    },
    batch: () => {
      const pending = [];
      return { delete: ref => pending.push(ref), commit: async () => deleted.push(...pending) };
    },
    recursiveDelete: async ref => { cleared = ref.id; }
  };
  vm.runInNewContext(source.slice(clearStart, clearEnd), context);
  const clear = context.exports.clearEventLiveMessages;
  admin = false;
  await assert.rejects(() => clear({ data: { eventId: "heuking", confirmed: true } }));
  admin = true;
  await assert.rejects(() => clear({ data: { eventId: "heuking" } }));
  const clearResult = await clear({ data: { eventId: "heuking", confirmed: true } });
  assert.equal(clearResult.cleared, true);
  assert.equal(clearResult.resetCount, 2);
  assert.equal(cleared, "heuking");
  assert.equal(queried, "heuking");
  assert.deepEqual(deleted, ["contact-a", "contact-b"]);
  assert.equal(marker, true);
  console.log("Reset passed: chats and event-scoped contact requests are deleted together.");
})().catch(error => { console.error(error); process.exitCode = 1; });
