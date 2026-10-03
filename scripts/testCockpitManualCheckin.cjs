const fs = require("node:fs/promises");
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || "playwright");
(async () => {
  const source = await fs.readFile("src/main.js", "utf8");
  const fn = source.slice(source.indexOf("function mobileGroupCheckinForm("), source.indexOf("function syncMobileGroupCheckinPanels("));
  const renderGroup = new Function("escapeHtml", fn + "; return mobileGroupCheckinForm;")(String);
  const event = { id: "test-event" };
  const person = [{ id: "person", name: "Test Person", email: "test@example.test", status: "active" }];
  const groups = '<div data-group-checkin-event-panel="test-event">' + renderGroup(event, "board", person) + renderGroup(event, "speakers", person) + "</div>";
  const start = source.indexOf('    <details class="panel mobile-live-panel mobile-live-collapsible mobile-manual-checkin"');
  const end = source.indexOf('    <details class="panel mobile-live-panel mobile-live-collapsible" id="mobile-cms-send"', start);
  const quote = String.fromCharCode(96);
  const markup = new Function("groupCheckinPanels", "cockpitPage", "return " + quote + source.slice(start, end) + quote)(groups, "checkin");
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PDTV_BROWSER_PATH });
  try {
    for (const width of [320, 390, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 844 } });
      await page.setContent('<main class="mobile-live-admin">' + markup + "</main>");
      await page.addStyleTag({ content: await fs.readFile("src/styles/main.css", "utf8") });
      assert.equal(await page.getByText("Gästeliste des Events", { exact: true }).isVisible(), false);
      assert.deepEqual(await page.locator("#mobile-cms-group-checkin summary span").allTextContents(), ["Vorstand", "Referenten"]);
      assert.equal(await page.locator(".mobile-manual-checkin .panel").count(), 0);
      for (const label of ["Vorstand", "Referenten"]) {
        await page.getByText(label, { exact: true }).click();
        const summary = page.getByText(label, { exact: true }).locator("..");
        assert.equal(await summary.evaluate(el => el.parentElement.open), true);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await page.getByText(label, { exact: true }).click();
      }
      await page.screenshot({ path: require("node:path").join(require("node:os").tmpdir(), "pdtv-manual-checkin-" + width + ".png") });
      await page.close();
    }
  } finally { await browser.close(); }
  console.log("Manual check-in function page: separate board/speakers, flat styling and responsive layout passed.");
})().catch(error => { console.error(error); process.exitCode = 1; });
