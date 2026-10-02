const fs = require("node:fs/promises");
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || "playwright");
(async () => {
  const source = await fs.readFile("src/main.js", "utf8");
  const start = source.indexOf("function syncMobileEventChatLinks(");
  const helper = source.slice(start, source.indexOf("async function mobileLiveAdminPage()", start));
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PDTV_BROWSER_PATH });
  try {
    for (const width of [320, 390, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 844 } });
      await page.setContent('<main class="mobile-live-admin"><section class="panel mobile-live-event-context"><div class="field"><label>Veranstaltung<select id="event"><option value="event-archive-63">HEUKING</option><option value="other-event">Anderes Event</option><option value="">Keine Veranstaltung</option></select></label></div><div class="actions"><a class="button button--primary" data-mobile-event-chat-link>Event Chat öffnen</a></div></section><a data-mobile-event-chat-link>Event Chat</a></main>');
      await page.addStyleTag({ content: await fs.readFile("src/styles/main.css", "utf8") });
      await page.addScriptTag({ content: helper });
      await page.evaluate(() => {
        const select = document.querySelector("#event");
        select.addEventListener("change", () => syncMobileEventChatLinks(select.value));
        syncMobileEventChatLinks(select.value);
      });
      for (const id of ["event-archive-63", "other-event"]) {
        await page.selectOption("#event", id);
        assert.deepEqual(await page.locator("[data-mobile-event-chat-link]").evaluateAll(links => links.map(link => link.getAttribute("href"))), ["/#/event-live/" + id, "/#/event-live/" + id]);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      }
      await page.selectOption("#event", "");
      assert.equal(await page.locator("[data-mobile-event-chat-link]:visible").count(), 0);
      await page.close();
    }
  } finally { await browser.close(); }
  console.log("Cockpit chat links: selected event, switching, missing event and responsive layout passed.");
})().catch(error => { console.error(error); process.exitCode = 1; });
