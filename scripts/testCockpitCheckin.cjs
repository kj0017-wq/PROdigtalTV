const fs = require("node:fs/promises");
const assert = require("node:assert/strict");
const path = require("node:path");
const os = require("node:os");
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || "playwright");
(async () => {
  const source = (await fs.readFile("src/utils/cockpitCheckin.js", "utf8")).replace(/^import .*;\r?\n/gm, "").replace(/export /g, "");
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PDTV_BROWSER_PATH });
  try {
    for (const width of [320, 390, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 844 } });
      await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><select id="event"><option value="a">HEUKING</option><option value="b">Anderes Event</option></select><details open id="panel"><summary>Person einchecken</summary><input aria-label="Suche" data-cockpit-checkin-search><button data-cockpit-checkin-refresh>Aktualisieren</button><p role="status" data-cockpit-checkin-status></p><div data-cockpit-checkin-list></div></details>');
      await page.addStyleTag({ content: await fs.readFile("src/styles/main.css", "utf8") });
      await page.evaluate(source => {
        window.calls = [];
        window.allow = true;
        const records = [
          { id: "one", eventId: "a", firstName: "Anna", lastName: "Beispiel", email: "anna@example.test", status: "confirmed" },
          { id: "two", eventId: "a", firstName: "Ben", lastName: "Test", status: "checked_in" },
          { id: "gone", eventId: "a", firstName: "Storniert", status: "cancelled" },
          { id: "other", eventId: "b", firstName: "Carla", status: "confirmed" }
        ];
        const wire = new Function("escapeHtml", source + ";return wireCockpitCheckin;")(value => String(value).replaceAll("<", "&lt;").replaceAll('"', "&quot;"));
        wire(document.querySelector("#panel"), {
          eventSelect: document.querySelector("#event"), load: async () => records.map(item => ({ ...item })),
          confirm: () => allow,
          checkIn: async (eventId, ids) => { calls.push({ eventId, ids }); records.find(item => item.id === ids[0]).status = "checked_in"; return { checkedInCount: 1 }; },
          onChanged: async () => {}
        });
      }, source);
      await page.waitForSelector('[data-cockpit-checkin-id="one"]');
      assert.equal(await page.locator(".cockpit-checkin-row").count(), 2);
      await page.getByLabel("Suche").fill("anna@");
      assert.equal(await page.locator(".cockpit-checkin-row").count(), 1);
      await page.evaluate(() => { allow = false; });
      await page.getByRole("button", { name: "Einchecken", exact: true }).click();
      assert.equal(await page.evaluate(() => calls.length), 0);
      await page.evaluate(() => { allow = true; });
      await page.getByRole("button", { name: "Einchecken", exact: true }).click();
      await page.getByText("Anna Beispiel ist eingecheckt.", { exact: true }).waitFor();
      assert.deepEqual(await page.evaluate(() => calls), [{ eventId: "a", ids: ["one"] }]);
      assert.equal(await page.locator("[data-cockpit-checkin-id]").count(), 0);
      await page.getByLabel("Suche").fill("");
      await page.screenshot({ path: path.join(os.tmpdir(), "pdtv-cockpit-checkin-" + width + ".png") });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.locator("#event").selectOption("b");
      await page.waitForSelector('[data-cockpit-checkin-id="other"]');
      assert.equal(await page.locator(".cockpit-checkin-row").count(), 1);
      await page.getByRole("button", { name: "Einchecken", exact: true }).click();
      await page.getByText("Carla ist eingecheckt.", { exact: true }).waitFor();
      assert.deepEqual(await page.evaluate(() => calls[1]), { eventId: "b", ids: ["other"] });
      await page.close();
    }
  } finally { await browser.close(); }
  console.log("Cockpit check-in: search, cancellation, one registration, event isolation, status and responsive layout passed.");
})().catch(error => { console.error(error); process.exitCode = 1; });
