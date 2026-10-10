const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const source = fs.readFileSync(require("node:path").join(__dirname, "index.js"), "utf8");
const handler = source.slice(source.indexOf("exports.assignEventModerators ="), source.indexOf("exports.listMyModeratorEvents ="));
class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
function setup() {
  const writes = [];
  const context = vm.createContext({
    exports: {}, region: "test", onCall: (_, fn) => fn, HttpsError,
    clean: value => String(value || "").trim(), requireEditor: async () => ({ status: "active" }),
    FieldValue: { serverTimestamp: () => "now" },
    getAuth: () => ({ getUserByEmail: async email => ({ uid: email, disabled: false }) }),
    db: { collection: name => name === "registrations" ? {
      where: (_, __, eventId) => ({ get: async () => ({ docs: eventId === "event" ? [
        { data: () => ({ email: "guest@example.com", firstName: "Beate", lastName: "Busch", companion: { email: "companion@example.com", firstName: "Klaus", lastName: "Juli" } }) }
      ] : [] }) })
    } : { doc: () => ({ get: async () => ({ data: () => ({ status: "active" }) }), update: async data => writes.push(data) }) } }
  });
  vm.runInContext(handler, context);
  return { assign: context.exports.assignEventModerators, writes };
}
test("event guests and companions can be selected; emails are normalized and deduplicated", async () => {
  const s = setup();
  await s.assign({ data: { eventId: "event", emails: [" GUEST@example.com ", "guest@example.com", "companion@example.com"] } });
  assert.deepEqual(Array.from(s.writes[0].moderatorLoginEmails), ["guest@example.com", "companion@example.com"]);
  assert.equal(s.writes[0].moderatorName, "Beate Busch, Klaus Juli");
});
test("accounts outside the event guest list cannot receive access", async () => {
  for (const data of [{ eventId: "event", emails: ["outsider@example.com"] }, { eventId: "other-event", emails: ["guest@example.com"] }]) {
    const s = setup();
    await assert.rejects(s.assign({ data }), { code: "failed-precondition" });
    assert.equal(s.writes.length, 0);
  }
});
test("empty selection revokes existing moderator access", async () => {
  const s = setup();
  await s.assign({ data: { eventId: "event", emails: [] } });
  assert.equal(s.writes[0].moderatorUserIds.length, 0);
  assert.equal(s.writes[0].moderatorLoginEmails.length, 0);
});
