import {callEventModerator} from '../firebase/eventModeratorService.js?v=1';
const downloadLabel='Excel-Arbeitsmappe herunterladen';
const excelMime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export function accountingExcelExportMarkup(records=[],selectedYear=null){
 const years=[...new Set(records.filter(r=>!r.archived).flatMap(r=>[Number(r.accountingPeriodYear||r.year||String(r.invoiceDate||r.periodFrom||'').slice(0,4)),Number(String(r.periodTo||'').slice(0,4))]).filter(y=>Number.isInteger(y)&&y>=2000&&y<=2100))].sort((a,b)=>b-a);
 const current=new Date().getFullYear(),selected=years.includes(selectedYear)?selectedYear:years.includes(current)?current:years[0];
 return `<section class="panel" data-accounting-excel-panel><div class="actions" style="align-items:end"><label class="field" style="margin:0;min-width:130px">Abrechnungsjahr<select data-accounting-excel-year aria-label="Jahr für Excel-Arbeitsmappe">${years.map(y=>`<option value="${y}" ${y===selected?'selected':''}>${y}</option>`).join('')}</select></label><button type="button" class="button button--primary accounting-excel-download" data-accounting-excel-export ${years.length?'':'disabled'}><span data-accounting-excel-download-icon aria-hidden="true">↓</span><span class="accounting-excel-spinner" data-accounting-excel-spinner aria-hidden="true" hidden></span><span data-accounting-excel-button-label>${downloadLabel}</span></button><button type="button" class="button button--secondary" data-accounting-excel-share hidden>In Excel öffnen / Teilen</button></div><div class="accounting-excel-progress" data-accounting-excel-progress hidden><p data-accounting-excel-step role="status" aria-live="polite" aria-atomic="true"></p><progress max="3" data-accounting-excel-progress-bar aria-label="Fortschritt der Excel-Erstellung"></progress></div><p class="muted">Jahresübersicht, Monatsabrechnung, Bankbuchungen, Rechnungen und Mitgliederliste im Aufbau der Buchhaltungsvorlage.</p><p data-accounting-excel-status role="status" aria-live="polite" aria-atomic="true"></p></section>`;
}
export function mountAccountingExcelExport(){
 const button=document.querySelector('[data-accounting-excel-export]'),select=document.querySelector('[data-accounting-excel-year]'),status=document.querySelector('[data-accounting-excel-status]');
 if(!button||!select||!status||button.dataset.excelBound)return;
 button.dataset.excelBound='1';
 const panel=button.closest('[data-accounting-excel-panel]'),share=panel.querySelector('[data-accounting-excel-share]');
 const progress=panel.querySelector('[data-accounting-excel-progress]'),bar=panel.querySelector('[data-accounting-excel-progress-bar]'),step=panel.querySelector('[data-accounting-excel-step]');
 const label=button.querySelector('[data-accounting-excel-button-label]'),spinner=button.querySelector('[data-accounting-excel-spinner]'),icon=button.querySelector('[data-accounting-excel-download-icon]');
 let sharedFile=null;
 const paint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 const busy=value=>{button.disabled=value;select.disabled=value;button.setAttribute('aria-busy',String(value));if(spinner)spinner.hidden=!value;if(icon)icon.hidden=value;};
 const stage=(text,value)=>{if(progress)progress.hidden=false;if(step)step.textContent=text;if(bar){bar.hidden=false;if(value==null)bar.removeAttribute('value');else bar.value=value;}status.textContent='';};
 if(share)share.onclick=async()=>{if(!sharedFile)return;try{await navigator.share({files:[sharedFile],title:sharedFile.name});}catch(error){if(error.name!=='AbortError')status.textContent='Teilen konnte nicht geöffnet werden: '+error.message;}};
 select.addEventListener('change',()=>{sharedFile=null;if(share)share.hidden=true;if(progress)progress.hidden=true;status.textContent='';status.classList.remove('is-error');if(label)label.textContent=downloadLabel;});
 button.onclick=async()=>{
  if(button.disabled)return;
  const year=Number(select.value);if(!Number.isInteger(year)||year<2000||year>2100){status.textContent='Bitte ein Abrechnungsjahr auswählen.';return;}
  busy(true);sharedFile=null;if(share)share.hidden=true;status.classList.remove('is-error');if(label)label.textContent='Arbeitsmappe wird erstellt …';stage('Schritt 1 von 3: Excel-Arbeitsmappe '+year+' wird erstellt …');
  try{
   await paint();
   const result=await callEventModerator('exportAccountingExcel',{year});
   if(result.year!==year||!result.base64||!result.filename)throw Error('Der Export konnte nicht bestätigt werden.');
   if(label)label.textContent='Download wird vorbereitet …';stage('Schritt 2 von 3: Download wird vorbereitet …',2);await paint();
   const bytes=Uint8Array.from(atob(result.base64),c=>c.charCodeAt(0));
   sharedFile=new File([bytes],result.filename,{type:excelMime});
   const url=URL.createObjectURL(new Blob([bytes],{type:excelMime}));
   try{const a=document.createElement('a');a.href=url;a.download=result.filename;document.body.append(a);a.click();a.remove();}finally{setTimeout(()=>URL.revokeObjectURL(url),60000);}
   if(share)share.hidden=!navigator.canShare?.({files:[sharedFile]});
   stage('Schritt 3 von 3: Download gestartet',3);
   const counts=result.counts||{};
   status.textContent='Arbeitsmappe '+year+' erstellt: '+(counts.outgoing||0)+' Ausgangsrechnungen, '+(counts.incoming||0)+' Eingangsrechnungen und '+(counts.bookings||0)+' Bankbuchungen. Der Download wurde gestartet.';
   if(label)label.textContent='Arbeitsmappe erneut herunterladen';
  }catch(error){
   sharedFile=null;if(share)share.hidden=true;if(bar)bar.hidden=true;if(step)step.textContent='Excel-Erstellung fehlgeschlagen';
   status.classList.add('is-error');status.textContent='Excel konnte nicht erstellt werden: '+error.message;if(label)label.textContent='Erneut versuchen';
  }finally{busy(false);button.disabled=!select.options.length;}
 };
}