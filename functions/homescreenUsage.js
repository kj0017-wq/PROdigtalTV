const {createHash}=require('node:crypto');
const digest=value=>createHash('sha256').update(value).digest('hex');
const email=value=>String(value||'').trim().toLowerCase();
function createHomescreenUsage({db,auth,FieldValue,HttpsError,now=Date.now,resolveMember=async()=>({})}){
 const record=async request=>{
  if(request.data?.standalone!==true)throw new HttpsError('failed-precondition','Nur ein bestätigter Homescreen-Start kann erfasst werden.');
  const platform=request.data.platform;if(platform!==undefined&&!['ios','android','other'].includes(platform))throw new HttpsError('invalid-argument','Ungültiges Betriebssystem.');
  let address='',memberId='',userRef=null;const token=request.data?.ticketToken;
  if(token){if(!/^[a-f0-9]{64}$/i.test(token))throw new HttpsError('invalid-argument','Ungültiges Ticket.');const found=await db.collection('registrations').where('ticketTokenHash','==',digest(token)).limit(1).get();const data=found.docs[0]?.data();if(!data||!['confirmed','checked_in','attended'].includes(data.status)||data.eventId!==request.data.eventId)throw new HttpsError('permission-denied','Das Ticket ist nicht gültig.');address=email(data.email);memberId=data.memberId||'';}
  else if(request.auth){const user=await auth.getUser(request.auth.uid);const profile=(await db.collection('users').doc(request.auth.uid).get()).data();if(user.disabled||!user.emailVerified||['inactive','archived','deleted','disabled'].includes(profile?.status))throw new HttpsError('permission-denied','Der persönliche Zugang ist noch nicht bestätigt.');address=email(user.email);memberId=profile?.memberId||'';userRef=db.collection('users').doc(request.auth.uid);}
  else throw new HttpsError('unauthenticated','Persönlicher Zugang oder Gäste-Ticket erforderlich.');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))throw new HttpsError('failed-precondition','Keine zuordenbare E-Mail-Adresse.');
  const ref=db.collection('webAppUsage').doc(digest(address));await db.runTransaction(async tx=>{const old=(await tx.get(ref)).data();if(old?.lastOpenedAt?.toMillis&&now()-old.lastOpenedAt.toMillis()<300000&&(!platform||old.platform===platform))return;const stamp=FieldValue.serverTimestamp();tx.set(ref,{firstOpenedAt:old?.firstOpenedAt||stamp,lastOpenedAt:stamp,source:'homescreen',evidence:'standalone_launch',platform:platform||old?.platform||'unknown',version:1},{merge:true});});
  const observed=(await ref.get()).data();if(!memberId)memberId=(await resolveMember(address))?.memberId||'';
  const targets=[...(userRef?[userRef]:[]),...(/^[a-zA-Z0-9_-]{1,160}$/.test(memberId)?[db.collection('members').doc(memberId)]:[])];
  for(const target of targets)await db.runTransaction(async tx=>{const snap=await tx.get(target);if(!snap.exists)return;const data=snap.data();if(['inactive','archived','deleted','disabled','cancelled'].includes(data.status))return;const previous=data.homescreenUsage||{};if(previous.lastOpenedAt?.toMillis?.()>=observed.lastOpenedAt?.toMillis?.()&&previous.confirmed)return;tx.set(target,{homescreenUsage:{confirmed:true,firstOpenedAt:previous.firstOpenedAt||observed.firstOpenedAt,lastOpenedAt:observed.lastOpenedAt,evidence:'standalone_launch',platform:observed.platform||'unknown',identityHash:digest(address)}},{merge:true});});
  return {confirmed:true};
 };
 const read=async request=>{
  if(!request.auth)throw new HttpsError('unauthenticated','CMS-Login erforderlich.');const profile=(await db.collection('users').doc(request.auth.uid).get()).data();if(!['admin','editor'].includes(profile?.role)||['inactive','archived','deleted','disabled'].includes(profile.status))throw new HttpsError('permission-denied','Keine CMS-Berechtigung.');
  const eventId=request.data?.eventId;if(!/^[a-zA-Z0-9_-]{1,160}$/.test(eventId||''))throw new HttpsError('invalid-argument','Veranstaltung fehlt.');const registrations=await db.collection('registrations').where('eventId','==',eventId).get();const keys=[...new Set(registrations.docs.map(doc=>email(doc.data().email)).filter(Boolean).map(digest))];const records=new Map();for(let i=0;i<keys.length;i+=200){const snaps=await db.getAll(...keys.slice(i,i+200).map(key=>db.collection('webAppUsage').doc(key)));for(const snap of snaps)if(snap.exists)records.set(snap.id,snap.data());}
  const usage={};for(const doc of registrations.docs){const value=records.get(digest(email(doc.data().email)));usage[doc.id]={confirmed:Boolean(value?.lastOpenedAt),platform:value?.platform||'unknown',lastOpenedAt:value?.lastOpenedAt?.toDate?.().toISOString()||null};}return {usage};
 };return {record,read};
}
module.exports={createHomescreenUsage,digest};
