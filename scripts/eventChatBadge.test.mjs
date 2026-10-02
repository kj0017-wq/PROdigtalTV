import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import badge from '../deploy/personal-chat/functions/eventChatBadge.js';

test('foreground badge refreshes after reading and clears at logout; unsupported devices do not poll', async () => {
  const source = readFileSync(new URL('../src/firebase/eventChatBadge.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/, '');
  const calls = [], listeners = {};
  let count = 3;
  const firebase = { auth: { currentUser: { uid: 'user', emailVerified: true } },
    authLib: { onAuthStateChanged: (auth, callback) => { listeners.auth = callback; } },
    functionsLib: { httpsCallable: () => async () => ({ data: { count } }) } };
  vm.runInNewContext(source, {
    navigator: { setAppBadge: async value => calls.push(value), clearAppBadge: async () => calls.push(0) },
    getFirebaseServices: async () => firebase,
    document: { visibilityState: 'visible', addEventListener: (name, cb) => { listeners[name] = cb; } },
    window: { addEventListener: (name, cb) => { listeners[name] = cb; } }, setInterval: () => {}
  });
  await new Promise(resolve => setImmediate(resolve));
  await listeners.auth();
  count = 0;
  await listeners['pdtv-personal-chat-changed']();
  firebase.auth.currentUser = null;
  await listeners.auth();
  assert.deepEqual(calls, [3, 0, 0]);
  vm.runInNewContext(source, { navigator: {}, getFirebaseServices: () => { throw new Error('must not query'); }, setInterval: () => { throw new Error('must not poll'); } });
});

test('personal badge counts only incoming, unread, undeleted messages in enabled attended events', async () => {
  const rows = [
    { eventId: 'one', checkedInEventId: 'one', status: 'checked_in' },
    { eventId: 'one', checkedInEventId: 'one', status: 'checked_in' },
    { eventId: 'two', checkedInEventId: 'two', status: 'checked_in' },
    { eventId: 'disabled', checkedInEventId: 'disabled', status: 'checked_in' },
    { eventId: 'not-attending', status: 'confirmed' }
  ];
  const messages = [
    { receiverContactId: 'me', createdAt: 11 },
    { receiverContactId: 'me', createdAt: 12 },
    { receiverContactId: 'other', createdAt: 13 },
    { receiverContactId: 'me', createdAt: 14, deleted: true },
    { receiverContactId: 'me', createdAt: 10 }
  ];
  const docs = values => values.map(value => ({ data: () => value }));
  const db = { collection(name) {
    if (name === 'registrations') return { where: (field, op, email) => {
      assert.equal(email, 'me@example.test'); return { get: async () => ({ docs: docs(rows) }) };
    } };
    if (name === 'events' || name === 'eventLiveAccess') return { doc: id => ({ get: async () => ({ data: () => ({ enabled: id !== 'disabled', eventLiveEnabled: id !== 'disabled' }) }) }) };
    assert.equal(name, 'eventLiveConversations');
    return { doc: () => ({ collection: kind => {
      assert.equal(kind, 'threads'); // Never read groups.
      return { where: (field, op, id) => {
        assert.equal(id, 'me');
        return { get: async () => ({ docs: [{ data: () => ({ lastReadAt: { me: 10 } }), ref: {
          collection: () => ({ where: (field, op, since) => ({ get: async () => ({ docs: docs(messages.filter(m => m.createdAt > since)) }) }) })
        } }] }) };
      } };
    } }) };
  } };
  assert.equal(await badge.unreadPersonalMessages({ db, Timestamp: { fromMillis: n => n }, contactId: () => 'me' }, 'Me@Example.test'), 4);
});

test('push applies an absolute count, clears zero, ignores ordinary pushes and tolerates badge failures', async () => {
  const calls = [];
  const scope = { location: { origin: 'https://prodigitaltv.de' }, navigator: {
    setAppBadge: async count => calls.push(count), clearAppBadge: async () => calls.push('clear')
  } };
  vm.runInNewContext(readFileSync(new URL('../public/assets/js/push-display.js', import.meta.url), 'utf8'), { self: scope, URL });
  let shown = 0;
  const registration = { showNotification: async () => { shown++; } };
  for (const data of [{ badgeCount: '4' }, { badgeCount: '4' }, { badgeCount: '0' }, {}, { badgeCount: '-1' }]) {
    await scope.PROdigitalTVPush.show(registration, { data });
  }
  assert.deepEqual(calls, [4, 4, 'clear']);
  scope.navigator.setAppBadge = async () => { throw new Error('permission denied'); };
  await scope.PROdigitalTVPush.show(registration, { data: { badgeCount: '2' } });
  assert.equal(shown, 6);
});
