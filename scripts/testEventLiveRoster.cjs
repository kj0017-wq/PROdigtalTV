const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({headless:true, executablePath:process.env.PDTV_BROWSER_PATH});
  try {
    for (const width of [390, 1280]) {
      const page = await browser.newPage({viewport:{width,height:844}});
      let imageRequests = 0;
      await page.route('https://storage.googleapis.com/**', route => { imageRequests++; return route.fulfill({contentType:'image/gif',body:Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64')}); });
      await page.setContent('<main id="roster"></main>');
      const source = await fs.readFile('src/utils/eventLiveRoster.js','utf8');
      await page.evaluate(source => {
        window.updateRoster = new Function(source.replace('export function','function') + '; return updateEventLiveRoster;')();
        window.card = (id, signature, text, file=id) => `<button data-live-person="${id}" class="event-live-person"><span class="avatar"><img src="https://storage.googleapis.com/bucket/${file}.jpg?Expires=9999999999&Signature=${signature}"></span><span class="copy"><strong>${id}</strong><small>${text}</small><img class="logo" src="https://storage.googleapis.com/bucket/logo.jpg?Signature=${signature}"></span></button>`;
        window.renderRoster = cards => updateRoster(document.querySelector('#roster'), `<div class="event-live-participants" data-event-live-mode="classic">${cards}</div>`);
        renderRoster(card('own','a','Profil') + card('peer','a','Alt'));
      }, source);
      await page.waitForFunction(() => [...document.images].every(img => img.complete && img.naturalWidth));
      const count = imageRequests;
      const result = await page.evaluate(() => {
        const peer = document.querySelector('[data-live-person="peer"]');
        const portrait = peer.querySelector('img');
        const logo = peer.querySelector('.logo');
        peer.dataset.livePersonBound = '1';
        window.clicks = 0;
        peer.addEventListener('click', () => clicks++);
        for(let i=0;i<10;i++) renderRoster(card('own',String(i),'Profil')+card('peer',String(i),'Neu'));
        renderRoster(card('peer','new','Ganz neu')+card('own','new','Profil'));
        peer.click();
        return {sameCard:peer===document.querySelector('[data-live-person="peer"]'),sameImage:portrait===peer.querySelector('img'),sameLogo:logo===peer.querySelector('.logo'),src:portrait.src,bound:peer.dataset.livePersonBound,clicks,first:document.querySelector('[data-live-person]').dataset.livePerson,text:peer.querySelector('small').textContent};
      });
      assert.equal(result.sameCard,true); assert.equal(result.sameImage,true); assert.equal(result.sameLogo,true);
      assert.equal(result.bound,'1'); assert.equal(result.clicks,1); assert.equal(result.first,'peer'); assert.equal(result.text,'Ganz neu');
      assert.ok(result.src.endsWith('Signature=a'));
      assert.equal(imageRequests,count,'Repeated polling and reorder must not reload portraits');
      await page.evaluate(() => renderRoster(card('peer','new','Neues Foto','changed')));
      await page.waitForFunction(() => document.querySelector('.avatar img').src.includes('changed.jpg') && document.querySelector('.avatar img').complete);
      assert.equal(await page.locator('[data-live-person]').count(),1);
      await page.evaluate(() => renderRoster('<p>Keine Personen</p>'));
      assert.equal(await page.locator('[data-live-person]').count(),0);
      await page.evaluate(() => renderRoster(card('own','fresh','Zurueck')));
      assert.equal(await page.locator('[data-live-person]').count(),1);
      await page.close();
    }
    console.log('Roster tests passed: stable images/cards/listeners, renewed signatures, reordering, real photo changes and empty states on mobile/desktop.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
