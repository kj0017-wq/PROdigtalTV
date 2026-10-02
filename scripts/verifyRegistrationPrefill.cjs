// Read-only end-to-end check using one existing invitation; never prints personal field values.
const base = 'C:/Users/Klaus-HP/AppData/Roaming/npm/node_modules/firebase-tools/lib';
const auth = require(base + '/auth');
const { requireAuth } = require(base + '/requireAuth');
const { Client } = require(base + '/apiv2');
const decode = value => value?.stringValue ?? value?.booleanValue ?? null;
(async () => {
  const options={project:'prodigitaltv-da47b',nonInteractive:true}; auth.setActiveAccount(options,auth.selectAccount(null,process.cwd())); await requireAuth(options);
  const db=new Client({urlPrefix:'https://firestore.googleapis.com',apiVersion:'v1',auth:true});
  const mail=(await db.get('/projects/prodigitaltv-da47b/databases/(default)/documents/mailQueue/nOgZBbzns7hWZPgGxjrS')).body;
  const fields=Object.fromEntries(Object.entries(mail.fields||{}).map(([k,v])=>[k,decode(v)]));
  const url=new URL(fields.link), token=new URLSearchParams(url.hash.split('?')[1]||'').get('invite');
  const response=await fetch('https://europe-west3-prodigitaltv-da47b.cloudfunctions.net/getEventRegistrationPrefill',{
    method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({data:{eventId:fields.eventId,token}})
  });
  const payload=await response.json(), result=payload.result||payload.data||{};
  console.log(JSON.stringify({http:response.status,tokenInLink:/^[a-f0-9]{48}$/.test(token||''),
    editableFields:{firstName:Boolean(result.firstName),lastName:Boolean(result.lastName),company:Boolean(result.company),position:Boolean(result.position),email:Boolean(result.email),phone:Boolean(result.phone)}}));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
