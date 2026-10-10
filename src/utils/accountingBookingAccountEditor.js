import {getFirebaseServices} from '../firebase/firebaseClient.js?v=3';
import {overviewAccounts} from './accountsOverview.js?v=27';
import {escapeHtml} from './format.js?v=4';
export async function saveBookingAccount({invoice,booking,kind='incoming',assignments={}},accountNumber,getServices=getFirebaseServices){
 if(!overviewAccounts.some(([code])=>code===accountNumber))throw Error('Bitte ein Konto aus dem Kontenplan auswählen.');
 const f=await getServices();if(!f?.auth.currentUser)throw Error('Bitte erneut anmelden.');
 const realInvoice=invoice&&!invoice.missingReceipt?invoice:null,match=booking||realInvoice?.paymentMatch;
 if(!realInvoice&&!match)throw Error('Buchungsdatensatz fehlt.');
 const collection=kind==='outgoing'?'membershipContributions':'accountingIncomingInvoices',invoiceRef=realInvoice?f.firestore.doc(f.db,collection,realInvoice.id):null,bankRef=match?f.firestore.doc(f.db,'accountingStatements',match.statementId):null,settingsRef=match?f.firestore.doc(f.db,'settings','accountingBookingAccounts'):null;
 const now=new Date().toISOString(),audit={updatedAt:now,updatedBy:f.auth.currentUser.uid};
 await f.firestore.runTransaction(f.db,async tx=>{
  const [invoiceSnap,bankSnap,settingsSnap]=await Promise.all([invoiceRef?tx.get(invoiceRef):null,bankRef?tx.get(bankRef):null,settingsRef?tx.get(settingsRef):null]);
  const current=invoiceSnap?.exists()?invoiceSnap.data():null;
  if(invoiceRef&&(!current||current.archived||current.paymentStatus==='cancelled'))throw Error('Rechnung nicht mehr verfügbar.');
  if(current&&String(current.accountNumber||'')!==String(realInvoice.accountNumber||''))throw Error('Kontozuordnung wurde inzwischen geändert. Bitte erneut öffnen.');
  if(current&&JSON.stringify(current.paymentMatch||null)!==JSON.stringify(realInvoice.paymentMatch||null))throw Error('Zahlungszuordnung wurde inzwischen geändert. Bitte erneut öffnen.');
  let rows,key,saved;
  if(match){if(!bankSnap?.exists()||!Number.isInteger(match.rowIndex))throw Error('Kontobuchung nicht mehr vorhanden.');rows=bankSnap.data().rows.slice();const row=rows[match.rowIndex];if(!row||row.date!==match.date||row.amountCents!==match.amountCents)throw Error('Kontobuchung wurde inzwischen geändert. Bitte erneut öffnen.');key=match.statementId+':'+match.rowIndex;saved=settingsSnap?.exists()?settingsSnap.data().assignments||{}:{};if(String(saved[key]||'')!==String(assignments[key]||''))throw Error('Kontozuordnung wurde inzwischen geändert. Bitte erneut öffnen.');}
  if(invoiceRef)tx.update(invoiceRef,{accountNumber,...audit});
  if(bankRef){tx.set(settingsRef,{bookingKey:key,assignments:{...saved,[key]:accountNumber},...audit},{merge:true});}
 });
 return {accountNumber,...audit};
}
export function openBookingAccountEditor({invoice,booking,kind='incoming',assignments={},onSaved=()=>{}}){
 const current=invoice?.accountNumber||booking?.accountNumber||(booking?assignments[booking.statementId+':'+booking.rowIndex]:'')||(kind==='outgoing'?'2120':'');
 const dialog=document.createElement('dialog');dialog.style.cssText='width:min(540px,94vw);border:1px solid #dce4ef;border-radius:16px;padding:24px';
 dialog.innerHTML='<h2>Buchungskonto ändern</h2><p>'+escapeHtml(invoice?.memberName||invoice?.supplier||booking?.description||'Buchung')+'</p><form><label>Konto<select name="accountNumber" style="width:100%;margin:8px 0 16px">'+overviewAccounts.map(([code,label])=>'<option value="'+code+'" '+(code===current?'selected':'')+'>'+code+' · '+escapeHtml(label)+'</option>').join('')+'</select></label><p role="status" aria-live="polite"></p><div class="actions"><button type="submit" class="button button--primary">Speichern</button><button type="button" class="button button--secondary" data-close>Abbrechen</button></div></form>';
 document.body.append(dialog);dialog.showModal();dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove(),{once:true});
 dialog.querySelector('form').onsubmit=async event=>{event.preventDefault();dialog.querySelector('[role=status]').textContent='Wird gespeichert …';const controls=dialog.querySelectorAll('button,select');controls.forEach(c=>c.disabled=true);try{const patch=await saveBookingAccount({invoice,booking,kind,assignments},dialog.querySelector('select').value);if(invoice)Object.assign(invoice,patch);if(booking)booking.accountNumber=patch.accountNumber;onSaved(patch);dialog.close();}catch(error){dialog.querySelector('[role=status]').textContent=error.code==='permission-denied'?'Speichern wurde abgewiesen. Bitte erneut anmelden und noch einmal versuchen.':error.message;controls.forEach(c=>c.disabled=false);}};
}
