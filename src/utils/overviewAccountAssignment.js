import {getFirebaseServices} from '../firebase/firebaseClient.js?v=3';
export const bookingAccountKey=row=>`${row.statementId}:${row.rowIndex}`;
export const overviewEntryKey=entry=>entry.invoice?`invoice:${entry.invoice.kind}:${entry.invoice.id}`:`booking:${bookingAccountKey(entry.booking)}`;
export async function saveOverviewAccount(entry,accountNumber,allowed,getServices=getFirebaseServices){
 if(!allowed.includes(accountNumber))throw Error('Bitte ein gültiges Konto auswählen.');
 const f=await getServices();if(!f?.auth.currentUser)throw Error('Bitte erneut anmelden.');
 const now=new Date().toISOString(),updatedBy=f.auth.currentUser.uid;
 if(entry.invoice){const invoice=entry.invoice,collection=invoice.kind==='outgoing'?'membershipContributions':'accountingIncomingInvoices';if(!invoice.id)throw Error('Rechnungsdatensatz fehlt.');
  const patch={accountNumber,updatedAt:now,updatedBy};
  await f.firestore.runTransaction(f.db,async transaction=>{const ref=f.firestore.doc(f.db,collection,invoice.id),snapshot=await transaction.get(ref);if(!snapshot.exists())throw Error('Rechnung nicht mehr vorhanden.');const current=snapshot.data();if(current.archived||current.paymentStatus==='cancelled')throw Error('Rechnung ist archiviert oder storniert.');if(String(current.accountNumber||'')!==String(invoice.accountNumber||''))throw Error('Die Kontozuordnung wurde inzwischen geändert. Bitte den Datensatz erneut prüfen.');transaction.update(ref,patch);});
  return {collection,id:invoice.id,patch};
 }
 const row=entry.booking;if(!row?.statementId||!Number.isInteger(row.rowIndex))throw Error('Kontobuchung fehlt.');
 const key=bookingAccountKey(row),ref=f.firestore.doc(f.db,'settings','accountingBookingAccounts');
 await f.firestore.runTransaction(f.db,async transaction=>{const [saved,statement]=await Promise.all([transaction.get(ref),transaction.get(f.firestore.doc(f.db,'accountingStatements',row.statementId))]);const currentRow=statement.exists()?statement.data().rows?.[row.rowIndex]:null;if(!currentRow||currentRow.date!==row.date||currentRow.amountCents!==row.amountCents)throw Error('Kontobuchung wurde geändert. Bitte erneut öffnen.');const current=saved.exists()?saved.data().assignments||{}:{};if(current[key]&&current[key]!==accountNumber)throw Error('Diese Buchung wurde inzwischen einem Konto zugeordnet. Bitte erneut prüfen.');transaction.set(ref,{bookingKey:key,assignments:{...current,[key]:accountNumber},updatedAt:now,updatedBy},{merge:true});});
 return {bookingKey:key,accountNumber};
}
export async function watchOverviewBookingAccounts(host,onUpdate,onError){const f=await getFirebaseServices();if(!f||!host.isConnected)return;let unsubscribe=()=>{};const observer=new MutationObserver(()=>{if(!host.isConnected){unsubscribe();observer.disconnect();}});observer.observe(document.body,{childList:true,subtree:true});unsubscribe=f.firestore.onSnapshot(f.firestore.doc(f.db,'settings','accountingBookingAccounts'),snapshot=>onUpdate(snapshot.exists()?snapshot.data().assignments||{}:{}),onError);}
