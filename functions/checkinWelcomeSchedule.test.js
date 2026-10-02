const assert = require("node:assert/strict");
const { welcomeDueAt, createWelcomeSchedule } = require("./checkinWelcomeSchedule");

assert.equal(new Date(welcomeDueAt({ date: "2026-10-23", startTime: "09:00" })).toISOString(), "2026-10-23T06:30:00.000Z");
assert.equal(new Date(welcomeDueAt({ date: "2026-11-23", startTime: "09:00" })).toISOString(), "2026-11-23T07:30:00.000Z");
assert.equal(welcomeDueAt({}), 0);
assert.equal(new Date(welcomeDueAt({ date: "2026-10-23", startTime: "09:00" }, "board_group_checkin")).toISOString(), "2026-10-23T06:45:00.000Z");
assert.equal(new Date(welcomeDueAt({ date: "2026-11-23", startTime: "09:00" }, "speakers_group_checkin")).toISOString(), "2026-11-23T07:45:00.000Z");

async function run() {
  const data = new Map();
  const snapshot = ref => ({ ref, id: ref.id, exists: data.has(ref.path), data: () => data.get(ref.path) });
  const db = {
    collection: name => ({
      doc: id => { const ref = { id, path: `${name}/${id}` }; ref.get = async () => snapshot(ref); return ref; },
      where: (key, op, value) => ({ get: async () => ({ docs: [...data].filter(([path, item]) => path.startsWith(name + "/") && item[key] === value).map(([path]) => snapshot({ path, id: path.split("/")[1] })) }) })
    }),
    runTransaction: async fn => fn({
      get: async ref => snapshot(ref),
      set: (ref, value) => data.set(ref.path, value),
      update: (ref, value) => data.set(ref.path, { ...data.get(ref.path), ...value })
    })
  };
  let now = Date.parse("2026-10-23T06:44:00Z");
  const service = createWelcomeSchedule({ db, now: () => now, FieldValue: { serverTimestamp: () => now }, Timestamp: { fromMillis: value => ({ toMillis: () => value }) } });
  const event = { date: "2026-10-23", startTime: "09:00", title: "Test" };
  data.set("events/event", event);
  data.set("registrations/person", { eventId: "event", status: "checked_in", email: "test@example.invalid" });
  const payload = { eventId: "event", registrationId: "person", dedupeKey: "test", source: "board_group_checkin" };
  const job = await service.schedule(payload);
  await service.schedule(payload);
  assert.equal([...data.keys()].filter(key => key.startsWith("checkinWelcomeJobs/")).length, 1);
  await service.process();
  assert.equal(data.has(`mailQueue/${job.id}`), false);
  now += 60000;
  await service.process();
  assert.equal(data.get(`mailQueue/${job.id}`).status, "queued");
  await service.process();
  await service.schedule(payload);
  assert.equal([...data.keys()].filter(key => key.startsWith("mailQueue/")).length, 1);
  assert.equal(data.get(job.path).status, "released");

  for (const [id, status] of [["late", "checked_in"], ["cancelled", "cancelled"], ["moved", "checked_in"]]) {
    data.set(`registrations/${id}`, { eventId: "event", status, email: "test@example.invalid" });
    const ref = await service.schedule({ ...payload, registrationId: id });
    if (id === "moved") data.set("events/event", { ...event, startTime: "10:00" });
    await service.process();
    assert.equal(data.has(`mailQueue/${ref.id}`), id === "late");
    if (id === "cancelled") assert.equal(data.get(ref.path).status, "skipped");
    if (id === "moved") {
      data.set("events/event", event);
      await service.process();
      assert.equal(data.has(`mailQueue/${ref.id}`), true);
    }
  }
  console.log("Welcome schedule: Berlin summer/winter, early/late, cancellation, reschedule and deduplication passed.");
}
run().catch(error => { console.error(error); process.exitCode = 1; });
