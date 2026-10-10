const {randomInt,randomUUID}=require('node:crypto');
const {createPinRecord,pinMatches,historyRef}=require('./accountingYearPin');
function createAccountingYearSms({db,requireAdmin,HttpsError,resolvePhone,sendSms,clock=()=>Date.now(),makeCode=()=>String(randomInt(0,1000000)).padStart(6,'0')}){
 const fail=(code,message)=>{throw new HttpsError(code,message);};
 const refs=request=>{const year=Number(request.data?.year);if(!Number.isInteger(year)||year<2000||year>2100)fail('invalid-argument','Bitte ein gültiges Buchhaltungsjahr angeben.');return {year,closure:db.collection('accountingYearClosures').doc(String(year)),security:db.collection('accountingYearSecurity').doc('sms-'+request.auth.uid)};};
 const requestCode=async request=>{
  const profile=await requireAdmin(request),{year,closure,security}=refs(request),phone=await resolvePhone(request.auth.uid,profile);
  if(!phone)fail('failed-precondition','Für dein Administratorkonto ist keine eindeutige gültige Mobilnummer verknüpft.');
  const now=clock(),code=makeCode(),challengeId=randomUUID(),hash=createPinRecord(code,request.auth.uid,new Date(now).toISOString());
  const result=await db.runTransaction(async tx=>{
   const [closed,previous]=await Promise.all([tx.get(closure),tx.get(security)]),old=previous.data()||{};
   if(!closed.exists)fail('failed-precondition','Dieses Jahr ist bereits offen.');
   if(Number(old.lockedUntilMs||0)>now)fail('resource-exhausted','Zu viele falsche Codes. Bitte nach 15 Minuten erneut versuchen.');
   if(now-Number(old.requestedAtMs||0)<60000)fail('resource-exhausted','Bitte vor einem neuen SMS-Code eine Minute warten.');
   const windowStart=now-Number(old.windowStartMs||0)<3600000?old.windowStartMs:now,count=windowStart===old.windowStartMs?Number(old.requestCount||0):0;
   if(count>=5)fail('resource-exhausted','Es wurden bereits fünf SMS-Codes angefordert. Bitte nach einer Stunde erneut versuchen.');
   const record={...hash,challengeId,year,closedAt:closed.data().closedAt,requestedAtMs:now,expiresAtMs:now+600000,windowStartMs:windowStart,requestCount:count+1,failedAttempts:old.lockedUntilMs&&old.lockedUntilMs<=now?0:Number(old.failedAttempts||0),lockedUntilMs:0,status:'pending'};
   if(previous.exists)tx.update(security,record);else tx.create(security,record);
   return {challengeId,expiresAtMs:record.expiresAtMs,phoneMasked:'…'+phone.slice(-4)};
  });
  let accepted=false;
  try{const sent=await sendSms({to:phone,message:'PROdigitalTV: Entsperrcode '+code+' fuer Buchhaltungsjahr '+year+'. Gueltig 10 Minuten. Nicht weitergeben.'});if(!sent?.messageId)throw Error('Keine Versandbestätigung');accepted=true;}catch(error){fail('unavailable','Der SMS-Code konnte nicht versendet werden. Bitte später erneut versuchen.');}
  finally{await db.runTransaction(async tx=>{const current=await tx.get(security);if(current.data()?.challengeId===challengeId)tx.update(security,{status:accepted?'sent':'failed'});});}
  return result;
 };
 const unlock=async request=>{
  await requireAdmin(request);const {year,closure,security}=refs(request),code=request.data?.code;
  if(typeof code!=='string'||!/^\d{6}$/.test(code))fail('invalid-argument','Bitte den sechsstelligen SMS-Code eingeben.');
  const result=await db.runTransaction(async tx=>{
   const [secret,closed]=await Promise.all([tx.get(security),tx.get(closure)]),stored=secret.data()||{},now=clock();
   if(Number(stored.lockedUntilMs||0)>now)return {error:'resource-exhausted',message:'Zu viele falsche Codes. Bitte nach 15 Minuten erneut versuchen.'};
   if(!secret.exists||stored.status!=='sent'||stored.year!==year||stored.challengeId!==request.data?.challengeId||stored.expiresAtMs<=now||!closed.exists||stored.closedAt!==closed.data().closedAt)return {error:'failed-precondition',message:'Der SMS-Code ist abgelaufen oder nicht mehr gültig. Bitte einen neuen anfordern.'};
   if(!pinMatches(code,stored)){const attempts=Number(stored.failedAttempts||0)+1;tx.update(security,{failedAttempts:attempts,lockedUntilMs:attempts>=5?now+900000:0,status:attempts>=5?'blocked':'sent'});return {error:attempts>=5?'resource-exhausted':'permission-denied',message:'Der SMS-Code ist falsch. Das Jahr bleibt abgeschlossen.'};}
   tx.update(security,{status:'used',hash:'',salt:'',failedAttempts:0,lockedUntilMs:0});tx.create(historyRef(db),{year,action:'unlock',method:'sms',at:new Date(now).toISOString(),by:request.auth.uid,closure:closed.data()});tx.delete(closure);return {year,status:'open'};
  });if(result.error)fail(result.error,result.message);return result;
 };
 return {requestCode,unlock};
}
module.exports={createAccountingYearSms};
