const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('functions/index.js','utf8');
let writes = [];
let access;
let records;
let revoke = false;
const accessRef = {get:async()=>({exists:true,data:()=>access})};
const snapshot = record => ({exists:true,id:record.id,ref:{id:record.id},data:()=>record});
const query = {where(){return this;},limit(){return this;},async get(){return {docs:records.map(snapshot)};}};
const context = {
  exports:{}, region:'test', onCall:(_,fn)=>fn, clean:v=>String(v||'').trim(),mailAddress:v=>String(v||'').trim(),
  HttpsError:Error,hashToken:v=>`hash:${v}`,randomBytes:()=>({toString:()=> 'new-token'}),FieldValue:{serverTimestamp:()=> 'now'},
  db:{collection:name=>name==='eventCheckinAccess'?{doc:()=>accessRef}:query},
};
context.db.runTransaction=async fn=>fn({get:async ref=>ref===accessRef?{exists:true,data:()=>revoke?{...access,status:'inactive'}:access}:snapshot(records.find(r=>r.id===ref.id)),update:(ref,data)=>writes.push({ref,data})});
vm.runInNewContext(source.slice(source.indexOf('exports.linkTicketAtEntrance ='),source.indexOf('exports.linkTicketDeviceByToken =')),context);
const handler=context.exports.linkTicketAtEntrance;
const request=()=>({data:{eventId:'event',email:' Person@Example.test ',accessToken:'entrance'}});
function reset(){writes=[];revoke=false;access={status:'active',tokenHash:'hash:entrance',expiresAt:{toMillis:()=>Date.now()+60000}};records=[{id:'existing',eventId:'event',email:'person@example.test',status:'confirmed',firstName:'Person',companion:{firstName:'Guest'},participantCount:2}];}
(async()=>{
  reset(); const result=await handler(request());
  assert.equal(result.registrationId,'existing');assert.equal(result.ticketToken,'new-token');assert.equal(result.participantCount,2);
  assert.equal(writes.length,1);assert.equal(writes[0].data.ticketDeviceLinked,true);
  assert.equal('status' in writes[0].data,false);assert.equal('role' in writes[0].data,false);assert.equal('emailConfirmed' in writes[0].data,false);
  for(const mutate of [()=>{access.status='inactive';},()=>{access.tokenHash='wrong';},()=>{access.expiresAt={toMillis:()=>0};},()=>{records=[];},()=>{records.push({...records[0],id:'duplicate'});},()=>{records[0].status='pending_email_confirmation';},()=>{records[0].status='cancelled';},()=>{records[0].eventId='other';},()=>{revoke=true;}]){
    reset();mutate();await assert.rejects(handler(request()));assert.equal(writes.length,0);
  }
  reset();await assert.rejects(handler({data:{eventId:'event',email:'person@example.test'}}));assert.equal(writes.length,0);
  console.log('Entrance linking passed: valid QR + confirmed unique match, expiry, revocation, duplicates, event scope, no new booking or account rights.');
})().catch(error=>{console.error(error);process.exitCode=1;});
