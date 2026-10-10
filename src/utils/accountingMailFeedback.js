import {getFirebaseServices} from '../firebase/firebaseClient.js?v=3';
export function accountingMailFeedback(mail){
 if(!mail)return 'Versandstatus wird geladen …';
 const label={queued:'In Versandwarteschlange',sent:'Versendet',failed:'Versand fehlgeschlagen',skipped:'Nicht versendet'}[mail.status]||'Versandstatus unbekannt';
 return label+(mail.status==='failed'&&mail.error?' · '+mail.error:mail.status==='skipped'&&mail.skipReason?' · '+mail.skipReason:'');
}
export async function watchAccountingMail(host,id,onStatus,onError=()=>{},getServices=getFirebaseServices){
 const f=await getServices();if(!f||!host.isConnected)return ()=>{};
 let stopped=false,unsubscribe=()=>{};const observer=new MutationObserver(()=>{if(!host.isConnected)stop();});
 function stop(){if(stopped)return;stopped=true;unsubscribe();observer.disconnect();}
 observer.observe(document.body,{childList:true,subtree:true});
 unsubscribe=f.firestore.onSnapshot(f.firestore.doc(f.db,'mailQueue',id),snap=>{if(stopped||!host.isConnected){stop();return;}onStatus(snap.exists()?{id,...snap.data()}:null);},error=>{if(!stopped)onError(error);});return stop;
}
