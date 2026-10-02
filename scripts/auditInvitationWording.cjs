// Read-only audit of invitation and confirmation wording for the current event.
const base='C:/Users/Klaus-HP/AppData/Roaming/npm/node_modules/firebase-tools/lib';
const auth=require(base+'/auth'); const {requireAuth}=require(base+'/requireAuth'); const {Client}=require(base+'/apiv2');
const decode=v=>v?.stringValue??v?.timestampValue??v?.booleanValue??null;
const rows=r=>r.body.filter(x=>x.document).map(x=>({id:x.document.name.split('/').pop(),...Object.fromEntries(Object.entries(x.document.fields||{}).map(([k,v])=>[k,decode(v)]))}));
(async()=>{const options={project:'prodigitaltv-da47b',nonInteractive:true};auth.setActiveAccount(options,auth.selectAccount(null,process.cwd()));await requireAuth(options);
const client=new Client({urlPrefix:'https://firestore.googleapis.com',apiVersion:'v1',auth:true});
const response=await client.post('/projects/prodigitaltv-da47b/databases/(default)/documents:runQuery',{structuredQuery:{from:[{collectionId:'mailQueue'}],where:{fieldFilter:{field:{fieldPath:'eventId'},op:'EQUAL',value:{stringValue:'event-c5082f22-057b-44b4-8d50-8ccf3421f459'}}},limit:1000}});
const relevant=rows(response).filter(x=>['event_notification','registration_confirmation','registration_confirmation_retry'].includes(x.template)).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
console.log(JSON.stringify(relevant.slice(0,50).map(x=>({id:x.id,template:x.template,to:x.to,subject:x.subject||'',title:x.title||'',personName:x.personName||'',firstName:x.firstName||'',lastName:x.lastName||'',bodyStart:String(x.shortText||x.text||'').split(/\r?\n/).slice(0,3).join(' | '),createdAt:x.createdAt,status:x.status})),null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1});
