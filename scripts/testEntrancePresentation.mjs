import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyEntrancePresentation } from "../src/utils/entrancePresentation.js";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || "C:/Users/kj/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const browser = await chromium.launch({ executablePath: process.env.PDTV_BROWSER_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
try {
  const page = await browser.newPage();
  const css = await readFile(new URL("../src/styles/main.css", import.meta.url), "utf8");
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 850 });
    await page.setContent(`<style>${css}</style><div id="app"><div class="pdtv-mobile-shell"><main class="page"><section class="section container"><h1>HEUKING</h1><form class="form-card login-card" data-entrance-link><label>E-Mail-Adresse Ihrer Anmeldung<input type="email" required></label><button class="button button--primary">Handy verknüpfen und einchecken</button></form></section></main><nav class="bottom-nav">App-Navigation</nav></div></div>`);
    await page.addScriptTag({ content: `window.applyEntrancePresentation = ${applyEntrancePresentation.toString()};` });
    const apply = mode => page.evaluate(mode => {
      const env = { location: { hash: "#/event-checkin/heuking?access=test" }, navigator: { standalone: mode === "ios" }, matchMedia: query => ({ matches: mode === "standalone" && query.includes("standalone") }) };
      window.applyEntrancePresentation(document.querySelector("#app"), env);
    }, mode);
    await apply("browser");
    await apply("browser");
    assert.equal(await page.locator("[data-entrance-browser-hint]").count(), 1);
    assert.equal(await page.locator("[data-entrance-browser-hint] a").getAttribute("href"), "/#/event/heuking");
    assert.equal(await page.locator("[data-entrance-browser-hint] a").textContent(), "Event-Seite öffnen");
    assert.equal(await page.locator("[data-entrance-browser-hint] summary").count(), 2);
    await page.getByText("Bereits installiert", { exact: true }).click();
    await page.getByText("Noch nicht installiert", { exact: true }).click();
    assert.equal(await page.locator("[data-entrance-browser-hint] details[open]").count(), 2);
    assert.equal(await page.locator(".bottom-nav").isVisible(), false);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: join(tmpdir(), `pdtv-entrance-browser-${width}.png`) });
    for (const mode of ["ios", "standalone"]) {
      await apply(mode);
      assert.equal(await page.locator("[data-entrance-browser-hint]").count(), 0);
      assert.equal(await page.locator("[data-entrance-mode=app]").count(), 1);
    }
    await page.screenshot({ path: join(tmpdir(), `pdtv-entrance-app-${width}.png`) });
  }
  await page.evaluate(() => {
    const root = document.querySelector("#app");
    root.innerHTML = '<div class="pdtv-mobile-shell"><main class="page"></main></div>';
    window.applyEntrancePresentation(root, { location: { hash: "#/event-checkin-screen/heuking" } });
  });
  assert.equal(await page.locator("[data-entrance-mode]").count(), 0, "Reception screen must stay unchanged");
  console.log("Browser, iOS standalone, display-mode standalone, repeated renders and reception screen passed.");
} finally { await browser.close(); }
