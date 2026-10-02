// Adds secure prefill targets to today's already-sent invitation links. Does not resend mail.
const { createHash, randomBytes } = require('node:crypto');
const base = 'C:/Users/Klaus-HP/AppData/Roaming/npm/node_modules/firebase-tools/lib';
const auth = require(base + '/auth');
const { requireAuth } = require(base + '/requireAuth');
const { Client } = require(base + '/apiv2');
const notificationIds = new Set([
  'event-notification-3625d5aa2a734900778f470d3b0ca1f5',
  'event-notification-a898d215c9712d73754bb4fff5ef9748'
]);
const decode = value => {
  if (!value) return null;
  if (value.arrayValue) return (value.arrayValue.values || []).map(decode);
  if (value.mapValue) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([k,v]) => [k,decode(v)]));
  return value.stringValue ?? value.timestampValue ?? value.integerValue ?? value.booleanValue ?? null;
};
const rows = response => response.body.filter(x => x.document).map(x => ({ _name:x.document.name, id:x.document.name.split('/').pop(), ...Object.fromEntries(Object.entries(x.document.fields || {}).map(([k,v]) => [k,decode(v)])) }));
const string = value => ({ stringValue: String(value || '') });
const timestamp = value => ({ timestampValue: new Date(value).toISOString() });
const emailValues = person => [person.email,person.contactEmail,person.contact_email,person.primaryEmail,person.profileEmail,
  ...(person.emails||[]),...(person.additionalEmails||[]),...(person.notificationEmails||[])].map(v=>String(v||'').trim().toLowerCase()).filter(v=>v.includes('@'));
const invitationLink = (link, token) => {
  const url = new URL(link);
  const [route, query=''] = url.hash.slice(1).split('?');
  const params = new URLSearchParams(query); params.set('invite', token); url.hash = `${route}?${params}`; return url.href;
};
(async () => {
  const apply = process.argv.includes('--apply');
  const options = { project:'prodigitaltv-da47b', nonInteractive:true };
  auth.setActiveAccount(options, auth.selectAccount(null, process.cwd())); await requireAuth(options);
  const client = new Client({ urlPrefix:'https://firestore.googleapis.com', apiVersion:'v1', auth:true });
  const run = structuredQuery => client.post('/projects/prodigitaltv-da47b/databases/(default)/documents:runQuery',{structuredQuery});
  const [contactsResult,membersResult] = await Promise.all([
    run({from:[{collectionId:'contacts'}],limit:2000}), run({from:[{collectionId:'members'}],limit:2000})
  ]);
  const profiles = new Map();
  [...rows(membersResult),...rows(contactsResult)].forEach(person => emailValues(person).forEach(email => profiles.set(email,{...(profiles.get(email)||{}),...person})));
  const mails = [];
  for (const id of notificationIds) {
    mails.push(...rows(await run({from:[{collectionId:'mailQueue'}],where:{fieldFilter:{field:{fieldPath:'notificationId'},op:'EQUAL',value:{stringValue:id}}},limit:1000})));
  }
  const eligible = mails.filter(mail => mail.status === 'sent' && mail.eventId && mail.to && !String(mail.link||'').includes('invite='));
  const now = Date.now(), writes = [], summary = [];
  for (const mail of eligible) {
    const email = String(mail.to).trim().toLowerCase(), profile = profiles.get(email) || {};
    const token = randomBytes(24).toString('hex');
    const hash = createHash('sha256').update(token).digest('hex');
    const link = invitationLink(mail.link || `https://prodigitaltv.de/#/event/${encodeURIComponent(mail.eventId)}`,token);
    const fields = {
      eventId:string(mail.eventId),notificationId:string(mail.notificationId),email:string(email),
      firstName:string(mail.firstName||profile.firstName),lastName:string(mail.lastName||profile.lastName),
      company:string(mail.company||profile.company||profile.name),position:string(profile.position||profile.jobTitle||profile.function),
      phone:string(profile.phone||profile.mobile||profile.mobilePhone||profile.contactPhone),status:string('active'),
      expiresAt:timestamp(now+120*24*60*60*1000),createdAt:timestamp(now),updatedAt:timestamp(now)
    };
    writes.push({update:{name:`projects/prodigitaltv-da47b/databases/(default)/documents/eventRegistrationPrefills/${hash}`,fields}});
    writes.push({update:{name:mail._name,fields:{link:string(link),registrationPrefillEnabled:{booleanValue:true},updatedAt:timestamp(now)}},updateMask:{fieldPaths:['link','registrationPrefillEnabled','updatedAt']},currentDocument:{exists:true}});
    summary.push({mailId:mail.id,email,hasName:Boolean(fields.firstName.stringValue||fields.lastName.stringValue),hasPhone:Boolean(fields.phone.stringValue),hasCompany:Boolean(fields.company.stringValue)});
  }
  if (apply && writes.length) await client.post('/projects/prodigitaltv-da47b/databases/(default)/documents:commit',{writes});
  console.log(JSON.stringify({apply,mailCount:mails.length,eligible:eligible.length,writes:writes.length,summary},null,2));
})().catch(error=>{console.error(error.stack||error.message);process.exitCode=1;});
