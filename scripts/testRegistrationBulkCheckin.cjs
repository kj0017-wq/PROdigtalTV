const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('functions/index.js', 'utf8');
const start = source.indexOf('exports.adminCheckInRegistrations =');
const end = source.indexOf('exports.adminCheckInEventGroup =', start);
let writes = [];
const records = {
  one: { eventId: 'event', status: 'confirmed', email: 'one@example.test', companion: { firstName: 'Guest' } },
  done: { eventId: 'event', status: 'checked_in', checkedInAt: 'old' },
  cancelled: { eventId: 'event', status: 'cancelled' },
  other: { eventId: 'other', status: 'confirmed' }
};
const context = {
  exports: {}, region: 'test', onCall: (_, handler) => handler,
  requireEditor: async request => { if (!request.auth?.editor) throw new Error('permission-denied'); },
  clean: value => String(value || '').trim(), HttpsError: Error,
  FieldValue: { serverTimestamp: () => 'now' }, registrationLockId: (event, email) => `${event}-${email}`,
  db: {
    collection: collection => ({ doc: id => ({ collection, id }) }),
    runTransaction: async fn => {
      const pending = [];
      const result = await fn({
        get: async () => ({ exists: true }),
        getAll: async (...refs) => refs.map(ref => ({ ref, id: ref.id, exists: !!records[ref.id], data: () => records[ref.id] })),
        update: (ref, data) => pending.push({ ref, data }),
        set: (ref, data) => pending.push({ ref, data })
      });
      writes.push(...pending);
      return result;
    }
  }
};
vm.runInNewContext(source.slice(start, end), context);
const handler = context.exports.adminCheckInRegistrations;
const request = ids => ({ auth: { editor: true, uid: 'admin' }, data: { eventId: 'event', registrationIds: ids, confirmed: true } });
(async () => {
  const result = await handler(request(['one', 'one', 'done', 'cancelled']));
  assert.equal(result.checkedInCount, 1);
  assert.equal(result.skippedCount, 2);
  assert.equal(writes.length, 2);
  assert.equal(writes[0].data.checkedInEventId, 'event');
  assert.equal(writes[0].data.checkedInBy, 'admin');
  assert.equal('companion' in writes[0].data, false);
  assert.equal('emailConfirmed' in writes[0].data, false);
  writes = [];
  await assert.rejects(handler({ ...request(['one']), auth: null }));
  await assert.rejects(handler({ ...request(['one']), data: { ...request(['one']).data, confirmed: false } }));
  await assert.rejects(handler(request(['one', 'other'])));
  await assert.rejects(handler(request(['missing'])));
  await assert.rejects(handler(request(['bad/path'])));
  await assert.rejects(handler(request(Array.from({ length: 101 }, (_, i) => String(i)))));
  assert.equal(writes.length, 0);
  console.log('Bulk check-in passed: authorization, confirmation, event scope, deduplication, inactive skips, preserved booking fields.');
})().catch(error => { console.error(error); process.exitCode = 1; });
