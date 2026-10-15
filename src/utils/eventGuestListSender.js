import {getFirebaseServices} from '../firebase/firebaseClient.js';
export function mountEventGuestListSender(scope=document){
 scope.querySelectorAll('[data-send-board-guest-list]').forEach(button=>{
 if(button.dataset.guestListBound)return;button.dataset.guestListBound='1';let requestId=null,selectedEventId=null;
 button.addEventListener('click',async()=>{
 const eventId=button.dataset.eventId||document.querySelector('[data-mobile-live-event]')?.value;const status=button.parentElement.querySelector('[data-board-guest-list-status]');
 if(!eventId){if(status)status.textContent='Bitte zuerst eine Veranstaltung auswählen.';return;}button.disabled=true;if(status)status.textContent='Gästeliste und Vorstand werden geprüft …';
 try{const firebase=await getFirebaseServices();const call=firebase.functionsLib.httpsCallable(firebase.functions,'sendEventGuestListToBoard');const preview=(await call({action:'preview',eventId})).data;
 if(!button.isConnected)return;
 if(!button.dataset.eventId&&document.querySelector('[data-mobile-live-event]')?.value!==eventId){if(status)status.textContent='Die Veranstaltung hat sich geändert. Bitte erneut öffnen.';return;}
 if(!window.confirm(`Gästeliste für „${preview.eventTitle}“ mit ${preview.guestCount} Gästen an ${preview.recipientCount} Vorstandsmitglieder senden?\n\n${preview.recipients.map(p=>p.name+' ('+p.email+')').join('\n')}\n\nCSV: Vorname, Nachname, Unternehmen und Rolle. Ohne Check-in-Status, Telefonnummern oder E-Mail-Adressen.`)){if(status)status.textContent='Versand abgebrochen.';return;}
 if(!requestId||selectedEventId!==eventId){requestId=crypto.randomUUID();selectedEventId=eventId;}
 const result=(await call({action:'send',eventId,requestId,fingerprint:preview.fingerprint})).data;
 if(status)status.textContent=`Gästeliste mit ${result.guestCount} Gästen für ${result.recipientCount} Vorstandsmitglieder zum Versand vorbereitet. Den Versandstatus findest du unter Kommunikation / Mails.`;requestId=null;
 }catch(error){if(status)status.textContent=error.message||'Gästeliste konnte nicht versendet werden.';}finally{if(button.isConnected)button.disabled=false;}
 });});
}