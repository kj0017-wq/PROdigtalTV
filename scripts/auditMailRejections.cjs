// Read-only diagnostics. Never sends, retries or changes mail records.
const base = 'C:/Users/Klaus-HP/AppData/Roaming/npm/node_modules/firebase-tools/lib';
const auth = require(base + '/auth');
const { requireAuth } = require(base + '/requireAuth');
const { Client } = require(base + '/apiv2');
function decode(value) {
  if (!value) return null;
  if (value.arrayValue) return (value.arrayValue.values || []).map(decode);
  if (value.mapValue) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([k,v]) => [k,decode(v)]));
  return value.stringValue ?? value.timestampValue ?? value.integerValue ?? value.booleanValue ?? null;
}
(async () => {
  const options = { project: 'prodigitaltv-da47b', nonInteractive: true };
  auth.setActiveAccount(options, auth.selectAccount(null, process.cwd()));
  await requireAuth(options);
  const client = new Client({ urlPrefix: 'https://firestore.googleapis.com', apiVersion: 'v1', auth: true });
  const fields = ['status','to','createdAt','failedAt','updatedAt','error','deliveryStatus','providerResponse','providerRejected','bounceDiagnostic','bounceReason','bounceStatus','bouncedAt','eventId','type'];
  const response = await client.post('/projects/prodigitaltv-da47b/databases/(default)/documents:runQuery', {
    structuredQuery: { from: [{ collectionId: 'mailQueue' }],
      select: { fields: fields.map(fieldPath => ({ fieldPath })) },
      orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }], limit: 1000 }
  });
  const docs = response.body.filter(row => row.document).map(row => ({ id: row.document.name.split('/').pop(), ...Object.fromEntries(Object.entries(row.document.fields || {}).map(([k,v]) => [k,decode(v)])) }));
  const issues = docs.filter(row => row.status === 'failed' || row.providerRejected?.length || /bounce|reject|fail/.test(row.deliveryStatus || ''));
  const reasons = {};
  for (const row of issues) { const key = row.error || row.deliveryStatus; reasons[key] = (reasons[key] || 0) + 1; }
  console.log(JSON.stringify({ scanned: docs.length, newest: docs[0]?.createdAt, oldest: docs.at(-1)?.createdAt, reasons,
    rejected: issues.filter(row => row.providerRejected?.length || (row.status === 'failed' && !row.error?.includes('451 Mail quota'))),
    recent: issues.filter(row => row.createdAt >= '2026-09-28').slice(0,20) }, null, 2));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
