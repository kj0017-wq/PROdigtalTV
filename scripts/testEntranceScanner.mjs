import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { entranceScanRoute } from "../src/utils/entranceScanner.js";
const require = createRequire(import.meta.url);
const QR = require("../functions/node_modules/qrcode");
const access = "a".repeat(64);
const url = `https://prodigitaltv.de/checkin.html?v=123#/event-checkin/heuking?access=${access}`;
const target = `#/event-checkin/heuking?access=${access}`;
assert.equal(entranceScanRoute(url, "https://prodigitaltv.de"), target);
assert.equal(entranceScanRoute(url.replace("prodigitaltv.de", "prodigitaltv-da47b.web.app"), "https://prodigitaltv.de"), target);
for (const invalid of ["javascript:alert(1)", url.replace("prodigitaltv.de", "evil.test"), url.replace("event-checkin/", "event-checkin-screen/"), url.replace(access, "invalid"), url.replace("heuking", ".."), url.replace("https://", "https://user@")]) assert.equal(entranceScanRoute(invalid, "https://prodigitaltv.de"), null);
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || "C:/Users/kj/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const browser = await chromium.launch({ executablePath: process.env.PDTV_BROWSER_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
try {
  const page = await browser.newPage();
  const css = await readFile(new URL("../src/styles/main.css", import.meta.url), "utf8");
  const source = (await readFile(new URL("../src/utils/entranceScanner.js", import.meta.url), "utf8")).replaceAll("export ", "");
  const decoder = await readFile(new URL("../public/assets/js/jsqr-1.4.0.js", import.meta.url), "utf8");
  await page.route("**/*", route => route.fulfill({ contentType: route.request().url().includes("jsqr-") ? "text/javascript" : "text/html", body: route.request().url().includes("jsqr-") ? decoder : `<style>${css}</style><div id="app"><main class="page"><h1>Events</h1></main></div>` }));
  await page.goto("https://prodigitaltv.de/#/events");
  await page.addScriptTag({ content: source });
  await page.evaluate(() => {
    navigator.mediaDevices.getUserMedia = async () => { throw new DOMException("denied", "NotAllowedError"); };
    wireEntranceScanner(document.querySelector("#app"));
    wireEntranceScanner(document.querySelector("#app"));
  });
  assert.equal(await page.locator("[data-open-entrance-scanner]").count(), 1);
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 850 });
    await page.locator("[data-open-entrance-scanner]").click();
    await page.getByText(/Kamerazugriff ist nicht erlaubt/).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: join(tmpdir(), `pdtv-scanner-${width}.png`) });
    await page.locator("[data-scan-close]").click();
    assert.equal(await page.locator("dialog").count(), 0);
  }
  await page.evaluate(() => {
    window.stopped = 0;
    navigator.mediaDevices.getUserMedia = () => new Promise(resolve => { window.resolveCamera = resolve; });
    openEntranceScanner();
  });
  await page.waitForFunction(() => Boolean(window.resolveCamera));
  await page.locator("[data-scan-close]").click();
  await page.evaluate(() => window.resolveCamera({ getTracks: () => [{ stop() { window.stopped++; } }] }));
  await page.waitForFunction(() => window.stopped === 1);
  const image = await QR.toDataURL(url, { width: 640, margin: 4 });
  await page.evaluate(async image => {
    const img = new Image(); img.src = image; await img.decode();
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 640;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    window.cameraTimer = setInterval(() => ctx.drawImage(img, 0, 0), 100);
    const stream = canvas.captureStream(10);
    window.testStream = stream;
    navigator.mediaDevices.getUserMedia = async () => stream;
    openEntranceScanner();
  }, image);
  await page.waitForFunction(target => location.hash === target, target, { timeout: 15000 });
  assert.equal(await page.locator("dialog").count(), 0);
  assert.equal(await page.evaluate(() => window.testStream.getTracks().every(track => track.readyState === "ended")), true);
  assert.equal(new URL(page.url()).origin, "https://prodigitaltv.de");
  await page.evaluate(() => clearInterval(window.cameraTimer));
  console.log("Scanner passed: real QR decoding, safe in-app navigation, mobile layout, denied camera, late permission and track cleanup.");
} finally { await browser.close(); }
