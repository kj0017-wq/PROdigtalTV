const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || "playwright");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");
(async () => {
  const tabs = await fs.readFile("src/utils/eventLivePersonTabs.js", "utf8");
  const chat = await fs.readFile("src/utils/eventLiveChat.js", "utf8");
  const css = await fs.readFile("src/styles/main.css", "utf8");
  const logo = "data:image/png;base64," + (await fs.readFile("public/assets/official/brand/prodigitaltv-logo-claim.png")).toString("base64");
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PDTV_BROWSER_PATH });
  try {
    for (const width of [320, 390, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 844 } });
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><aside data-live-detail-layer class="event-live-detail-layer"><section class="event-live-detail" id="person"><button data-live-detail-close class="event-live-back" aria-label="Zurueck">←</button><div class="event-live-detail__avatar">AB</div><h2>Anna Beispiel</h2><p class="event-live-detail__position">Vorstand · Unternehmen</p><div class="event-live-detail__contact"><button>Kontaktdaten anfragen</button></div><section><h3>Vita</h3><p>Eine kurze Vita.</p></section></section></aside>');
      await page.addStyleTag({ content: css });
      await page.evaluate(({ tabs, chat, logo }) => {
        const image = document.createElement("img");
        image.className = "event-live-company-logo";
        image.src = logo;
        document.querySelector("#person").append(image);
        window.messages = [{ id: "00000000-00000001", text: "Hallo", self: false, createdAt: new Date().toISOString() }];
        window.receipts = [];
        const mock = {
          escapeHtml: value => String(value).replaceAll("<", "&lt;"),
          getEventLiveMessages: async () => ({ messages, hasMore: false }),
          markEventLiveMessagesRead: async (_, __, id) => receipts.push(id),
          getEventLiveData: async () => ({ profile: { contactId: "own" }, requests: [] }),
          sendEventLiveMessage: async () => ({}), deleteEventLiveMessage: async () => ({}),
          respondEventLiveContact: async () => ({})
        };
        const mountChat = new Function(...Object.keys(mock), chat.replace(/^import .*;\r?\n/gm, "").replaceAll("export function", "function") + ";return mountEventLiveChat;")(...Object.values(mock));
        const mountTabs = new Function(tabs.replaceAll("export function", "function") + ";return mountEventLivePersonTabs;")();
        mountTabs(document.querySelector("#person"), { title: "Dr.", displayName: "Anna Beispiel", website: "https://example.org" }, {
          mountChat: panel => mountChat(panel, "event", "peer", "Anna Beispiel", { embedded: true, viewerId: "own" })
        });
      }, { tabs, chat, logo });
      assert.deepEqual(await page.getByRole("tab").allTextContents(), ["Event Chat", "Profil", "Vita"]);
      assert.equal(await page.locator('[data-person-tab="chat"]').getAttribute("aria-selected"), "true");
      await page.waitForFunction(() => receipts.length === 1);
      await page.getByRole("tab", { name: "Profil", exact: true }).click();
      assert.equal(await page.locator(".event-live-chat").count(), 1);
      assert.equal(await page.locator(".event-live-person-website").getAttribute("href"), "https://example.org/");
      const image = page.locator('[data-person-panel="profile"] .event-live-company-logo');
      await image.evaluate(img => img.decode());
      const imageBox = await image.boundingBox();
      const nameBox = await page.locator('[data-person-panel="profile"] .event-live-person-identity__text').boundingBox();
      assert.ok(imageBox.x >= nameBox.x + nameBox.width);
      assert.ok(imageBox.height >= nameBox.height - 1);
      await page.screenshot({ path: path.join(os.tmpdir(), "pdtv-person-profile-" + width + ".png") });
      await page.getByRole("tab", { name: "Vita", exact: true }).click();
      assert.equal(await page.locator('[data-person-panel="vita"] h2').textContent(), "Anna Beispiel");
      assert.match(await page.locator('[data-person-panel="vita"]').innerText(), /Anna Beispiel\s+Vita\s+Eine kurze Vita\./);
      await page.getByRole("tab", { name: "Event Chat", exact: true }).click();
      await page.waitForFunction(() => receipts.length === 1);
      await page.locator("textarea").fill("Entwurf bleibt erhalten");
      await page.screenshot({ path: path.join(os.tmpdir(), "pdtv-person-chat-" + width + ".png") });
      const field = await page.locator("textarea").boundingBox();
      assert.ok(field.y + field.height <= 844 && field.x + field.width <= width);
      await page.getByRole("tab", { name: "Profil", exact: true }).click();
      await page.evaluate(() => messages.push({ id: "00000000-00000002", text: "Noch eine Nachricht", self: false, createdAt: new Date().toISOString() }));
      await page.waitForTimeout(2200);
      assert.equal(await page.evaluate(() => receipts.length), 1, "Hidden chat must not mark new messages read");
      await page.getByRole("tab", { name: "Event Chat", exact: true }).click();
      await page.waitForFunction(() => receipts.includes("00000000-00000002"));
      assert.equal(await page.locator("textarea").inputValue(), "Entwurf bleibt erhalten");
      assert.equal(await page.locator(".event-live-chat").count(), 1);
      assert.deepEqual(errors, []);
      await page.evaluate(tabs => {
        document.querySelector("[data-live-detail-layer]").innerHTML = '<section class="event-live-detail event-live-detail--own" id="own"><button class="event-live-back" data-live-detail-close>Zurueck</button><details class="event-live-profile-editor"><summary>Profil bearbeiten</summary><form><label>Vorname<input name="firstName" value="Klaus"></label><label>Kurzvita<textarea name="biography">Meine Vita</textarea></label><button type="submit">Profil speichern</button></form></details><div class="event-live-own-media"><div class="event-live-detail__avatar">KJ</div></div><h2>Klaus Juli</h2><section><h3>Vita</h3><p>Meine Vita</p></section></section>';
        const mount = new Function(tabs.replaceAll("export function", "function") + ";return mountEventLivePersonTabs;")();
        mount(document.querySelector("#own"), { self: true, displayName: "Klaus Juli" });
      }, tabs);
      assert.equal(await page.locator('[data-person-tab="profile"]').getAttribute("aria-selected"), "true");
      await page.locator(".event-live-profile-editor summary").click();
      assert.equal(await page.getByLabel("Vorname", { exact: true }).isVisible(), true);
      assert.equal(await page.getByRole("button", { name: "Profil speichern" }).isVisible(), true);
      await page.locator('textarea[name="biography"]').fill("Bearbeitete Vita");
      await page.screenshot({ path: path.join(os.tmpdir(), "pdtv-own-editor-" + width + ".png") });
      await page.getByRole("tab", { name: "Vita", exact: true }).click();
      await page.getByRole("tab", { name: "Profil", exact: true }).click();
      assert.equal(await page.locator('textarea[name="biography"]').inputValue(), "Bearbeitete Vita");
      await page.locator(".event-live-profile-editor summary").click();
      assert.equal(await page.locator('[data-person-panel="profile"] h2').isVisible(), true);
      await page.close();
    }
  } finally { await browser.close(); }
  console.log("Person tabs: mobile/desktop, profile, vita, chat, hidden read guard and preserved draft passed.");
})().catch(error => { console.error(error); process.exitCode = 1; });
