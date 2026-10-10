const {randomBytes,randomInt,createHash,timingSafeEqual}=require('node:crypto');
const {createPinRecord,pinMatches}=require('./accountingYearPin');
const digest=v=>createHash('sha256').update(String(v)).digest('hex');
function createSmsPasswordReset({db,auth,HttpsError,resolvePhone,sendSms,clock=()=>Date.now(),makeCode=()=>String(randomInt(0,1000000)).padStart(6,'0')}){
 const fail=(code,message)=>{throw new HttpsError(code,message);};
 const ref=id=>db.collection('loginSmsSecurity').doc(id);
 const validEmail=value=>{const email=String(value||'').trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)fail('invalid-argument','Bitte eine gültige E-Mail-Adresse eingeben.');return email;};
 async function requestCode(request){
  const email=validEmail(request.data?.email),now=clock(),challengeId=randomBytes(24).toString('hex'),code=makeCode();
  const accountKey=digest(email),ipKey='ip-'+digest(request.rawRequest?.ip||'unknown');
  await db.runTransaction(async tx=>{const refs=[ref('rate-'+accountKey),ref(ipKey)],snaps=await Promise.all(refs.map(r=>tx.get(r)));for(let i=0;i<refs.length;i++){const old=snaps[i].data()||{};if(i===0&&now-Number(old.lastMs||0)<60000)fail('resource-exhausted','Bitte vor einem neuen Code eine Minute warten.');const fresh=now-Number(old.windowMs||0)>=3600000;const count=fresh?0:Number(old.count||0);if(count>=(i===0?5:20))fail('resource-exhausted','Zu viele SMS-Anfragen. Bitte später erneut versuchen.');tx.set(refs[i],{lastMs:now,windowMs:fresh?now:old.windowMs,count:count+1});}});
  let user;try{user=await auth.getUserByEmail(email);}catch(e){if(e.code!=='auth/user-not-found')throw e;}
  const phone=user&&!user.disabled?await resolvePhone(user.uid):'';
  const challenge=ref(challengeId);const record={...createPinRecord(code,user?.uid||'',new Date(now).toISOString()),email,uid:phone?user.uid:'',accountKey,expiresMs:now+600000,status:phone?'pending':'unavailable',attempts:0};
  await challenge.create(record);
  if(phone){try{const sent=await sendSms({to:phone,message:'PROdigitalTV: Ihr Code zum Zuruecksetzen des Passworts lautet '+code+'. Gueltig 10 Minuten. Nicht weitergeben.'});if(!sent?.messageId)throw Error('No receipt');await challenge.update({status:'sent'});}catch(e){await challenge.update({status:'failed',hash:'',salt:''});fail('unavailable','Die SMS konnte nicht versendet werden. Bitte später erneut versuchen oder die E-Mail-Funktion verwenden.');}}
  return {challengeId,expiresMs:record.expiresMs,message:'Wenn für diese E-Mail-Adresse ein aktives Konto mit hinterlegter Mobilnummer besteht, wurde ein SMS-Code gesendet.'};
 }
 async function verifyCode(request){
  const id=String(request.data?.challengeId||''),code=String(request.data?.code||'');if(!/^[a-f0-9]{48}$/.test(id)||!/^\d{6}$/.test(code))fail('invalid-argument','Bitte den sechsstelligen SMS-Code eingeben.');const now=clock(),grant=randomBytes(32).toString('hex');
  const result=await db.runTransaction(async tx=>{const r=ref(id),s=await tx.get(r),v=s.data()||{};if(v.status!=='sent'||v.expiresMs<=now||!v.uid)return {error:true};if(!pinMatches(code,v)){const attempts=Number(v.attempts||0)+1;tx.update(r,{attempts,status:attempts>=5?'blocked':'sent'});return {error:true};}tx.update(r,{status:'verified',hash:'',salt:'',grantHash:digest(grant),grantExpiresMs:now+300000});return {ok:true};});
  if(result.error)fail('permission-denied','Der Code ist falsch, abgelaufen oder nicht mehr gültig. Bitte gegebenenfalls einen neuen Code anfordern.');return {grant};
 }
 async function setPassword(request){
  const id=String(request.data?.challengeId||''),grant=String(request.data?.grant||''),password=request.data?.newPassword;
  if(!/^[a-f0-9]{48}$/.test(id)||! /^[a-f0-9]{64}$/.test(grant))fail('permission-denied','Bitte zuerst den SMS-Code bestätigen.');
  if(typeof password!=='string'||password.length<12||password.length>128)fail('invalid-argument','Bitte ein Passwort mit 12 bis 128 Zeichen verwenden.');
  const r=ref(id),now=clock();const data=await db.runTransaction(async tx=>{const s=await tx.get(r),v=s.data()||{};if(v.status!=='verified'||v.grantExpiresMs<=now||!v.uid||!v.grantHash||!timingSafeEqual(Buffer.from(digest(grant),'hex'),Buffer.from(v.grantHash,'hex')))fail('permission-denied','Die Freigabe ist abgelaufen. Bitte einen neuen SMS-Code anfordern.');tx.update(r,{status:'applying',grantHash:''});return v;});
  try{const u=await auth.getUser(data.uid);if(u.disabled||u.email?.toLowerCase()!==data.email)fail('permission-denied','Dieses Konto ist nicht verfügbar.');await auth.updateUser(data.uid,{password});await auth.revokeRefreshTokens(data.uid);await r.update({status:'used'});return {updated:true};}catch(e){await r.update({status:'failed'});throw e;}
 }
 return {requestCode,verifyCode,setPassword};
}
module.exports={createSmsPasswordReset};
