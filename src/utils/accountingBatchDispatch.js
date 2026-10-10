import {watchAccountingMail,accountingMailFeedback} from './accountingMailFeedback.js?v=1';
import {callEventModerator} from '../firebase/eventModeratorService.js?v=1';
import {accountingFolderHandle} from './accountingFolders.js?v=16';
import {loadAccountingInvoicePdf} from './accountingInvoicePdf.js?v=9';
import {escapeHtml} from './format.js?v=4';
export function selectedOutgoing(records,ids,kind){return records.filter(r=>ids.has(r.id)&&!r.archived&&!r.notDue&&r.paymentStatus!=='cancelled'&&(kind!=='reminder'||r.paymentStatus==='outstanding'));}
export async function queueAccountingMessage(call,kind,entry,values){
 const common={invoiceId:entry.record.id,expectedFingerprint:entry.plan.fingerprint};
 if(kind==='reminder'){
  await call('accountingReminder',{...common,action:'save',...values});
  return call('accountingReminder',{...common,action:'send',pdfConfirmed:true,pdfBase64:entry.pdfBase64});
 }
 return call('accountingInvoiceDispatch',{...common,action:'send',subject:values.subject,text:values.text,pdfConfirmed:true,pdfBase64:entry.pdfBase64});
}
const base64=file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('PDF konnte nicht gelesen werden.'));reader.readAsDataURL(file);});
export function openAccountingBatchDispatch(userId,records,kind='invoice'){
 if(!records.length)return;
 const reminder=kind==='reminder';const dialog=document.createElement('dialog');
 dialog.style.cssText='width:min(1100px,94vw);max-height:90dvh;overflow:auto;border:1px solid #dce4ef;border-radius:18px;padding:24px';
 dialog.innerHTML=`<h2>${reminder?'Mahnungen':'Rechnungen'} senden · Vorschau</h2><p>Jede ausgewählte Nachricht und Rechnungskopie prüfen. Bereits versendete Rechnungen können erneut versendet werden.</p><div data-batch-entries></div><p><label><input type="checkbox" data-batch-confirm> Ich habe Empfänger, Texte${reminder?' und Zahlungsfristen':''} und Rechnungs-PDFs der ausgewählten Nachrichten geprüft.</label></p><div class="actions"><button class="button button--primary" type="button" data-batch-send disabled>Ausgewählte ${reminder?'Mahnungen':'Rechnungen'} senden</button><button class="button button--secondary" type="button" data-batch-close>Schließen</button></div><p role="status" aria-live="polite" data-batch-status>Vorschauen werden geladen …</p>`;
 document.body.append(dialog);dialog.showModal();const $=s=>dialog.querySelector(s);let busy=true;const entries=[];const urls=[];
 const chosen=()=>entries.filter(e=>!e.sent&&e.node.querySelector('[data-batch-selected]').checked);
 const controls=()=>{dialog.querySelectorAll('button,input,textarea').forEach(el=>el.disabled=busy);for(const e of entries)if(e.sent)e.node.querySelectorAll('input,textarea').forEach(el=>el.disabled=true);$('[data-batch-send]').disabled=busy||!$('[data-batch-confirm]').checked||!chosen().length;};
 $('[data-batch-close]').onclick=()=>{if(!busy)dialog.close();};dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});dialog.addEventListener('close',()=>{urls.forEach(url=>URL.revokeObjectURL(url));dialog.remove();},{once:true});
 $('[data-batch-confirm]').onchange=controls;
 $('[data-batch-send]').onclick=async()=>{
  if(busy||!$('[data-batch-confirm]').checked)return;
  const pending=chosen();if(!pending.length)return;
  // Validate all editable messages before queuing the first one.
  for(const e of pending){if(!e.node.querySelector('[data-subject]').value.trim()||!e.node.querySelector('[data-text]').value.trim()){e.node.querySelector('[data-result]').textContent='Betreff und Mailtext sind erforderlich.';return;}if(reminder&&!e.node.querySelector('[data-deadline]').value){e.node.querySelector('[data-result]').textContent='Zahlungsfrist fehlt.';return;}}
  busy=true;controls();let sent=0;
  for(const [index,e]of pending.entries()){
   $('[data-batch-status]').textContent=`Versand ${index+1} von ${pending.length} …`;
   try{const values={subject:e.node.querySelector('[data-subject]').value,text:e.node.querySelector('[data-text]').value};if(reminder)values.paymentDeadline=e.node.querySelector('[data-deadline]').value;const result=await queueAccountingMessage(callEventModerator,kind,e,values);e.sent=true;sent++;e.node.querySelector('[data-batch-selected]').checked=false;e.node.querySelector('[data-result]').textContent='In Versandwarteschlange …';watchAccountingMail(e.node,result.mailId,mail=>{e.node.querySelector('[data-result]').textContent=(reminder?'Mahnstufe '+e.plan.level+' · ':'')+accountingMailFeedback(mail);e.node.querySelector('[data-result]').style.color=mail?.status==='sent'?'#087a45':mail?.status==='failed'||mail?.status==='skipped'?'#c62828':'';},error=>{e.node.querySelector('[data-result]').textContent='Versandstatus konnte nicht geladen werden: '+error.message;}).catch(error=>{e.node.querySelector('[data-result]').textContent=error.message;});}
   catch(error){e.node.querySelector('[data-result]').textContent=error.message||'Versand fehlgeschlagen. Bitte Vorschau neu öffnen.';}
  }
  busy=false;$('[data-batch-confirm]').checked=false;controls();$('[data-batch-status]').textContent=`${sent} von ${pending.length} Nachrichten an die Versandwarteschlange übergeben. Versandstatus im jeweiligen Datensatz.`;
 };
 controls();(async()=>{

  for(const [index,record]of records.entries()){
   $('[data-batch-status]').textContent=`Vorschau ${index+1} von ${records.length} laden …`;
   try{
    const plan=await callEventModerator(reminder?'accountingReminder':'accountingInvoiceDispatch',{action:'preview',invoiceId:record.id});const draft=plan.draft||plan;
    const entry={record,plan,sent:false};let pdf='';
    {const file=await loadAccountingInvoicePdf(userId,record);if(file.size>5*1024*1024)throw new Error('PDF ist größer als 5 MB.');entry.pdfBase64=await base64(file);const url=URL.createObjectURL(file);urls.push(url);pdf=`<details><summary>PDF prüfen: ${escapeHtml(file.name)}</summary><iframe title="Rechnung ${escapeHtml(plan.invoiceNumber)}" src="${url}" style="width:100%;height:400px;border:1px solid #dce4ef"></iframe></details>`;}
    const node=document.createElement('section');entry.node=node;node.className='panel';
    node.innerHTML=`<label><input type="checkbox" data-batch-selected checked> <strong>${escapeHtml(plan.invoiceNumber)} · ${escapeHtml(record.memberName)}</strong></label><p>Empfänger: <strong>${escapeHtml(plan.to)}</strong> · ${new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(plan.amountCents/100)} · ${reminder?`${plan.level}. Mahnung`:`${plan.history?.length||0} bisherige Versandaufträge`}</p><details open><summary>Mailtext bearbeiten und Vorschau prüfen</summary><div class="field"><label>Betreff</label><input data-subject maxlength="250" value="${escapeHtml(draft.subject)}"></div>${reminder?`<div class="field"><label>Zahlungsfrist</label><input type="date" data-deadline value="${escapeHtml(draft.paymentDeadline)}"></div>`:''}<div class="field"><label>Mailtext</label><textarea data-text rows="12">${escapeHtml(draft.text)}</textarea></div></details>${pdf}<p data-result role="status"></p>`;
    $('[data-batch-entries]').append(node);entries.push(entry);node.querySelector('[data-batch-selected]').onchange=()=>{$('[data-batch-confirm]').checked=false;controls();};
    let previous=draft.paymentDeadline;node.addEventListener('input',event=>{if(event.target.matches('[data-deadline]')){const next=event.target.value;if(previous&&next)node.querySelector('[data-text]').value=node.querySelector('[data-text]').value.replaceAll(previous.split('-').reverse().join('.'),next.split('-').reverse().join('.'));previous=next;}$('[data-batch-confirm]').checked=false;controls();});
   }catch(error){const node=document.createElement('p');node.textContent=`${record.invoiceNumber} · ${record.memberName}: ${error.message||'Vorschau konnte nicht geladen werden.'}`;node.style.color='#c62828';$('[data-batch-entries]').append(node);}
  }
  busy=false;controls();$('[data-batch-status]').textContent=`${entries.length} von ${records.length} Nachrichten bereit zur Prüfung. Es wurde noch nichts versendet.`;
 })();
}
