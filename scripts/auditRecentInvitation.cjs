// Read-only audit of recent event invitation selection and delivery records.
const base = 'C:/Users/Klaus-HP/AppData/Roaming/npm/node_modules/firebase-tools/lib';
const auth = require(base + '/auth');
const { requireAuth } = require(base + '/requireAuth');
const { Client } = require(base + '/apiv2');
const decode = value => {
  if (!value) return null;
  if (value.arrayValue) return (value.arrayValue.values || []).map(decode);
  if (value.mapValue) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([k,v]) => [k,decode(v)]));
  return value.stringValue ?? value.timestampValue ?? value.integerValue ?? value.booleanValue ?? null;
};
const rows = response => response.body.filter(x => x.document).map(x => ({ id: x.document.name.split('/').pop(), ...Object.fromEntries(Object.entries(x.document.fields || {}).map(([k,v]) => [k,decode(v)])) }));
(async () => {
  const options = { project: 'prodigitaltv-da47b', nonInteractive: true };
  auth.setActiveAccount(options, auth.selectAccount(null, process.cwd())); await requireAuth(options);
  const client = new Client({ urlPrefix: 'https://firestore.googleapis.com', apiVersion: 'v1', auth: true });
  const run = structuredQuery => client.post('/projects/prodigitaltv-da47b/databases/(default)/documents:runQuery', { structuredQuery });
  const notifications = rows(await run({ from: [{ collectionId: 'eventNotifications' }], orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }], limit: 30 }));
  const candidates = notifications.filter(n => /besten lernen/i.test(n.title || '') && String(n.createdAt) >= '2026-09-30');
  const eventIds = [...new Set(candidates.map(n => n.eventId).filter(Boolean))];
  const events = {};
  for (const id of eventIds) {
    const result = await client.get('/projects/prodigitaltv-da47b/databases/(default)/documents/events/' + encodeURIComponent(id));
    events[id] = Object.fromEntries(Object.entries(result.body.fields || {}).map(([k,v]) => [k,decode(v)]));
  }
  const report = [];
  for (const n of candidates) {
    const mails = rows(await run({ from: [{ collectionId: 'mailQueue' }], where: { fieldFilter: { field: { fieldPath: 'notificationId' }, op: 'EQUAL', value: { stringValue: n.id } } }, limit: 1000 }));
    report.push({ notification: { id:n.id,createdAt:n.createdAt,title:n.title,eventId:n.eventId,recipientGroup:n.recipientGroup,
      extraSpeakerEventIds:n.extraSpeakerEventIds||[],channels:n.channels||[],targetCount:n.targetCount,queuedMailCount:n.queuedMailCount,
      queuedSmsCount:n.queuedSmsCount,pushAttemptedCount:n.pushAttemptedCount,status:n.status,mailQueueIds:(n.mailQueueIds||[]).length },
      event: { id:n.eventId,title:events[n.eventId]?.title,date:events[n.eventId]?.date }, mailCount: mails.length,
      statusCounts: mails.reduce((a,m) => (a[m.status || 'unknown']=(a[m.status || 'unknown']||0)+1,a),{}),
      recipients: mails.map(m => ({ to:m.to,status:m.status,error:m.error||'',rejected:m.providerRejected||[],deliveryStatus:m.deliveryStatus||'' })) });
  }
  console.log(JSON.stringify(report, null, 2));
})().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
