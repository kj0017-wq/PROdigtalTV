const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const { createContactCardReader } = require("../functions/eventLiveContactCard");
(async () => {
  let share = { eventId: "event", senderContactId: "own", receiverContactId: "peer", status: "accepted" };
  let contactReads = 0;
  const reader = createContactCardReader({
    db: { collection: collection => ({ doc: () => ({ get: async () => ({ data: () => { if (collection === "contacts") { contactReads++; return { firstName: "Test", lastName: "Person", email: "test@example.invalid" }; } return share; } }) }) }) },
    eventLiveUser: async () => ({ contactId: "own" }), eventLiveContactRequestId: () => "request", HttpsError: Error
  });
  const { card } = await reader({ data: { eventId: "event", peerId: "peer" } });
  assert.ok(card.vcard.includes("BEGIN:VCARD") && card.qrCode.startsWith("data:image/png"));
  for (const denied of [{ ...share, status: "pending" }, { ...share, status: "rejected" }, { ...share, senderContactId: "peer", receiverContactId: "own" }, { ...share, eventId: "other" }, null]) {
    share = denied;
    await assert.rejects(reader({ data: { eventId: "event", peerId: "peer" } }));
  }
  assert.equal(contactReads, 1, "Unauthorized calls must not read contacts");
  const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || "playwright");
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PDTV_BROWSER_PATH });
  try {
    for (const width of [390, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 844 } });
      await page.setContent('<meta charset="utf-8"><button id="open">Kontakt</button>');
      await page.addStyleTag({ content: await fs.readFile("src/styles/main.css", "utf8") });
      await page.evaluate(({ source, card }) => {
        const escapeHtml = value => String(value || "").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
        const firebase = { functions: {}, functionsLib: { httpsCallable: () => async () => ({ data: { card } }) } };
        const open = new Function("escapeHtml", "getFirebaseServices", source.replace(/^import .*;\r?\n/gm, "").replace("export async function", "async function") + ";return openContactOverlay;")(escapeHtml, async () => firebase);
        document.querySelector("#open").onclick = () => open("event", "peer");
      }, { source: await fs.readFile("src/utils/contactOverlay.js", "utf8"), card });
      await page.locator("#open").click();
      await page.getByText("Kontakt speichern", { exact: true }).waitFor();
      assert.equal(await page.getByText("test@example.invalid", { exact: true }).isVisible(), true);
      assert.ok((await page.getByText("Kontakt speichern").getAttribute("href")).startsWith("data:text/vcard"));
      assert.equal(await page.locator("dialog img").evaluate(img => img.complete && img.naturalWidth > 0), true);
      assert.equal(await page.locator("dialog").evaluate(el => el.scrollWidth <= el.clientWidth), true);
      await page.screenshot({ path: require("node:path").join(require("node:os").tmpdir(), `pdtv-contact-overlay-${width}.png`) });
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("dialog").count(), 0);
      await page.close();
    }
  } finally { await browser.close(); }
  console.log("Contact overlay: consent direction, pending/rejected isolation, vCard/QR, text, mobile layout and Escape passed.");
})().catch(error => { console.error(error); process.exitCode = 1; });
