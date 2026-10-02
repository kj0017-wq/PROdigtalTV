const fs = require("node:fs/promises");
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || "playwright");
(async () => {
  const source = await fs.readFile("src/utils/eventLiveChat.js", "utf8");
  const helper = source.slice(source.indexOf("export function contactDetailsMarkup"), source.indexOf("const dayFormat")).replace("export ", "");
  assert.ok(source.includes("${contactDetailsMarkup(item.contactCard)}"));
  const browser = await chromium.launch({ executablePath: process.env.PDTV_BROWSER_PATH, headless: true });
  try {
    for (const width of [320, 390, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 844 } });
      await page.setContent('<article class="event-live-chat__message"><div class="event-live-chat__contact-card"></div></article>');
      await page.addStyleTag({ content: await fs.readFile("src/styles/main.css", "utf8") });
      await page.addScriptTag({ content: 'const escapeHtml = value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");' + helper });
      await page.evaluate(() => {
        document.querySelector(".event-live-chat__contact-card").innerHTML = contactDetailsMarkup({
          email: "melanie.grundmann@example.invalid", phone: "", linkedIn: "<script>alert(1)</script>"
        });
      });
      assert.equal(await page.getByText("melanie.grundmann@example.invalid", { exact: true }).isVisible(), true);
      assert.equal(await page.getByText("Nicht angegeben", { exact: true }).isVisible(), true);
      assert.equal(await page.locator(".event-live-chat__contact-card script").count(), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: require("node:path").join(require("node:os").tmpdir(), "pdtv-contact-text-" + width + ".png") });
      await page.close();
    }
  } finally { await browser.close(); }
  console.log("Contact text: visible email, empty fields, escaping and mobile/desktop overflow checks passed.");
})().catch(error => { console.error(error); process.exitCode = 1; });
