const { createServer } = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || "playwright");
const root = path.resolve(__dirname, "..");
const mockService = `
window.chatFixture = { messages: [], receipts: [], requests: [{ id: 'request1', senderContactId: 'peer', receiverContactId: 'own', senderName: 'Klaus Juli', status: 'pending' }], answers: [] };
export async function getEventLiveData() { return {profile:{contactId:'own'}, requests:window.chatFixture.requests}; }
export async function respondEventLiveContact(event, id, decision) { window.chatFixture.answers.push({id,decision}); window.chatFixture.requests.find(item => item.id === id).status = decision; }
export async function getEventLiveMessages() { return {messages: window.chatFixture.messages, hasMore:false, oldestId:window.chatFixture.messages[0]?.id || ''}; }
export async function sendEventLiveMessage(event, peer, text, id) { await new Promise(resolve => setTimeout(resolve, 700)); window.chatFixture.messages.push({id,text,self:true,read:false,createdAt:new Date().toISOString()}); }
export async function markEventLiveMessagesRead(event, peer, id) { window.chatFixture.receipts.push(id); }
export async function deleteEventLiveMessage(event, peer, id) { const item = window.chatFixture.messages.find(item => item.id === id); item.deleted = true; item.text = ''; }
`;
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;
  if (pathname === "/") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.end(`<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/styles/main.css"><main class="event-live-page"><aside class="event-live-detail-layer" data-live-detail-layer><section class="event-live-detail" id="panel"><h2>Test Person</h2><section data-chat-contact-request class="event-live-chat__contact-request"><p><strong>Klaus Juli</strong> hat um Ihre Kontaktdaten gebeten. Versenden?</p><div class="actions"><button data-live-request-answer="accepted">Ja</button><button data-live-request-answer="rejected">Nein</button></div></section></section></aside></main><script type="module">import {mountEventLiveChat} from '/src/utils/eventLiveChat.js';mountEventLiveChat(document.querySelector('#panel'),'event','peer','Test Person');window.chatReady=true;</script>`);
  }
  if (pathname === "/src/firebase/eventLiveService.js") { res.setHeader("Content-Type", "text/javascript"); return res.end(mockService); }
  if (!/^\/src\/(utils\/[^/]+\.js|styles\/main\.css)$/.test(pathname)) { res.statusCode = 404; return res.end(); }
  try {
    res.setHeader("Content-Type", pathname.endsWith(".css") ? "text/css" : "text/javascript");
    res.end(await fs.readFile(path.join(root, pathname.slice(1))));
  } catch { res.statusCode = 404; res.end(); }
});
(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PDTV_BROWSER_PATH });
  const output = path.join(os.tmpdir(), "pdtv-event-live-chat-tests");
  await fs.mkdir(output, { recursive: true });
  try {
    for (const width of [390, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 844 } });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      await page.waitForFunction(() => window.chatReady);
      assert.equal(await page.locator('[data-chat-contact-request]').isVisible(), true);
      assert.equal(await page.locator('.event-live-chat__profile [data-chat-contact-request]').count(), 0);
      assert.equal(await page.getByRole('button', {name: 'Ja', exact: true}).isVisible(), true);
      assert.equal(await page.getByRole('button', {name: 'Nein', exact: true}).isVisible(), true);
      await page.getByRole('textbox').fill('Entwurf bleibt erhalten');
      await page.getByRole('button', { name: 'Nein', exact: true }).click();
      await page.getByText('Sie haben die Kontaktanfrage abgelehnt.', {exact:true}).waitFor();
      assert.equal(await page.getByRole('textbox').inputValue(), 'Entwurf bleibt erhalten');
      await page.evaluate(() => { window.chatFixture.requests[0].status = 'pending'; });
      await page.getByRole('button', { name: 'Ja', exact: true }).waitFor({timeout:12000});
      await page.getByRole('button', { name: 'Ja', exact: true }).click();
      await page.getByText('Ihre Kontaktdaten wurden versendet.', {exact:true}).waitFor();
      assert.equal(await page.getByRole('textbox').inputValue(), 'Entwurf bleibt erhalten');
      assert.deepEqual(await page.evaluate(() => window.chatFixture.answers.map(item => item.decision)), ['rejected','accepted']);
      await page.evaluate(() => { window.chatFixture.requests = [{id:'outgoing',senderContactId:'own',receiverContactId:'peer',status:'pending'}]; });
      await page.getByText('Ihre Kontaktanfrage wartet auf eine Antwort.', {exact:true}).waitFor({timeout:12000});
      await page.evaluate(() => { window.chatFixture.requests[0].status = 'accepted'; });
      await page.getByText('Ihre Kontaktanfrage wurde angenommen. Die Kontaktkarte steht im Chat.', {exact:true}).waitFor({timeout:12000});
      assert.equal(await page.locator('[data-live-request-answer]').count(), 0);
      await page.evaluate(() => { window.chatFixture.requests = []; });
      await page.waitForFunction(() => document.querySelector('[data-chat-contact-request]').hidden, {timeout:12000});
      await page.evaluate(() => {
        const back = document.createElement('button'); back.className = 'event-live-back'; back.textContent = '←'; back.setAttribute('aria-label', 'Zur Teilnehmerliste');
        document.querySelector('.event-live-chat__header').prepend(back);
      });
      assert.equal(await page.getByRole('button', { name: 'Zur Teilnehmerliste' }).evaluate(node => getComputedStyle(node).borderRadius), '50%');
      await page.getByRole("textbox").fill("Hallo! Wollen wir uns nach dem Vortrag austauschen?");
      await page.getByRole("textbox").press("Shift+Enter");
      assert.equal(await page.getByRole("textbox").inputValue().then(value => value.endsWith('\n')), true);
      await page.getByRole("textbox").press("Enter");
      await page.getByText('Wird gesendet ...', {exact:true}).waitFor();
      assert.equal(await page.locator('.is-self [data-delivery]').count(), 0);
      await page.locator('.is-self [data-delivery="delivered"]').waitFor();
      await page.locator('.is-self[data-read="false"]').waitFor();
      assert.equal(await page.locator('[data-chat-delete]').isVisible(), false);
      await page.locator('.is-self p').click();
      assert.equal(await page.locator('[data-chat-delete]').isVisible(), true);
      assert.equal(await page.locator('[data-chat-delete] svg').count(), 1);
      await page.getByRole('textbox').click();
      assert.equal(await page.locator('[data-chat-delete]').isVisible(), false);
      assert.equal(await page.locator('.is-self [data-delivery]').getAttribute('aria-label'), 'Im Chat zugestellt');
      await page.evaluate(() => {
        window.chatFixture.messages[0].read = true;
        window.chatFixture.messages.push({ id: "incoming-00000001", text: "Gerne, bis gleich!", self: false, read: false, createdAt: new Date().toISOString() });
      });
      await page.locator('.is-self[data-read="true"]').waitFor({ timeout: 12000 });
      assert.equal(await page.locator('.is-self [data-delivery]').innerText(), '✓✓');
      assert.equal(await page.locator('.is-self [data-delivery]').evaluate(node => getComputedStyle(node).color), 'rgb(0, 116, 207)');
      await page.waitForFunction(() => window.chatFixture.receipts.includes("incoming-00000001"));
      const contactCard = await require('../functions/eventLiveContactSharing').contactCardForMessage({ contactCard: { name: 'Test Person', firstName: 'Test', lastName: 'Person', email: 'test@example.test', phone: '+49123456789' } });
      await page.evaluate(card => { window.chatFixture.messages[1].contactCard = card; }, contactCard);
      await page.locator('.event-live-chat__contact-card img').waitFor({ timeout: 12000 });
      assert.equal(await page.locator('a[download="kontakt.vcf"]').count(), 1);
      assert.ok(await page.locator('.event-live-chat__contact-card img').evaluate(img => img.complete && img.naturalWidth > 0));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
      assert.deepEqual(errors, []);
      await page.evaluate(() => {
        for (let i = 0; i < 30; i++) window.chatFixture.messages.push({ id: `history-${i}`, text: `Weitere Nachricht ${i}`, self: true, read: true, createdAt: new Date().toISOString() });
      });
      await page.waitForFunction(() => document.querySelectorAll('.event-live-chat__message').length === 32, { timeout: 12000 });
      const before = await page.getByRole('textbox').boundingBox();
      await page.locator('[data-chat-messages]').evaluate((node) => { node.scrollTop = 0; });
      const after = await page.getByRole('textbox').boundingBox();
      assert.equal(before.y, after.y, 'Composer stays fixed while messages scroll');
      assert.ok(after.y + after.height <= 844, 'Composer stays inside viewport');
      await page.getByRole('textbox').click();
      assert.equal(await page.getByRole('textbox').evaluate((node) => node === document.activeElement), true);
      await page.locator('summary').click();
      assert.equal(await page.locator('.event-live-chat__profile').getAttribute('open'), '');
      await page.locator('summary').click();
      await page.screenshot({ path: path.join(output, `chat-${width}.png`), fullPage: true });
      await page.evaluate(async () => {
        const { eventLiveInboxMarkup } = await import('/src/utils/eventLiveRequests.js');
        document.querySelector('[data-live-detail-layer]').hidden = true;
        const inbox = document.createElement('section');
        inbox.innerHTML = eventLiveInboxMarkup({ participants: [{ contactId: 'peer', displayName: 'Alexandra Mustermann Beispielunternehmen' }, { contactId: 'other', displayName: 'Thomas Beispiel' }], conversations: [{ peerId: 'peer', lastMessageAt: new Date().toISOString(), lastText: 'Vielen Dank! Wir treffen uns nach dem Vortrag im Foyer.', unread: true }, { peerId: 'other', lastMessageAt: new Date(Date.now() - 86400000).toISOString(), lastText: 'Bis morgen beim Event.', lastMessageSelf: true, lastMessageRead: true }] });
        inbox.addEventListener('click', (event) => { if (event.target.closest('[data-live-open-chat]')) window.openedChat = event.target.closest('[data-live-open-chat]').dataset.livePerson; });
        document.querySelector('main').append(inbox);
      });
      await page.locator('.event-live-conversation').first().click();
      assert.equal(await page.evaluate(() => window.openedChat), 'peer');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: path.join(output, `inbox-${width}.png`), fullPage: true });
      const pageSource = await fs.readFile(path.join(root, 'src/pages/eventLivePage.js'), 'utf8');
      const rosterSource = pageSource.slice(pageSource.indexOf('function attendeeCard('), pageSource.indexOf('export function requestsMarkup')) + pageSource.slice(pageSource.indexOf('export function participantList'), pageSource.indexOf('function attendeeDetail')).replace('export function', 'function');
      await page.evaluate(async (source) => {
        const { escapeHtml, initials } = await import('/src/utils/format.js');
        const render = new Function('escapeHtml', 'initials', source + '; return participantList;')(escapeHtml, initials);
        const data = { profile: { contactId: 'own' }, participants: [{ contactId: 'gpt', displayName: 'GPT Demo' }, { contactId: 'own', displayName: 'Klaus Juli', self: true }, { contactId: 'julia', displayName: 'Julia Gloning' }], conversations: [{ peerId: 'gpt', unread: true, lastText: 'Neue Antwort' }], requests: [{ senderContactId: 'own', receiverContactId: 'gpt', status: 'pending' }, { senderContactId: 'own', receiverContactId: 'julia', status: 'accepted' }] };
        document.querySelector('main').innerHTML = render(data);
      }, rosterSource);
      assert.equal(await page.locator('[data-live-person]').count(), 3);
      assert.equal(await page.locator('[data-live-person]').first().getAttribute('data-live-person'), 'own');
      assert.equal(await page.locator('[data-live-person="gpt"]').count(), 1);
      assert.equal(await page.locator('[data-live-person="gpt"] .event-live-person__message-status').innerText(), 'Neue Nachricht');
      assert.equal(await page.locator('[data-live-person="gpt"] .event-live-person__contact-status').innerText(), 'Kontaktdaten · Anfrage gesendet');
      assert.equal(await page.locator('[data-live-person="julia"]').getAttribute('data-live-request-state'), 'none');
      await page.screenshot({ path: path.join(output, `people-${width}.png`), fullPage: true });
      await page.evaluate(() => {
        document.querySelector('main').innerHTML = `<section class="event-live-detail event-live-detail--own"><details class="event-live-profile-editor"><summary>Profil bearbeiten</summary><form><textarea aria-label="Kurzvita">Meine Vita</textarea></form></details><div class="event-live-own-media"><div class="event-live-detail__avatar">KJ</div></div><h2>Klaus Juli</h2><section data-own-vita><h3>Vita</h3><p>Meine Vita</p></section></section>`;
      });
      assert.equal(await page.locator('[data-own-vita]').isVisible(), true);
      assert.equal(await page.getByRole('textbox', {name:'Kurzvita'}).isVisible(), false);
      await page.locator('.event-live-profile-editor summary').click();
      assert.equal(await page.getByRole('textbox', {name:'Kurzvita'}).isVisible(), true);
      assert.equal(await page.locator('[data-own-vita]').isVisible(), false);
      await page.locator('.event-live-profile-editor summary').click();
      assert.equal(await page.locator('[data-own-vita]').isVisible(), true);
      await page.evaluate(() => {
        document.querySelector('main').innerHTML = `<section class="member-portal-section"><div class="member-portal-overview"><article class="member-portal-card member-portal-card--strategy"><span>2030</span><h3>Zukunftsstrategie</h3><p>Strategie, Fahrplan und Mitgliederfragen gemeinsam bearbeiten.</p><a href="#/portal?tab=strategy">Öffnen</a></article><article class="member-portal-card member-portal-card--profile"><span>1</span><h3>Mein Profil</h3><p>Eigene Mitgliedsdaten pflegen.</p><a href="#/portal?tab=profile">Bearbeiten</a></article></div></section>`;
      });
      const cardBox = await page.locator('.member-portal-card').first().boundingBox();
      assert.ok(cardBox.height < 400, 'Profile cards must not inherit fullscreen chat height');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: path.join(output, `profile-${width}.png`), fullPage: true });
      const source = await fs.readFile(path.join(root, 'src/pages/eventLivePage.js'), 'utf8');
      const editorTemplate = source.match(/<details class="event-live-profile-editor">.*?<\/details>/)[0];
      await page.evaluate(async (template) => {
        const { escapeHtml, initials } = await import('/src/utils/format.js');
        const profile = { firstName: 'Klaus', lastName: 'Juli', displayName: 'Klaus Juli', company: 'kj Technical Consulting', companyLogo: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60"><rect width="120" height="60" fill="lightgray"/></svg>', biography: 'Vorhandene Vita', companyProfile: 'Vorhandenes Unternehmensprofil' };
        const markup = new Function('profile', 'data', 'escapeHtml', 'initials', 'return `' + template + '`')(profile, { role: 'admin' }, escapeHtml, initials);
        document.querySelector('main').innerHTML = markup;
        document.querySelector('details').open = true;
      }, editorTemplate);
      await page.locator('[name="biography"]').fill('Aktualisierte Vita');
      await page.locator('[name="companyProfile"]').fill('Aktualisiertes Unternehmen');
      for (const name of ['biography', 'companyProfile']) {
        assert.equal(await page.locator(`[name="${name}"]`).evaluate(node => getComputedStyle(node).fontWeight), '400');
      }
      const { logo, portrait } = await page.evaluate(() => ({ logo: document.querySelector('.event-live-profile-logo').getBoundingClientRect().toJSON(), portrait: document.querySelector('.event-live-profile-preview > span').getBoundingClientRect().toJSON() }));
      assert.ok(logo.x > portrait.x && Math.abs((logo.y + logo.height / 2) - (portrait.y + portrait.height / 2)) < 5, `Logo must sit right of portrait: ${JSON.stringify({ logo, portrait })}`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: path.join(output, `own-editor-${width}.png`), fullPage: true });
      await page.evaluate(async () => {
        const source = document.createElement('canvas'); source.width = 1000; source.height = 700;
        const ctx = source.getContext('2d'); ctx.fillStyle = 'red'; ctx.fillRect(0, 0, 500, 700); ctx.fillStyle = 'blue'; ctx.fillRect(500, 0, 500, 700);
        const blob = await new Promise(resolve => source.toBlob(resolve));
        const { cropProfilePhoto } = await import('/src/utils/profilePhotoCrop.js');
        window.cropResult = undefined;
        window.cropFile = new File([blob], 'test.png', { type: 'image/png' });
        cropProfilePhoto(window.cropFile).then(result => { window.cropResult = result; });
      });
      await page.locator('.profile-photo-crop canvas').waitFor();
      await page.locator('.profile-photo-crop input').fill('2');
      await page.locator('.profile-photo-crop canvas').focus();
      await page.keyboard.press('ArrowRight');
      assert.equal(await page.evaluate(() => document.querySelector('.profile-photo-crop canvas').getContext('2d').getImageData(100,100,1,1).data[0]), 255);
      await page.screenshot({ path: path.join(output, `crop-${width}.png`), fullPage: true });
      await page.getByRole('button', { name: 'Übernehmen' }).click();
      await page.waitForFunction(() => window.cropResult instanceof File);
      assert.deepEqual(await page.evaluate(async () => { const bitmap = await createImageBitmap(window.cropResult); return [bitmap.width, bitmap.height]; }), [640, 640]);
      await page.evaluate(async () => { window.cropResult = undefined; const { cropProfilePhoto } = await import('/src/utils/profilePhotoCrop.js'); cropProfilePhoto(window.cropFile).then(result => { window.cropResult = result; }); });
      await page.getByRole('button', { name: 'Abbrechen' }).click();
      await page.waitForFunction(() => window.cropResult === null);
      for (const action of ['Abbrechen', 'Alle Chatnachrichten löschen', 'Escape']) {
        await page.evaluate(async () => {
          const { confirmChatReset } = await import('/src/utils/confirmChatReset.js');
          window.resetAnswer = undefined;
          confirmChatReset('HEUKING <Test>').then(answer => { window.resetAnswer = answer; });
        });
        await page.locator('.chat-reset-dialog').waitFor();
        assert.equal(await page.locator('[data-reset-event]').innerText(), 'HEUKING <Test>');
        if (action === 'Escape') await page.keyboard.press('Escape');
        else await page.getByRole('button', { name: action, exact: true }).click();
        await page.waitForFunction(() => window.resetAnswer !== undefined);
        assert.equal(await page.evaluate(() => window.resetAnswer), action === 'Alle Chatnachrichten löschen');
        assert.equal(await page.locator('.chat-reset-dialog').count(), 0);
      }
      await page.close();
    }
    console.log(`Chat browser tests passed: mobile/desktop, sending, reply, read receipt, no overflow. Screenshots: ${output}`);
  } finally { await browser.close(); server.close(); }
})().catch((error) => { console.error(error); server.close(); process.exitCode = 1; });
