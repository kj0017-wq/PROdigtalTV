const fs = require("node:fs/promises");
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || "playwright");
(async () => {
  const source = (await fs.readFile("src/utils/eventLiveAdminProfile.js", "utf8")).replaceAll("export function", "function");
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PDTV_BROWSER_PATH });
  try {
    for (const width of [320, 390, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 844 } });
      await page.setContent('<div class="event-live-detail" id="panel"></div>');
      await page.addStyleTag({ content: await fs.readFile("src/styles/main.css", "utf8") });
      await page.addScriptTag({ content: source });
      await page.evaluate(() => {
        window.saved = null;
        window.cropped = false;
        mountAdminProfileEditor(document.querySelector("#panel"), { firstName: "Test", lastName: "Person" }, {
          save: async profile => { window.saved = profile; return { saved: true }; },
          onSaved: async () => {},
          crop: async file => { window.cropped = true; return file; },
          upload: async () => ({ storagePath: "event-live-profiles/admin/profile-123.jpg" })
        });
      });
      await page.getByText("Profil bearbeiten", { exact: true }).click();
      assert.equal(await page.getByRole("button", { name: "Mediathek", exact: true }).count(), 0);
      const chooser = page.waitForEvent("filechooser");
      await page.getByRole("button", { name: "Profilfoto aus Mediathek auswählen und zuschneiden" }).click();
      await (await chooser).setFiles({ name: "photo.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64") });
      await page.waitForFunction(() => window.cropped);
      await page.getByLabel("Vorname", { exact: true }).fill("Updated");
      await page.getByRole("button", { name: "Profil speichern" }).click();
      await page.waitForFunction(() => window.saved);
      const saved = await page.evaluate(() => window.saved);
      assert.equal(saved.firstName, "Updated");
      assert.equal(saved.photoStoragePath, "event-live-profiles/admin/profile-123.jpg");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: require("node:path").join(require("node:os").tmpdir(), "pdtv-admin-editor-" + width + ".png") });
      await page.close();
    }
  } finally { await browser.close(); }
  console.log("Admin editor: image picker, crop callback, text/photo save and responsive layouts passed.");
})().catch(error => { console.error(error); process.exitCode = 1; });
