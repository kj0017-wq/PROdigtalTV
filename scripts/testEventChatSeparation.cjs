const fs = require("node:fs/promises");
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || "playwright");
(async () => {
  const source = (await fs.readFile("src/utils/eventLivePersonTabs.js", "utf8")).replace("export function", "function");
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PDTV_BROWSER_PATH });
  try {
    for (const width of [390, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 844 } });
      await page.setContent('<main class="event-live-page"><aside class="event-live-detail-layer"><section class="event-live-detail" id="person"><button data-live-detail-close>Zurueck</button><h2>Test Person</h2><p class="event-live-detail__position">Unternehmen</p></section></aside></main>');
      await page.addStyleTag({ content: await fs.readFile("src/styles/main.css", "utf8") });
      await page.addScriptTag({ content: source });
      await page.evaluate(() => {
        window.mounted = 0;
        const open = view => {
          const panel = document.querySelector("#person");
          if (view === "chat") panel.innerHTML = '<button data-live-detail-close><span>Teilnehmer</span></button><h2>Test Person</h2>';
          mountEventLivePersonTabs(panel, { displayName: "Test Person", biography: "Test Vita" }, { view,
            onWriteMessage: () => open("chat"), mountChat: node => { mounted++; node.insertAdjacentHTML("beforeend", '<textarea aria-label="Nachricht"></textarea>'); }
          });
        };
        open("profile");
      });
      assert.deepEqual(await page.getByRole("tab").allTextContents(), ["Profil", "Vita"]);
      assert.equal(await page.evaluate(() => mounted), 0);
      assert.equal(await page.locator('[data-person-panel="chat"]').count(), 0);
      await page.getByRole("tab", { name: "Vita", exact: true }).click();
      assert.equal(await page.getByText("Test Vita", { exact: true }).isVisible(), true);
      await page.getByRole("tab", { name: "Profil", exact: true }).click();
      await page.getByRole("button", { name: "Nachricht schreiben", exact: true }).click();
      assert.equal(await page.evaluate(() => mounted), 1);
      assert.equal(await page.getByRole("tab").count(), 0);
      assert.equal(await page.locator('[data-person-panel="profile"]').count(), 0);
      assert.equal(await page.getByRole("textbox", { name: "Nachricht" }).isVisible(), true);
      assert.equal(await page.getByRole("button", { name: "Zur Chatliste" }).isVisible(), true);
      await page.close();
    }
  } finally { await browser.close(); }
  console.log("Separated profiles and chat: no chat mount/read in profile, explicit transition, single conversation passed.");
})().catch(error => { console.error(error); process.exitCode = 1; });
