const fs = require("node:fs/promises");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || "playwright");
(async () => {
  const calls = [];
  const context = vm.createContext({
    getFirebaseServices: async () => ({ functions: {}, functionsLib: { httpsCallable: (_functions, name) => async data => {
      calls.push({ name, data });
      return { data: { canResetContactRequests: true, participants: [{ contactId: "person", online: false }], profile: { contactId: "person" } } };
    } } })
  });
  vm.runInContext((await fs.readFile("src/firebase/eventLiveService.js", "utf8")).replace(/^import .*;\r?\n/gm, "").replaceAll("export ", ""), context);
  await vm.runInContext('setEventLiveTestContext("event", "person", true); getEventLiveData("event")', context);
  assert.equal(calls[0].data.adminTestContactId, "person");
  const data = await vm.runInContext('getEventLiveData("event")', context);
  assert.equal(data.participants[0].testOnline, true);
  await assert.rejects(vm.runInContext('updateEventLiveProfile("event", {firstName:"Wrong"})', context), /Testmodus beenden/);
  await vm.runInContext('getEventLiveData("other-event")', context);
  assert.equal(calls.at(-1).data.adminTestContactId, undefined);
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PDTV_BROWSER_PATH });
  try {
    for (const width of [320, 390, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 844 } });
      await page.setContent('<main id="root"><section class="event-live-requests"><details class="event-live-admin-menu" open><summary>Administration</summary><div class="event-live-admin-actions"></div></details></section><div class="event-live-roster"></div></main>');
      await page.addStyleTag({ content: await fs.readFile("src/styles/main.css", "utf8") });
      await page.addScriptTag({ content: (await fs.readFile("src/utils/eventLiveTestControls.js", "utf8")).replace("export function", "function") });
      await page.evaluate(() => {
        window.changes = [];
        mountEventLiveTestControls(document.querySelector(".event-live-admin-actions"), document.querySelector("#root"),
          { participants: [{ contactId: "person", displayName: "Test Person" }] }, async (...args) => { window.changes.push(args); });
      });
      page.once("dialog", dialog => dialog.dismiss());
      await page.getByLabel("Als Teilnehmer testen").selectOption("person");
      assert.equal(await page.getByLabel("Als Teilnehmer testen").inputValue(), "");
      page.once("dialog", dialog => dialog.accept());
      await page.getByLabel("Als Teilnehmer testen").selectOption("person");
      await page.waitForFunction(() => window.changes.length === 1);
      assert.equal(await page.getByText(/Admin-Test als Test Person/).isVisible(), true);
      await page.getByText("Administration", { exact: true }).click();
      await page.getByLabel("Alle als Online anzeigen (Test)", { exact: true }).check();
      await page.getByRole("button", { name: "Testmodus beenden" }).click();
      await page.waitForFunction(() => window.changes.length === 3);
      assert.deepEqual(await page.evaluate(() => window.changes.at(-1)), ["", false]);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.close();
    }
  } finally { await browser.close(); }
  console.log("Test controls: confirmation/cancel, switching, stop, simulated presence, context isolation and blocked profile writes passed.");
})().catch(error => { console.error(error); process.exitCode = 1; });
