const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { createHash } = require("node:crypto");
const source = readFileSync(require("node:path").join(__dirname, "index.js"), "utf8");
const block = source.slice(source.indexOf("exports.getRegistrationConfirmationStatus"), source.indexOf("exports.adminCreateEventRegistration"));
const hashToken = (token) => createHash("sha256").update(token).digest("hex");
const token = "a".repeat(64);
class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
function endpoint(record) {
  const exports = {};
  const db = { collection: () => ({ doc: () => ({ get: async () => ({ exists: !!record, data: () => record }) }) }) };
  new Function("exports", "onCall", "region", "db", "clean", "hashToken", "HttpsError", block)(
    exports, (_, handler) => handler, "test", db, (value) => String(value || "").trim(), hashToken, HttpsError);
  return exports.getRegistrationConfirmationStatus;
}
const valid = { status: "pending_email_confirmation", registrationStatusTokenHash: hashToken(token),
  registrationStatusExpiresAt: { toMillis: () => Date.now() + 60000 }, email: "private@example.com" };
test("status is available only with the dedicated unexpired secret", async () => {
  await assert.rejects(endpoint(valid)({ data: { registrationId: "r", statusToken: "b".repeat(64) } }), { code: "permission-denied" });
  await assert.rejects(endpoint({ ...valid, registrationStatusExpiresAt: { toMillis: () => 0 } })({ data: { registrationId: "r", statusToken: token } }), { code: "permission-denied" });
  await assert.rejects(endpoint(null)({ data: { registrationId: "r", statusToken: token } }), { code: "permission-denied" });
  await assert.rejects(endpoint(valid)({ data: { registrationId: "r" } }), { code: "invalid-argument" });
});
test("phone confirmation updates the status without returning personal data or ticket tokens", async () => {
  const request = { data: { registrationId: "r", statusToken: token } };
  const pending = await endpoint(valid)(request);
  assert.equal(pending.confirmed, false);
  valid.status = "confirmed";
  const confirmed = await endpoint(valid)(request);
  assert.deepEqual(confirmed, { status: "confirmed", confirmed: true, confirmedAt: "" });
  valid.status = "checked_in";
  assert.equal((await endpoint(valid)(request)).confirmed, true);
  valid.status = "cancelled";
  assert.equal((await endpoint(valid)(request)).confirmed, false);
});
