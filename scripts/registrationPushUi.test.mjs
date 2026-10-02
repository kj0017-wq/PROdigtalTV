import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('registration form explains iPhone Home Screen requirement before submit', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /pushSupport === "install"/);
  assert.match(main, /registrationPushInput\.disabled = true/);
  assert.match(main, /Teilen → Zum Home-Bildschirm/);
  assert.match(main, /E-Mail\/SMS funktionieren trotzdem/);
  assert.match(main, /Boolean\(values\.enablePushCommunication\) && !registrationPushInput\?\.disabled/);
});

test('push support state identifies iPhone browser separately from installed app', () => {
  const source = readFileSync(new URL('../src/firebase/pushClient.js', import.meta.url), 'utf8');
  assert.match(source, /export function browserPushSupportState/);
  assert.match(source, /ios && !\(navigator\.standalone \|\| matchMedia\("\(display-mode: standalone\)"\)\.matches\)\) return "install"/);
});
