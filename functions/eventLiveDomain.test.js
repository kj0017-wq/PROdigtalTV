const test = require("node:test");
const assert = require("node:assert/strict");
const { eventLiveBounds, guestEventLiveIsOpen, localDateTimeMillis } = require("./eventLiveDomain");

test("event bounds follow Europe/Berlin summer time", () => {
  const { start, end } = eventLiveBounds({ date: "2026-06-10", startTime: "18:00", endTime: "21:00" });
  assert.equal(new Date(start).toISOString(), "2026-06-10T16:00:00.000Z");
  assert.equal(new Date(end).toISOString(), "2026-06-10T19:00:00.000Z");
});

test("event bounds follow Europe/Berlin winter time", () => {
  assert.equal(new Date(localDateTimeMillis("2026-12-10", "18:00")).toISOString(), "2026-12-10T17:00:00.000Z");
});

test("guest window starts two hours before and ends two hours after the event", () => {
  const event = { date: "2026-06-10", startTime: "18:00", endTime: "21:00" };
  assert.equal(guestEventLiveIsOpen(event, Date.parse("2026-06-10T13:59:59Z")), false);
  assert.equal(guestEventLiveIsOpen(event, Date.parse("2026-06-10T14:00:00Z")), true);
  assert.equal(guestEventLiveIsOpen(event, Date.parse("2026-06-10T21:00:00Z")), true);
  assert.equal(guestEventLiveIsOpen(event, Date.parse("2026-06-10T21:00:01Z")), false);
});
