import test from "node:test";
import assert from "node:assert/strict";
import { resetEventChatData } from "../src/utils/resetEventChatData.js";
import { eventAvatarInitials, eventAvatarMarkup } from "../src/utils/eventLiveAvatar.js";

test("event reset includes contact requests for the same event", async () => {
  const calls = [];
  const result = await resetEventChatData({
    clearEventLiveMessages: async id => { calls.push(["chats", id]); return { cleared: true }; },
    resetEventLiveContactRequests: async id => { calls.push(["contacts", id]); return { resetCount: 3 }; }
  }, "event-63");
  assert.deepEqual(calls, [["chats", "event-63"], ["contacts", "event-63"]]);
  assert.deepEqual(result, { cleared: true, resetCount: 3 });
});

test("combined server reset does not issue a second contact deletion", async () => {
  const calls = [];
  const result = await resetEventChatData({
    clearEventLiveMessages: async id => { calls.push(["combined", id]); return { cleared: true, resetCount: 4 }; },
    resetEventLiveContactRequests: async id => { calls.push(["legacy", id]); return { resetCount: 0 }; }
  }, "event-63");
  assert.deepEqual(calls, [["combined", "event-63"]]);
  assert.deepEqual(result, { cleared: true, resetCount: 4 });
});

test("partial reset failure is reported and an unconfirmed chat reset stops the sequence", async () => {
  await assert.rejects(resetEventChatData({
    clearEventLiveMessages: async () => ({ cleared: true }),
    resetEventLiveContactRequests: async () => { throw new Error("Offline"); }
  }, "event-63"), /Chatnachrichten wurden gelöscht, aber Kontaktanfragen/);
  let contacted = false;
  await assert.rejects(resetEventChatData({
    clearEventLiveMessages: async () => ({ cleared: false }),
    resetEventLiveContactRequests: async () => { contacted = true; }
  }, "event-63"), /nicht bestätigt/);
  assert.equal(contacted, false);
});

test("avatar initials use the first and last name, ignore titles, and escape HTML", () => {
  assert.equal(eventAvatarInitials("Klaus Juli"), "KJ");
  assert.equal(eventAvatarInitials("Dr. Melanie Grundmann"), "MG");
  assert.equal(eventAvatarInitials("  Hans  Peter  Müller  "), "HM");
  assert.equal(eventAvatarInitials(""), "?");
  assert.match(eventAvatarMarkup("Klaus Juli"), />KJ<\/span>$/);
  assert.match(eventAvatarMarkup("Klaus Juli", 'x" onerror="bad'), /src="x&quot; onerror=&quot;bad"/);
});
