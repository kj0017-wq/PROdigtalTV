const {createHash,randomBytes}=require('node:crypto');const {guestEventLiveIsOpen}=require('./eventLiveDomain');
const clean=v=>String(v||'').trim();const hash=v=>createHash('sha256').update(v).digest('hex');
function createEventTicketLogin({db,auth,FieldValue,HttpsError,isMemberEmail=async()=>false,now=Date.now}){
 return async request=>{
  const eventId=clean(request.data?.eventId),ticketToken=clean(request.data?.ticketToken);
  if(!eventId||eventId.includes('/')||eventId.length>160||! /^[a-f0-9]{64}$/i.test(ticketToken))throw new HttpsError('invalid-argument','Ein gültiges persönliches Ticket ist erforderlich.');
  const [matches,event,access]=await Promise.all([db.collection('registrations').where('ticketTokenHash','==',hash(ticketToken)).limit(2).get(),db.collection('events').doc(eventId).get(),db.collection('eventLiveAccess').doc(eventId).get()]);
  if(matches.docs.length!==1)throw new HttpsError('permission-denied','Das Ticket ist nicht mehr gültig. Bitte am Empfang erneut verknüpfen.');
  const registration=matches.docs[0].data();
  if(registration.eventId!==eventId||registration.status!=='checked_in'||registration.checkedInEventId!==eventId)throw new HttpsError('failed-precondition','Bitte zuerst den QR-Check-in für dieses Event abschließen.');
  if(!event.exists||event.data().eventLiveEnabled!==true||access.data()?.enabled!==true||['inactive','cancelled','deleted','archived','draft','hidden'].includes(clean(event.data().status).toLowerCase())||!guestEventLiveIsOpen(event.data(),now()))throw new HttpsError('failed-precondition','Der Veranstaltungsbereich ist derzeit gesperrt oder noch nicht geöffnet.');
  const email=clean(registration.email).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new HttpsError('failed-precondition','Die E-Mail-Adresse der Anmeldung ist unvollständig. Bitte an den Empfang wenden.');
  let user=null;try{user=await auth.getUserByEmail(email);}catch(error){if(error.code!=='auth/user-not-found')throw error;}
  const profile=user?await db.collection('users').doc(user.uid).get():null;const data=profile?.data()||{};
  if(user?.disabled||['inactive','disabled','deleted','archived'].includes(clean(data.status).toLowerCase()))throw new HttpsError('permission-denied','Dieser Zugang ist deaktiviert. Bitte an den Empfang wenden.');
  // A ticket may never bypass the normal login for a member or privileged account.
  if(await isMemberEmail(email)||data.memberId||Object.keys(user?.customClaims||{}).length||(data.role&&data.role!=='guest')||user?.multiFactor?.enrolledFactors?.length)return {requiresLogin:true,eventId};
  if(request.auth&&clean(request.auth.token?.email).toLowerCase()!==email&&!request.data.confirmAccountSwitch)return {requiresAccountSwitch:true,eventId,displayName:[registration.firstName,registration.lastName].filter(Boolean).join(' ')};
  if(!user){try{user=await auth.createUser({email,emailVerified:true,displayName:[registration.firstName,registration.lastName].filter(Boolean).join(' ')});}catch(error){if(error.code!=='auth/email-already-exists')throw error;throw new HttpsError('aborted','Der Zugang wurde inzwischen eingerichtet. Bitte erneut auf Zum Event tippen.');}}
  const patch=profile?.exists?{}:{email,firstName:clean(registration.firstName),lastName:clean(registration.lastName),displayName:user.displayName||email,role:'guest',accountType:'guest',status:'active',createdVia:'checked_in_ticket',createdAt:FieldValue.serverTimestamp()};
  if(data.guestPasswordTemporary===true){await auth.updateUser(user.uid,{password:randomBytes(32).toString('hex')});Object.assign(patch,{guestPasswordTemporary:false,guestPasswordHash:FieldValue.delete(),guestPasswordExpiresAt:FieldValue.delete()});}
  const fresh=await matches.docs[0].ref.get();const current=fresh.data()||{};if(current.ticketTokenHash!==hash(ticketToken)||current.status!=='checked_in'||current.checkedInEventId!==eventId)throw new HttpsError('permission-denied','Das Ticket ist nicht mehr gültig. Bitte erneut am Empfang verknüpfen.');
  await auth.updateUser(user.uid,{emailVerified:true});await db.collection('users').doc(user.uid).set({...patch,updatedAt:FieldValue.serverTimestamp()},{merge:true});
  return {customToken:await auth.createCustomToken(user.uid),eventId,email};
 };
}
module.exports={createEventTicketLogin};
