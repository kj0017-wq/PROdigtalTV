import {callEventModerator} from '../firebase/eventModeratorService.js?v=1';
export function mountAccountingPdfExport(){
 const button=document.querySelector('[data-accounting-pdf-export]'),status=document.querySelector('[data-accounting-pdf-export-status]');if(!button)return;
 button.onclick=async()=>{button.disabled=true;status.textContent='Alle Buchhaltungsdaten werden als PDF erstellt …';try{const result=await callEventModerator('exportAccountingPdf',{}),bytes=Uint8Array.from(atob(result.base64),c=>c.charCodeAt(0)),url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));const a=document.createElement('a');a.href=url;a.download=result.filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);status.textContent='PDF mit Ausgangsrechnungen, Eingangsrechnungen, Kontobuchungen und Kontenübersicht erstellt.';}catch(error){status.textContent='PDF konnte nicht erstellt werden: '+error.message;}finally{button.disabled=false;}};
}

export function mountAccountsOverviewPdfExport(){
 const button=document.querySelector('[data-overview-pdf-export]'),status=document.querySelector('[data-accounting-pdf-export-status]');if(!button)return;
 button.onclick=async()=>{const year=Number(document.querySelector('[data-overview-year]').value),asOf=document.querySelector('[data-overview-date]').value;button.disabled=true;status.textContent='Übersicht wird als PDF erstellt …';try{const result=await callEventModerator('exportAccountingPdf',{mode:'overview',year,asOf}),bytes=Uint8Array.from(atob(result.base64),c=>c.charCodeAt(0)),url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));const a=document.createElement('a');a.href=url;a.download=result.filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);status.textContent='Übersicht auf einer A4-Seite erstellt.';}catch(error){status.textContent='PDF konnte nicht erstellt werden: '+error.message;}finally{button.disabled=false;}};
}
