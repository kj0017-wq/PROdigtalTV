import {accountingLockYears} from './accountingYearClosure.js?v=8';
import {extractIban} from './bankStatementParser.js?v=6';

import {getFirebaseServices} from '../firebase/firebaseClient.js?v=3';

import {openAccountingInvoicePdf} from './accountingInvoicePdf.js?v=9';

import {openIncomingInvoicePdf} from './incomingInvoicePdf.js?v=7';

import {germanCsvDate} from './csvText.js?v=2';

import {escapeHtml} from './format.js?v=4';

import {watchAccountingCollection} from './accountingLiveUpdates.js?v=1';

import {overviewAccounts} from './accountsOverview.js?v=27';

export const partnerKey=(kind,record)=>kind+'_'+encodeURIComponent(kind==='debtor'?(record.memberId||String(record.memberName||record.name||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'')):String(record.supplier||record.name||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'')).replaceAll('.','%2E');

export function partnerPatch(record,partner){return {accountingPartnerId:partner.id,[partner.kind==='creditor'?'creditorNumber':'debtorNumber']:partner.number,...(!record.accountNumber&&partner.defaultAccountNumber?{accountNumber:partner.defaultAccountNumber}:{})};}

export async function ensureAccountingPartner(kind,record){const name=kind==='creditor'?record.supplier:record.memberName||record.name;if(!name)return null;const f=await getFirebaseServices(),ref=f.firestore.doc(f.db,'settings','accountingPartners'),id=partnerKey(kind,record);return f.firestore.runTransaction(f.db,async tx=>{const snapshot=await tx.get(ref),registry=snapshot.exists()?snapshot.data():{},partners=registry.partners||{};const iban=extractIban(record.counterpartyIban||record.iban||'');const known=iban?Object.values(partners).filter(p=>p.kind===kind&&!p.mergedInto&&p.ibans?.includes(iban)):[];if(known.length===1)return known[0];if(partners[id]){const target=partners[partners[id].mergedInto]||partners[id];if(!iban||!target.ibans?.length||target.ibans.includes(iban))return target;}const counter=kind==='creditor'?'nextCreditor':'nextDebtor',number=registry[counter]||(kind==='creditor'?70000:10000);if(!Number.isSafeInteger(number)||number>=(kind==='creditor'?100000:70000))throw Error('Nummernkreis ausgeschöpft.');const effectiveId=partners[id]?kind+'_iban_'+iban:id;const partner={id:effectiveId,ibans:iban?[iban]:[],kind,name,number:String(number),memberId:record.memberId||'',defaultAccountNumber:kind==='debtor'?'2120':'',createdAt:new Date().toISOString()};tx.set(ref,{...registry,partners:{...partners,[partner.id]:partner},[counter]:number+1});return partner;});}

export async function applyIncomingPartners(records){for(const record of records){const partner=await ensureAccountingPartner('creditor',record);if(partner)Object.assign(record,partnerPatch(record,partner));}return records;}

const partnerMoney=value=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(value/100);

export function partnerEntries(partner,{incoming=[],outgoing=[],statements=[],asOf='9999-12-31'}={}){

 const entries=[];

 for(const invoice of partner.kind==='creditor'?incoming:outgoing){

  if(invoice.archived||invoice.paymentStatus==='cancelled'||invoice.notDue||invoice.invoiceDate>asOf)continue;

  const matches=invoice.accountingPartnerId?invoice.accountingPartnerId===partner.id:partnerKey(partner.kind,invoice)===partner.id;

  if(!matches)continue;

  const match=invoice.paymentMatch,statement=match&&statements.find(item=>(item.id||item.sourceHash)===match.statementId),row=statement?.rows?.[match?.rowIndex];

  const booking=row?.date<=asOf?row:null;

  const bankPaid=booking&&(partner.kind==='creditor'?booking.amountCents<0:booking.amountCents>0);

  const paid=Boolean(bankPaid||(partner.kind==='debtor'&&invoice.paymentStatus==='paid'&&(!invoice.paidDate||invoice.paidDate<=asOf)));

  entries.push({invoice,booking,paid});

 }

 return entries.sort((a,b)=>(a.invoice.invoiceDate||'').localeCompare(b.invoice.invoiceDate||'')||String(a.invoice.invoiceNumber||'').localeCompare(String(b.invoice.invoiceNumber||'')));

}

export function partnerBalance(partner,data={}){let openCents=0,unknown=0;for(const {invoice,paid}of partnerEntries(partner,data)){if(paid)continue;if(Number.isSafeInteger(invoice.amountCents))openCents+=invoice.amountCents;else unknown++;}return {openCents,unknown};}

export function partnersMarkup(data={}){return '<section class="panel" data-accounting-partners-panel><h2>Kreditoren / Debitoren</h2><p>Standardkonten werden bei neuen Rechnungen übernommen. Das Konto jeder Rechnung bleibt einzeln änderbar.</p><p class="muted">Saldo: offene Rechnungsbeträge je Geschäftspartner bis heute, über alle Jahre. Kreditoren: noch zu zahlen · Debitoren: noch zu erhalten.</p><p data-partners-status role="status"></p><div data-partners-table></div><dialog data-partner-bookings style="width:min(1150px,96vw);max-height:90dvh;overflow:auto;border:1px solid #dce4ef;border-radius:16px;padding:20px" aria-labelledby="partner-bookings-heading"><div class="actions" style="justify-content:space-between"><h2 id="partner-bookings-heading"></h2><button type="button" class="button button--secondary" data-partner-bookings-close>Schließen</button></div><p data-partner-bookings-balance></p><div data-partner-bookings-body></div></dialog><script type="application/json" data-partners-data>'+JSON.stringify(data).replaceAll('<','\\u003c')+'</script></section>';}

export async function mountAccountingPartners(){const panel=document.querySelector('[data-accounting-partners-panel]');if(!panel||panel.parentElement.hidden)return;const status=panel.querySelector('[data-partners-status]'),table=panel.querySelector('[data-partners-table]');status.textContent='Wird geladen …';const f=await getFirebaseServices(),ref=f.firestore.doc(f.db,'settings','accountingPartners');let registry;const data=JSON.parse(panel.querySelector('[data-partners-data]').textContent);data.asOf=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

 const dialog=panel.querySelector('[data-partner-bookings]');let selectedPartner=null,selectedEntries=[];

 dialog.querySelector('[data-partner-bookings-close]').onclick=()=>dialog.close();

 const renderBookings=()=>{const partner=registry?.partners?.[selectedPartner];if(!partner)return;selectedEntries=partnerEntries(partner,data);dialog.querySelector('h2').textContent=partner.number+' · '+partner.name;const balance=partnerBalance(partner,data);dialog.querySelector('[data-partner-bookings-balance]').textContent='Offener Saldo: '+partnerMoney(balance.openCents)+(balance.unknown?' · '+balance.unknown+' Betrag nicht erfasst':'');dialog.querySelector('[data-partner-bookings-body]').innerHTML='<div class="table-wrap"><table class="table"><thead><tr><th>Konto</th><th>Rechnungsdatum</th><th>Rechnung / Beleg</th><th style="text-align:right">Betrag</th><th>Status</th><th>Zahlungsdatum</th><th>Zuordnung korrigieren</th><th style="text-align:right">Kontobuchung</th></tr></thead><tbody>'+selectedEntries.map(({invoice,booking,paid},index)=>'<tr data-accounting-lock-years="'+accountingLockYears(invoice)+'"><td>'+escapeHtml(invoice.accountNumber||'—')+'</td><td>'+escapeHtml(germanCsvDate(invoice.invoiceDate||''))+'</td><td><button type="button" class="link" data-partner-pdf="'+index+'">'+escapeHtml(invoice.invoiceNumber||invoice.sourceFileName||invoice.sourceName||'Rechnung öffnen')+'</button></td><td style="text-align:right;white-space:nowrap">'+(Number.isSafeInteger(invoice.amountCents)?partnerMoney(invoice.amountCents):'Nicht erfasst')+'</td><td>'+ (paid?'Bezahlt':'Offen')+'</td><td>'+escapeHtml(germanCsvDate(booking?.date||(paid?invoice.paidDate:'')||''))+'</td><td><select data-partner-reassign="'+index+'" aria-label="Kreditor oder Debitor korrigieren">'+Object.values(registry.partners).filter(p=>p.kind===partner.kind&&!p.mergedInto).sort((a,b)=>a.number.localeCompare(b.number)).map(p=>'<option value="'+escapeHtml(p.id)+'" '+(p.id===partner.id?'selected':'')+'>'+escapeHtml(p.number+' · '+p.name)+'</option>').join('')+'</select></td><td style="text-align:right">'+(booking?'<details><summary>'+partnerMoney(booking.amountCents)+'</summary>'+escapeHtml(booking.description||booking.name||'')+'<br>IBAN: '+escapeHtml(booking.iban||'Nicht erkannt')+'</details>':'—')+'</td></tr>').join('')+'</tbody></table></div>'+(selectedEntries.length?'':'<p>Keine Rechnungen oder zugeordneten Kontobuchungen vorhanden.</p>');};

 panel.addEventListener('click',event=>{const button=event.target.closest('[data-partner-bookings-open]');if(button){selectedPartner=button.dataset.partnerBookingsOpen;renderBookings();dialog.showModal();return;}const pdf=event.target.closest('[data-partner-pdf]');if(pdf){const entry=selectedEntries[Number(pdf.dataset.partnerPdf)],partner=registry.partners[selectedPartner];if(entry)(partner.kind==='creditor'?openIncomingInvoicePdf:openAccountingInvoicePdf)(f.auth.currentUser?.uid,entry.invoice);}});

 dialog.addEventListener('change',async event=>{const select=event.target.closest('[data-partner-reassign]');if(!select)return;const entry=selectedEntries[Number(select.dataset.partnerReassign)],old=registry.partners[selectedPartner],targetId=select.value;select.disabled=true;try{await f.firestore.runTransaction(f.db,async tx=>{const rs=await tx.get(ref),target=rs.data()?.partners?.[targetId];if(!target||target.kind!==old.kind||target.mergedInto)throw Error('Ungültige Zuordnung.');const invoiceRef=f.firestore.doc(f.db,old.kind==='creditor'?'accountingIncomingInvoices':'membershipContributions',entry.invoice.id),snap=await tx.get(invoiceRef);if(!snap.exists()||snap.data().accountingPartnerId!==old.id)throw Error('Datensatz wurde inzwischen geändert. Bitte erneut öffnen.');const match=snap.data().paymentMatch,bankRef=match?f.firestore.doc(f.db,'accountingStatements',match.statementId):null,bank=bankRef?await tx.get(bankRef):null;const patch={accountingPartnerId:target.id,[old.kind==='creditor'?'creditorNumber':'debtorNumber']:target.number,partnerAssignmentCorrection:{from:old.id,to:target.id,at:new Date().toISOString(),by:f.auth.currentUser.uid}};tx.update(invoiceRef,patch);if(bank?.exists()){const rows=bank.data().rows.slice(),row=rows[match.rowIndex];if(!row)throw Error('Kontobuchung nicht mehr vorhanden.');rows[match.rowIndex]={...row,accountingPartnerId:target.id,[old.kind==='creditor'?'creditorNumber':'debtorNumber']:target.number};tx.update(bankRef,{rows});}});Object.assign(entry.invoice,{accountingPartnerId:targetId,[old.kind==='creditor'?'creditorNumber':'debtorNumber']:registry.partners[targetId].number});status.textContent='Zuordnung korrigiert. Rechnung und Kontobuchung wurden aktualisiert.';renderBookings();}catch(error){status.textContent=error.message;select.value=old.id;}finally{select.disabled=false;}});

 const render=()=>{const partners=Object.values(registry?.partners||{}).filter(p=>!p.mergedInto).sort((a,b)=>a.number.localeCompare(b.number));table.innerHTML='<div class="table-wrap"><table class="table"><thead><tr><th>Nummer</th><th>Art</th><th>Name / IBAN</th><th>Standardkonto</th><th style="text-align:right">Offener Saldo</th></tr></thead><tbody>'+partners.map(p=>'<tr><td><button type="button" class="link" data-partner-bookings-open="'+escapeHtml(p.id)+'">'+escapeHtml(p.number)+'</button>'+'</td><td>'+(p.kind==='creditor'?'Kreditor':'Debitor')+'</td><td>'+escapeHtml(p.name)+'<br><small>'+escapeHtml((p.ibans||[]).join(' · '))+'</small></td><td>'+(p.kind==='creditor'?'<select data-partner-account="'+escapeHtml(p.id)+'" aria-label="Standardkonto für '+escapeHtml(p.name)+'"><option value="">Kein Standardkonto</option>'+overviewAccounts.map(([number,label])=>'<option value="'+number+'" '+(p.defaultAccountNumber===number?'selected':'')+'>'+number+' · '+escapeHtml(label)+'</option>').join('')+'</select>':'2120 · Echte Mitgliedsbeiträge')+'</td><td style="text-align:right;white-space:nowrap">'+(()=>{const balance=partnerBalance(p,data);return '<button type="button" class="link" data-partner-bookings-open="'+escapeHtml(p.id)+'" title="Einzelne Buchungen anzeigen">'+(balance.unknown&&balance.openCents===0?'—':partnerMoney(balance.openCents))+'</button>'+(balance.unknown?'<br><small>'+balance.unknown+' Betrag nicht erfasst</small>':'');})()+'</td></tr>').join('')+'</tbody></table></div>';if(dialog.open)renderBookings();};

 try{const snapshot=await f.firestore.getDoc(ref);registry=snapshot.exists()?snapshot.data():{};render();status.textContent='';}catch(error){status.textContent=error.message;return;}

 const stopRegistry=f.firestore.onSnapshot(ref,snapshot=>{if(!panel.isConnected)return;registry=snapshot.exists()?snapshot.data():{};render();},error=>{status.textContent=error.message;});const registryObserver=new MutationObserver(()=>{if(!panel.isConnected){stopRegistry();registryObserver.disconnect();}});registryObserver.observe(document.body,{childList:true,subtree:true});
 for(const [collection,key]of [['accountingIncomingInvoices','incoming'],['membershipContributions','outgoing'],['accountingStatements','statements']])watchAccountingCollection(panel,rows=>{data[key]=rows;render();},error=>{status.textContent='Salden konnten nicht aktualisiert werden: '+error.message;},undefined,collection).catch(error=>{status.textContent=error.message;});

 table.onchange=async event=>{const select=event.target.closest('[data-partner-account]');if(!select)return;const id=select.dataset.partnerAccount,value=select.value;select.disabled=true;try{await f.firestore.runTransaction(f.db,async tx=>{const snapshot=await tx.get(ref),current=snapshot.data(),partner=current.partners?.[id];if(!partner||partner.kind!=='creditor')throw Error('Lieferant nicht mehr vorhanden.');if(value&&!overviewAccounts.some(([number])=>number===value))throw Error('Ungültiges Konto.');if(partner.defaultAccountNumber!==registry.partners[id].defaultAccountNumber)throw Error('Standardkonto wurde inzwischen geändert. Bitte neu öffnen.');tx.update(ref,{['partners.'+id+'.defaultAccountNumber']:value});});registry.partners[id].defaultAccountNumber=value;status.textContent='Standardkonto gespeichert. Bestehende Rechnungen behalten ihr einzeln zugeordnetes Konto.';}catch(error){status.textContent=error.message;select.value=registry.partners[id].defaultAccountNumber||'';}finally{select.disabled=false;}};

}

