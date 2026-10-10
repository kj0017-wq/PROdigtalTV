import { getFirebaseServices } from './firebaseClient.js?v=2';
export function mountSmsBalance(root=document){
 root.querySelectorAll('[data-sms-balance]').forEach(panel=>{
  if(panel.dataset.wired==='1')return;panel.dataset.wired='1';
  const button=panel.querySelector('[data-sms-balance-refresh]'),value=panel.querySelector('[data-sms-balance-value]'),status=panel.querySelector('[data-sms-balance-status]');
  const refresh=async()=>{if(button.disabled)return;button.disabled=true;status.textContent='Guthaben wird abgefragt ...';try{const firebase=await getFirebaseServices();if(!firebase)throw Error('Der Dienst ist momentan nicht erreichbar.');const {data}=await firebase.functionsLib.httpsCallable(firebase.functions,'getSmsAccountBalance')({});value.textContent=new Intl.NumberFormat('de-DE',{maximumFractionDigits:3}).format(data.points)+' Guthabenpunkte';const time=new Intl.DateTimeFormat('de-DE',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Berlin'}).format(new Date(data.checkedAt));status.textContent='Stand: '+time+(data.paymentType==='prepaid'?' · Prepaid':'');}catch(error){status.textContent=error.message||'Guthaben konnte nicht geladen werden.';}finally{button.disabled=false;}};
  button.addEventListener('click',refresh);refresh();
 });
}
