import {callEventModerator} from '../firebase/eventModeratorService.js?v=1';
import {generatedInvoiceFile} from './accountingInvoicePdfGeneration.js?v=3';
import {accountingFolderHandle} from './accountingFolders.js?v=16';
export function invoicePdfMatches(names,record){
 const number=String(record.invoiceNumber||'').trim();if(!number)throw new Error('Rechnungsnummer fehlt.');
 if(record.pdfFileName)return names.filter(name=>name===record.pdfFileName);
 const escaped=number.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const match=new RegExp(`^(?:RECHNUNG[\\s_-]+)?${escaped}(?=$|[\\s_.-])`,'i');
 return names.filter(name=>/\.pdf$/i.test(name)&&match.test(name));
}
export async function invoicePdfFile(handle,record){const files=[];for await(const [name,entry]of handle.entries())if(entry.kind==='file')files.push({name,entry});const matches=invoicePdfMatches(files.map(file=>file.name),record);if(!matches.length)throw new Error(`Keine PDF für Rechnung ${record.invoiceNumber} im zugewiesenen Ordner gefunden.`);if(matches.length>1)throw new Error(`Mehrere PDFs für Rechnung ${record.invoiceNumber} gefunden. Bitte die Dateizuordnung prüfen.`);return files.find(file=>file.name===matches[0]).entry.getFile();}
export async function loadAccountingInvoicePdf(userId,record){if(record.invoiceNeedsRegeneration)throw new Error('Rechnung geändert. Bitte zuerst PDF neu erzeugen.');if(record.invoicePdfArtifact||record.historicalImport&&record.sourcePdfArtifact)return generatedInvoiceFile(await callEventModerator('generateAccountingInvoicePdf',{action:'read',invoiceId:record.id}));return invoicePdfFile(await accountingFolderHandle(userId,'outgoing'),record);}
export async function openAccountingInvoicePdf(userId,record){
 const dialog=document.createElement('dialog');dialog.style.cssText='width:min(1100px,96vw);height:92dvh;border:1px solid #dce4ef;border-radius:16px;padding:16px';
 const heading=document.createElement('h2');heading.textContent=`Rechnung ${record.invoiceNumber}`;
 const close=document.createElement('button');close.type='button';close.className='button button--secondary';close.textContent='Schließen';close.onclick=()=>dialog.close();
 const toolbar=document.createElement('div');toolbar.className='actions';toolbar.append(heading,close);
 const message=document.createElement('p');message.setAttribute('role','status');message.textContent='PDF wird geöffnet …';
 dialog.append(toolbar,message);document.body.append(dialog);dialog.showModal();let url;
 dialog.addEventListener('close',()=>{if(url)URL.revokeObjectURL(url);dialog.remove();},{once:true});
 try{const file=await loadAccountingInvoicePdf(userId,record);if(!dialog.open)return;url=URL.createObjectURL(new Blob([file],{type:'application/pdf'}));message.remove();const download=document.createElement('a');download.className='button button--secondary';download.href=url;download.download=file.name;download.textContent='PDF herunterladen';toolbar.append(download);const frame=document.createElement('iframe');frame.title=`PDF Rechnung ${record.invoiceNumber}`;frame.src=url;frame.style.cssText='width:100%;height:calc(100% - 90px);border:0';dialog.append(frame);}catch(error){if(dialog.open)message.textContent=error.message||'Die PDF konnte nicht geöffnet werden.';}
}
