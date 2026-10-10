import {getFirebaseServices} from './firebaseClient.js?v=2';
import {currentUser,refreshAuthToken,isMember,canUseCms} from './authService.js?v=479';
import {readStoredTicket} from './registrationService.js';
export async function openEventWithTicket(eventId){
 const user=currentUser();if(user&&(isMember(user)||canUseCms(user))){location.hash=`#/event-live/${encodeURIComponent(eventId)}`;return;}
 const ticket=readStoredTicket(eventId);if(!ticket?.ticketToken){location.hash=`#/event-live/${encodeURIComponent(eventId)}`;return;}
 const f=await getFirebaseServices();if(!f)throw new Error('Der Eventzugang ist gerade nicht erreichbar. Bitte erneut versuchen.');
 const call=f.functionsLib.httpsCallable(f.functions,'loginEventByCheckedInTicket');const input={eventId,ticketToken:ticket.ticketToken};let response=(await call(input)).data;
 if(response.requiresAccountSwitch){if(!window.confirm(`Zum Event als ${response.displayName||'ausgewählter Gast'} wechseln? Der aktuelle Zugang wird auf diesem Gerät ersetzt.`))return;response=(await call({...input,confirmAccountSwitch:true})).data;}
 if(response.requiresLogin){location.hash=`#/login?returnTo=${encodeURIComponent('event-live/'+eventId)}`;return;}
 if(!response.customToken)throw new Error('Der Zugang konnte nicht bestätigt werden. Bitte den Welcome-Code verwenden.');
 await f.authLib.setPersistence(f.auth,f.authLib.browserLocalPersistence);await f.authLib.signInWithCustomToken(f.auth,response.customToken);await refreshAuthToken(true);
 try{localStorage.setItem('pdtv-event-login-email',response.email);}catch{}
 location.hash=`#/event-live/${encodeURIComponent(eventId)}`;
}
export function mountEventTicketLogin(){
 for(const button of document.querySelectorAll('[data-ticket-event-access]')){
  if(button.dataset.mounted)continue;button.dataset.mounted='1';button.addEventListener('click',async()=>{
   const previous=button.textContent;button.disabled=true;button.textContent='Event wird geöffnet ...';let status=button.parentElement.querySelector('[data-ticket-event-access-status]');if(!status){status=document.createElement('p');status.dataset.ticketEventAccessStatus='';status.setAttribute('role','status');button.after(status);}status.textContent='';
   try{await openEventWithTicket(button.dataset.eventId);}catch(error){status.textContent=error.message||'Bitte den Code aus der Welcome-Mail verwenden.';const link=document.createElement('a');link.href=`#/event-live/${encodeURIComponent(button.dataset.eventId)}`;link.textContent=' Mit Welcome-Code anmelden';status.append(link);}finally{button.disabled=false;button.textContent=previous;}
  });
 }
}
