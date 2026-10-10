function createSmsBalance({requireEditor,HttpsError,apiUrl,apiToken,fetchImpl=fetch,clock=()=>new Date()}) {
 return async request=>{
  await requireEditor(request);
  const token=String(apiToken()||'').trim();if(!token)throw new HttpsError('failed-precondition','SMSAPI ist noch nicht eingerichtet.');
  const url=new URL('/profile',apiUrl()||'https://api.smsapi.com/sms.do');
  if(url.protocol!=='https:'||!['api.smsapi.com','api.smsapi.pl'].includes(url.hostname))throw new HttpsError('failed-precondition','Der konfigurierte SMS-Anbieter unterstützt diese Guthabenabfrage nicht.');
  try{
   const response=await fetchImpl(url,{headers:{authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)});
   const data=await response.json();
   if(!response.ok||data.error)throw new HttpsError('unavailable','SMSAPI-Guthaben konnte nicht abgefragt werden. Bitte API-Zugriff prüfen oder später erneut versuchen.');
   const points=typeof data.points==='number'?data.points:Number(data.points);
   if(data.points==null||data.points===''||!Number.isFinite(points))throw new HttpsError('unavailable','SMSAPI hat keinen gültigen Guthabenstand geliefert.');
   return {points,paymentType:String(data.payment_type||''),checkedAt:clock().toISOString()};
  }catch(error){if(error instanceof HttpsError)throw error;throw new HttpsError('unavailable','SMSAPI ist momentan nicht erreichbar. Bitte später erneut versuchen.');}
 };
}
module.exports={createSmsBalance};
