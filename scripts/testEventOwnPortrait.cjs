const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({headless:true, executablePath:process.env.PDTV_BROWSER_PATH});
  try {
    for (const width of [320,390,1280]) {
      const page = await browser.newPage({viewport:{width,height:844}});
      await page.setContent('<section class="event-live-detail event-live-detail--own"><div class="event-live-own-media"><div class="event-live-detail__avatar"><img alt="Profil"></div><img class="event-live-company-logo" alt="Logo"></div></section>');
      await page.addStyleTag({content:await fs.readFile('src/styles/main.css','utf8')});
      const avatar = await page.locator('.event-live-detail__avatar').boundingBox();
      assert.equal(avatar.width,112);
      assert.equal(avatar.height,112);
      const logo = await page.locator('.event-live-company-logo').boundingBox();
      assert.ok(logo.x >= avatar.x + avatar.width + 19);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true);
      await page.close();
    }
    console.log('Own portrait passed: circular 112px frame, logo spacing, no overflow at 320/390/1280px.');
  } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode=1;});
