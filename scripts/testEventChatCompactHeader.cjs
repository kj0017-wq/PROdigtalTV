const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || "playwright");
(async () => {
  const source = await fs.readFile("src/pages/eventLivePage.js", "utf8");
  const main = await fs.readFile("src/main.js", "utf8");
  const start = source.indexOf('<section class="event-live-hero">', source.indexOf("data-event-live-root"));
  const template = source.slice(start, source.indexOf("</section>", start) + 10);
  const header = new Function("data", "escapeHtml", "formatDate", "return `" + template + "`;")({
    event: { title: "Medienfrühstück bei HEUKING in München", date: "2026-10-23" }, participants: Array(10)
  }, value => value, () => "23. Oktober 2026");
  const toolbar = main.match(/inbox\.innerHTML = `([^`]+)`/)[1];
  const menu = main.match(/inbox\.insertAdjacentHTML\("beforeend", `([^`]+)`/)[1];
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PDTV_BROWSER_PATH });
  try {
    for (const width of [320, 390, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 844 } });
      await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><main class="event-live-page" data-event-live-root>' + header
        + '<section class="event-live-requests" data-live-inbox>' + toolbar + menu
        + '</section><section class="event-live-roster"><button class="event-live-person"><span class="event-live-person__avatar">KJ</span><span class="event-live-person__copy"><strong>Klaus Juli</strong><small>Mein Profil</small></span></button></section></main>');
      await page.addStyleTag({ content: await fs.readFile("src/styles/main.css", "utf8") });
      const row = await page.locator(".event-live-roster").boundingBox();
      assert.ok(row.y < 220, "First participant must begin within 220px of the page");
      assert.equal(await page.getByRole("button", { name: "Alle Anfragen zurücksetzen" }).isVisible(), false);
      assert.equal(await page.getByRole("button", { name: "Alle Chats zurücksetzen" }).isVisible(), false);
      await page.getByLabel("Administration", { exact: true }).click();
      assert.equal(await page.getByRole("button", { name: "Alle Anfragen zurücksetzen" }).isVisible(), true);
      assert.equal(await page.getByRole("button", { name: "Alle Chats zurücksetzen" }).isVisible(), true);
      const menuBox = await page.locator(".event-live-admin-actions").boundingBox();
      assert.ok(menuBox.x >= 0 && menuBox.x + menuBox.width <= width);
      await page.getByLabel("Administration", { exact: true }).click();
      const refresh = await page.getByRole("button", { name: "Personen aktualisieren" }).boundingBox();
      assert.ok(refresh.width >= 44 && refresh.height >= 44);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: path.join(os.tmpdir(), "pdtv-chat-compact-" + width + ".png") });
      await page.close();
    }
  } finally { await browser.close(); }
  console.log("Compact header: first person under 220px, accessible controls, admin menu and no overflow at 320/390/1280px.");
})().catch(error => { console.error(error); process.exitCode = 1; });
