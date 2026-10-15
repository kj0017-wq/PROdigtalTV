'use strict';
const {createHash}=require('node:crypto');
const {memberActive}=require('./documentMailbox');
const dayFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'});
function berlinDay(ms){const p=Object.fromEntries(dayFormatter.formatToParts(new Date(ms)).map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}`;}
const dayId=(memberId,date)=>createHash('sha256').update(memberId+'|'+date).digest('hex');
const millis=value=>value?.toMillis?.()??Date.parse(value||'');
const activeUser=u=>!['inactive','disabled','deleted','archived'].includes(String(u.status||'').toLowerCase())&&!u.guestPasswordTemporary;
function contactEmail(member){return [member.contactEmail,member.email,member.contact_email,member.primaryEmail,member.profileEmail].map(v=>String(v||'').trim().toLowerCase()).find(v=>/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(v))||'';}
function createMailboxNotifications({db,FieldValue,Timestamp,pushService,memberEmail=contactEmail,now=()=>Date.now()}){
 const stamp=()=>FieldValue.serverTimestamp();
 const link='https://prodigitaltv.de/#/portal?tab=my-documents';
 const dayRef=(id,date)=>db.collection('mailboxNotificationDays').doc(dayId(id,date));
 async function emailFor(memberId,member){
  const email=memberEmail(member);if(email)return email;
  // Reuse linked CMS accounts if the member record has no contact address.
  if(contactEmail(member))return ''; // Respect exclusions from the existing member-address resolver.
  const users=await db.collection('users').where('memberId','==',memberId).get();
  return users.docs.filter(d=>activeUser(d.data())).sort((a,b)=>a.id.localeCompare(b.id)).map(d=>contactEmail({email:d.data().email})).find(Boolean)||'';
 }
 async function recipientAllowed(tx,memberId,member,email){
  if(contactEmail(member))return memberEmail(member)===email;
  const users=await tx.get(db.collection('users').where('memberId','==',memberId));
  return users.docs.some(d=>activeUser(d.data())&&contactEmail({email:d.data().email})===email);
 }
 async function waiting(tx,memberId){
  const deliveries=await tx.get(db.collection('mailboxDeliveries').where('memberId','==',memberId));
  const candidates=deliveries.docs.filter(d=>!d.data().firstRetrievedAt&&!d.data().withdrawn);
  const ids=[...new Set(candidates.map(d=>d.data().documentId))];
  const documents=await Promise.all(ids.map(id=>tx.get(db.collection('mailboxDocuments').doc(id))));
  const available=new Set(documents.filter(d=>d.exists&&['ready','delivering','delivered'].includes(d.data().status)).map(d=>d.id));
  return candidates.filter(d=>available.has(d.data().documentId));
 }
 async function processMember(memberId){
  if(typeof memberId!=='string'||!memberId||memberId.includes('/'))return {skipped:true};
  const memberRef=db.collection('members').doc(memberId),stateRef=db.collection('mailboxNotificationState').doc(memberId);
  const member=await memberRef.get();if(!member.exists||!memberActive(member.data(),now()))return {skipped:true};
  const email=await emailFor(memberId,member.data());if(!email)return {skipped:true,reason:'missing-contact-email'};
  const job=await db.runTransaction(async tx=>{
   const date=berlinDay(now()),ref=dayRef(memberId,date),mailRef=db.collection('mailQueue').doc('mailbox-'+ref.id);
   const [current,state,daily]=await Promise.all([tx.get(memberRef),tx.get(stateRef),tx.get(ref)]);
   if(!current.exists||!memberActive(current.data(),now())||daily.data()?.scheduledAt)return null;
   if(!await recipientAllowed(tx,memberId,current.data(),email))return null;
   const docs=await waiting(tx,memberId),covered=state.data()||{},last=Number(covered.coveredDeliveryMillis||0),ties=new Set(covered.coveredIdsAtMillis||[]);
   const fresh=docs.filter(d=>{const at=millis(d.data().deliveredAt);return at>last||(at===last&&!ties.has(d.id));});
   if(!fresh.length)return null;
   const max=Math.max(...fresh.map(d=>millis(d.data().deliveredAt)));
   const ids=fresh.filter(d=>millis(d.data().deliveredAt)===max).map(d=>d.id);
   if(max===last)ids.push(...ties);
   tx.set(stateRef,{memberId,coveredDeliveryMillis:max,coveredIdsAtMillis:[...new Set(ids)],lastScheduledAt:stamp()},{merge:true});
   tx.set(ref,{memberId,date,scheduledAt:stamp(),mailId:mailRef.id,pushStatus:'pending',newDocumentCount:fresh.length,deleteAfter:Timestamp.fromMillis(now()+30*86400000)},{merge:true});
   tx.create(mailRef,{type:'mailbox_documents',template:'mailbox_documents',memberId,notificationDayId:ref.id,to:email,subject:'Sie haben Post – PROdigitalTV',text:'Sie haben Post!\n\nIn Ihrem persönlichen PROdigitalTV-Dokumentenpostfach warten neue Dokumente.\n\nBitte melden Sie sich mit Ihrem bestehenden Zugang an und öffnen Sie „Mein Profil → Meine Dokumente“:\n'+link+'\n\nSie erhalten höchstens einen E-Mail-Hinweis pro Kalendertag.',link,status:'queued',queuedAt:stamp(),createdAt:stamp(),updatedAt:stamp()});
   return {id:ref.id};
  });
  if(job)await sendPush(job.id);
  return {scheduled:Boolean(job)};
 }
 async function claimMail(mailId){
  const mailRef=db.collection('mailQueue').doc(mailId);
  return db.runTransaction(async tx=>{
   const mail=await tx.get(mailRef),m=mail.data();if(!m||m.template!=='mailbox_documents'||m.status!=='queued')return false;
   const date=berlinDay(now()),member=await tx.get(db.collection('members').doc(m.memberId)),ref=dayRef(m.memberId,date),daily=await tx.get(ref);
   const allowed=member.exists&&await recipientAllowed(tx,m.memberId,member.data(),m.to);
   const docs=member.exists&&memberActive(member.data(),now())?await waiting(tx,m.memberId):[];
   let skip='';
   if(!docs.length)skip='Keine verfügbaren neuen Dokumente oder Mitglied inaktiv';
   else if(daily.data()?.mailAttemptedAt)skip='Tageslimit für Dokumentenhinweise erreicht';
   else if(!allowed)skip='Mitgliedsadresse inzwischen geändert';
   if(skip){tx.update(mailRef,{status:'skipped',skipReason:skip,updatedAt:stamp()});return false;}
   // Claim before SMTP: a duplicate event or an ambiguous provider result must not resend.
   tx.set(ref,{memberId:m.memberId,date,mailAttemptedAt:stamp(),attemptedMailId:mailId,deleteAfter:Timestamp.fromMillis(now()+30*86400000)},{merge:true});
   tx.update(mailRef,{status:'sending',attemptedAt:stamp(),updatedAt:stamp()});return true;
  });
 }
 async function sendPush(id){
  const origin=db.collection('mailboxNotificationDays').doc(id);
  const job=await db.runTransaction(async tx=>{
   const original=await tx.get(origin),o=original.data();if(!o||o.pushStatus!=='pending')return null;
   const date=berlinDay(now()),ref=dayRef(o.memberId,date);
   const [daily,member,mail]=await Promise.all([tx.get(ref),tx.get(db.collection('members').doc(o.memberId)),tx.get(db.collection('mailQueue').doc(o.mailId))]);
   const allowed=member.exists&&mail.data()?.to&&await recipientAllowed(tx,o.memberId,member.data(),mail.data().to);
   const docs=member.exists&&memberActive(member.data(),now())?await waiting(tx,o.memberId):[];
   if(!docs.length||daily.data()?.pushAttemptedAt||!mail.data()?.to){tx.update(origin,{pushStatus:'skipped',pushFinishedAt:stamp()});return null;}
   if(!allowed){tx.update(origin,{pushStatus:'skipped',pushFinishedAt:stamp()});return null;}
   const claimed={memberId:o.memberId,date,pushAttemptedAt:stamp(),deleteAfter:Timestamp.fromMillis(now()+30*86400000)};
   if(ref.id===origin.id)tx.update(origin,{...claimed,pushStatus:'sending',pushStartedAt:stamp()});
   else{tx.set(ref,claimed,{merge:true});tx.update(origin,{pushStatus:'sending',pushStartedAt:stamp()});}
   return {email:mail.data().to,notificationId:'mailbox-'+ref.id,badgeCount:docs.length};
  });
  if(!job)return {skipped:true};
  try{
   const result=await pushService.deliver(job.email,{id:job.notificationId,badgeCount:job.badgeCount,title:'Sie haben Post!',body:'Neue Dokumente warten in Ihrem PROdigitalTV-Profil unter „Meine Dokumente“.',link});
   await origin.update({pushStatus:result.failed?(result.sent?'partial':'failed'):(result.sent?'sent':'unavailable'),pushSent:Number(result.sent||0),pushFailed:Number(result.failed||0),pushFinishedAt:stamp()});
   return result;
  }catch(error){await origin.update({pushStatus:'failed',pushError:String(error.code||'push-send-failed'),pushFinishedAt:stamp()});return {failed:1};}
 }
 async function sweep(){
  const pending=await db.collection('mailboxDeliveries').where('status','==','delivered').get();
  const members=[...new Set(pending.docs.filter(d=>!d.data().firstRetrievedAt&&!d.data().withdrawn).map(d=>d.data().memberId))];
  const result={members:members.length,scheduled:0,errors:0};
  for(const id of members){try{const job=await processMember(id);if(job.scheduled)result.scheduled++;}catch(error){result.errors++;console.error('mailbox-notification-schedule',String(error.code||'failed'));}}
  const jobs=await db.collection('mailboxNotificationDays').where('pushStatus','==','pending').get();
  for(const job of jobs.docs){try{await sendPush(job.id);}catch(error){result.errors++;console.error('mailbox-notification-push',String(error.code||'failed'));}}
  return result;
 }
 return {processMember,claimMail,sendPush,sweep};
}
module.exports={createMailboxNotifications,berlinDay,dayId,contactEmail};
