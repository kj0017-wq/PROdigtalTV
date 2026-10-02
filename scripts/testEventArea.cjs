const fs = require("node:fs/promises");
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || "playwright");
(async () => {
  const source = (await fs.readFile("src/utils/eventArea.js", "utf8")).replace(/^import .*;\r?\n/gm, "").replaceAll("export function", "function");
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PDTV_BROWSER_PATH });
  try {
    for (const width of [390, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 844 } });
      await page.route("https://test.invalid/**", route => route.fulfill({ contentType: "text/html", body: '<main class="event-live-page"><section class="event-live-hero"><h1>Medienfrühstück bei HEUKING</h1></section><section class="event-live-requests">Kontakte</section><section class="event-live-roster"><button data-live-person="a">Test Person</button><button data-live-person="b">Andere Person</button></section><div data-event-live-data hidden></div></main>' }));
      await page.goto("https://test.invalid/#/event-live/test");
      await page.addStyleTag({ content: await fs.readFile("src/styles/main.css", "utf8") });
      await page.addScriptTag({ content: 'const escapeHtml = value => String(value || "").replaceAll("<", "&lt;").replaceAll(">", "&gt;");' + source });
      await page.evaluate(() => {
        window.data = { event: { scheduleItems: [{ time: "09:00", title: "Begrüßung", person: "Test Referent" }] }, conversations: [{ peerId: "a", unreadCount: 2 }] };
        document.querySelector("[data-event-live-data]").dataset.eventLiveData = JSON.stringify(data);
        mountEventArea(document.querySelector("main"), data);
      });
      assert.equal(await page.locator("[data-event-area-agenda]").isVisible(), true);
      assert.equal(await page.locator(".event-live-roster").isVisible(), false);
      await page.locator('[data-event-area-nav] [data-event-area="participants"]').click();
      assert.equal(await page.locator('[data-live-person="b"]').isVisible(), true);
      await page.locator('[data-event-area="chat"]').click();
      assert.equal(await page.locator('[data-live-person="b"]').isVisible(), true);
      assert.equal(await page.locator('[data-live-person="a"]').isVisible(), true);
      assert.equal(await page.locator(".event-area-badge").textContent(), "2");
      assert.equal(await page.getByRole("button", { name: "Neue Nachricht", exact: true }).count(), 0);
      assert.equal(await page.locator('[data-live-person="b"]').getAttribute("data-live-open-chat"), "1");
      await page.evaluate(() => { delete document.querySelector("main").dataset.eventArea; history.replaceState(null, "", "#/event-live/test?peer=a"); mountEventArea(document.querySelector("main"), data); });
      assert.equal(await page.locator("main").getAttribute("data-event-area"), "chat");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.locator('[data-event-area="agenda"]').click();
      await page.screenshot({ path: require("node:path").join(require("node:os").tmpdir(), `pdtv-event-area-${width}.png`) });
      await page.close();
    }
  } finally { await browser.close(); }
  console.log("Event area: agenda default, participant/chat filters, badge, deep link and mobile layout passed.");
})().catch(error => { console.error(error); process.exitCode = 1; });
