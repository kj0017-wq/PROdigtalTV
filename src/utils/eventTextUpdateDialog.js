import { escapeHtml } from './format.js?v=3';
export function eventTextFacts(event = {}) {
  return {title:event.title||'',date:event.date||'',startTime:event.startTime||'',endTime:event.endTime||'',locationName:event.locationName||'',address:event.address||'',postalCode:event.postalCode||event.zipCode||'',city:event.city||'',moderators:(event.moderators||[]).map(p=>p.name).filter(Boolean),moderatorName:event.moderatorName||'',topicIds:event.topicIds||[],scheduleItems:(event.scheduleItems||[]).map(({time,title,person,type,speakerId,speakerIds,moderatorId,moderatorIds})=>({time,title,person,type,speakerId,speakerIds,moderatorId,moderatorIds}))};
}
export function eventTextsChanged(before, after) {
  return Boolean(before && after && JSON.stringify(eventTextFacts(before)) !== JSON.stringify(eventTextFacts(after)));
}
const labels={description:'Veranstaltungsbeschreibung',saveTheDateText:'Save-the-Date',invitationText:'Einladung',invitationUpdateText:'Einladungsupdate',mailText:'Anmeldebestätigung',longDescription:'Beitragsbeschreibung',shortDescription:'Kurzbeschreibung'};
export async function showEventTextUpdate({eventId,previousEvent,getOne,upsert,generate}) {
 const event=await getOne('events',eventId);
 if(!event)return;
 const dialog=document.createElement('dialog');
 dialog.className='event-text-update-dialog';
 dialog.style.cssText='width:min(900px,94vw);max-height:90dvh;overflow:auto;border:1px solid #dce4ef;border-radius:18px;padding:24px;color:#08203e';
 dialog.innerHTML=`<h2>Texte anpassen?</h2><p>Moderation oder Veranstaltungsdaten wurden geändert. Sollen Beschreibungen und Einladungstexte an die aktuellen Daten angepasst werden?</p><p><strong>${escapeHtml(event.title||'')}</strong></p><div data-update-status role="status" aria-live="polite"></div><div data-update-fields></div><div class="actions"><button type="button" class="button button--primary" data-update-generate>Texte anpassen</button><button type="button" class="button button--secondary" data-update-save hidden>Änderungen speichern</button><button type="button" class="button button--secondary" data-update-close>Später</button></div>`;
 document.body.append(dialog);dialog.showModal();
 const status=dialog.querySelector('[data-update-status]');const fields=dialog.querySelector('[data-update-fields]');
 const create=dialog.querySelector('[data-update-generate]');const save=dialog.querySelector('[data-update-save]');const close=dialog.querySelector('[data-update-close]');
 const done=new Promise(resolve=>dialog.addEventListener('close',()=>{dialog.remove();resolve();},{once:true}));
 close.onclick=()=>dialog.close();
 let drafts=[],sourceRecords=[];
 create.onclick=async()=>{
  create.disabled=true;save.hidden=true;status.textContent='KI erstellt die aktualisierten Texte …';
  try {
   const latest=await getOne('events',eventId);
   const topics=(await Promise.all((latest.topicIds||[]).map(id=>getOne('topics',id)))).filter(t=>t&&!['inactive','archived','draft','deleted','hidden'].includes(String(t.status||'').toLowerCase()));
   const speakerIds=[...new Set(topics.flatMap(t=>[t.speakerId,...(t.speakerIds||[]),t.moderatorId,...(t.moderatorIds||[])].filter(Boolean)))];
   const speakers=(await Promise.all(speakerIds.map(id=>getOne('speakers',id)))).filter(Boolean).map(({id,name,company,position})=>({id,name,company,position}));
   const context={event:eventTextFacts(latest),topics:topics.map(({id,title,speakerId,speakerIds,moderatorId,moderatorIds})=>({id,title,speakerId,speakerIds,moderatorId,moderatorIds})),speakers,previousEvent:eventTextFacts(previousEvent)};
   sourceRecords=[{collection:'events',record:latest},...topics.map(record=>({collection:'topics',record}))];
   const jobs=sourceRecords.flatMap(({collection,record})=>(collection==='events'?Object.keys(labels).slice(0,5):['longDescription','shortDescription']).filter(field=>String(record[field]||'').trim()).map(field=>({collection,id:record.id,field,original:record[field],title:labels[field]+(collection==='topics'?` – ${record.title}`:'')})));
   if(!jobs.length)throw new Error('Es sind noch keine Texte zur Überarbeitung vorhanden.');
   drafts=[];
   for(let i=0;i<jobs.length;i+=3){
    const results=await Promise.all(jobs.slice(i,i+3).map(async job=>{
     const result=await generate('improveText',{module:'event-admin',entityType:job.collection==='events'?'event':'topics',entityId:job.id,fieldName:job.field,originalText:job.original,context,prompt:'Aktualisiere diesen Text anhand der aktuellen Veranstaltungsdaten. Der bisherige Text und previousEvent können veraltet sein. Maßgeblich sind ausschließlich event, aktive topics und speakers. Entferne ausgeschiedene Personen und ausgeblendete Beiträge; übernimm aktuelle Moderatoren korrekt. Erfinde keine Personen, Rollen, Uhrzeiten oder Fakten. Schreibe kurz, sachlich und mit korrekter Rechtschreibung, in vollständigen Sätzen ohne Auslassungszeichen. Bei Einladungen und Save-the-Date müssen Eventname, Datum, Beginn, Ende, Location und vollständige Adresse enthalten sein. Bestehende Platzhalter und die Funktion einer Anmeldebestätigung erhalten. Keine zusätzliche Anrede in Einladungstexten. Kurzbeschreibung höchstens zwei Sätze.'});
     const text=result?.suggestedText||result?.text||'';if(!text.trim())throw new Error('Die KI hat keinen Text zurückgegeben.');return {...job,text};
    }));drafts.push(...results);
   }
   if(!dialog.isConnected)return;
   fields.innerHTML=drafts.map((d,i)=>`<div class="field"><label>${escapeHtml(d.title)}</label><textarea rows="6" data-update-draft="${i}" style="width:100%;box-sizing:border-box">${escapeHtml(d.text)}</textarea></div>`).join('');
   create.hidden=true;save.hidden=false;close.textContent='Abbrechen';status.textContent='Vorschläge prüfen und bei Bedarf bearbeiten. Noch nicht gespeichert.';
  }catch(error){if(dialog.isConnected)status.textContent=error.message||'Die Texte konnten nicht erstellt werden.';}
  finally{create.disabled=false;}
 };
 save.onclick=async()=>{
  save.disabled=true;close.disabled=true;status.textContent='Texte werden gespeichert …';
  try{
   // Refuse to overwrite texts edited elsewhere while this preview was open.
   const current=await Promise.all(sourceRecords.map(async source=>({...source,latest:await getOne(source.collection,source.record.id)})));
   const currentEvent=current.find(s=>s.collection==='events')?.latest;
   if(eventTextsChanged(sourceRecords[0].record,currentEvent))throw new Error('Das Programm wurde inzwischen geändert. Bitte neue Vorschläge erstellen.');
   for(const d of drafts){const source=current.find(s=>s.collection===d.collection&&s.record.id===d.id);if(!source?.latest||source.latest[d.field]!==d.original)throw new Error('Ein Text wurde inzwischen geändert. Bitte das Overlay schließen und die aktuellen Texte prüfen.');}
   const patches=new Map();
   for(const d of drafts){const value=fields.querySelector(`[data-update-draft="${drafts.indexOf(d)}"]`).value.trim();if(!value)throw new Error('Bitte keine Beschreibung leer speichern.');const key=d.collection+'/'+d.id;const entry=patches.get(key)||{collection:d.collection,patch:{id:d.id}};entry.patch[d.field]=value;if(d.field==='longDescription')entry.patch.description=value;patches.set(key,entry);}
   for(const {collection,patch}of patches.values())await upsert(collection,patch);
   for(const {collection,patch}of patches.values())if(collection==='events')for(const [name,value]of Object.entries(patch)){const input=document.querySelector(`#event-edit-form [name="${name}"]`);if(input&&typeof value==='string'){input.value=value;input.defaultValue=value;}}
   status.textContent='Alle angepassten Texte sind gespeichert.';save.hidden=true;close.textContent='Schließen';fields.querySelectorAll('textarea').forEach(f=>f.readOnly=true);
  }catch(error){status.textContent=error.message||'Speichern fehlgeschlagen.';create.hidden=false;create.textContent='Vorschläge neu erstellen';}finally{save.disabled=false;close.disabled=false;}
 };
 return done;
}
