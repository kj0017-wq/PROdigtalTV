const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || "playwright");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const vm = require("node:vm");
const assert = require("node:assert/strict");
(async () => {
  const source = (await fs.readFile("src/pages/eventLivePage.js", "utf8"))
    .replace(/^import .*;\r?\n/gm, "").replace(/export /g, "");
  const context = vm.createContext({
    escapeHtml: value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;"),
    initials: () => "AB"
  });
  vm.runInContext(source, context);
  const logo = "data:image/png;base64," + (await fs.readFile("public/assets/official/brand/prodigitaltv-logo-claim.png")).toString("base64");
  const data = {
    profile: { contactId: "own", displayName: "Mein Profil", online: true },
    participants: [{ contactId: "peer", displayName: "Langer Teilnehmername Beispiel", position: "Geschaeftsfuehrung", company: "Beispielunternehmen", companyLogo: logo, online: true }],
    conversations: [{ peerId: "peer", unread: true, unreadCount: 3, lastText: "Eine neue Nachricht", lastMessageSelf: false }]
  };
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PDTV_BROWSER_PATH });
  try {
    for (const width of [320, 390, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 844 } });
      await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><main class="event-live-page" id="roster"></main>');
      await page.addStyleTag({ content: await fs.readFile("src/styles/main.css", "utf8") });
      await page.locator("#roster").evaluate((node, html) => { node.innerHTML = html; }, context.participantList(data));
      assert.equal(await page.locator(".event-live-unread-badge").textContent(), "3");
      assert.equal(await page.locator('[data-live-person="peer"] .event-live-presence').textContent(), "Online");
      const bounds = await page.locator(".event-live-unread-badge").boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      const image = page.locator(".event-live-person__logo");
      await image.evaluate(img => img.decode());
      const imageBox = await image.boundingBox();
      const avatarBox = await page.locator('[data-live-person="peer"] .event-live-person__avatar').boundingBox();
      assert.equal(avatarBox.width, 68);
      assert.equal(avatarBox.height, 68);
      assert.ok(imageBox.width >= (width <= 380 ? 96 : width < 600 ? 112 : 220), "Logo must have a readable dedicated width");
      const nameBox = await page.locator('[data-live-person="peer"] .event-live-person__copy').boundingBox();
      if (width > 600) {
        assert.ok(imageBox.x >= nameBox.x + nameBox.width - 1);
        assert.ok(imageBox.height >= nameBox.height - 1);
      } else {
        assert.ok(nameBox.width >= 240, "Mobile text must retain a readable full row");
        assert.ok(nameBox.y >= imageBox.y + imageBox.height);
      }
      assert.equal(await image.evaluate(img => getComputedStyle(img).objectFit), "contain");
      await page.screenshot({ path: path.join(os.tmpdir(), "pdtv-chat-badges-" + width + ".png") });
      data.conversations[0].unreadCount = 100;
      await page.locator("#roster").evaluate((node, html) => { node.innerHTML = html; }, context.participantList(data));
      assert.equal(await page.locator(".event-live-unread-badge").textContent(), "99+");
      data.conversations[0].unreadCount = 0;
      data.conversations[0].unread = false;
      await page.locator("#roster").evaluate((node, html) => { node.innerHTML = html; }, context.participantList(data));
      assert.equal(await page.locator(".event-live-unread-badge").count(), 0);
      data.conversations[0].unreadCount = 3;
      data.conversations[0].unread = true;
      await page.close();
    }
  } finally { await browser.close(); }
  console.log("Unread badges: counts, clearing, online label, 320/390/1280px passed.");
})().catch(error => { console.error(error); process.exitCode = 1; });
