const {createHash}=require('node:crypto');
const clean=v=>String(v??'').trim();
const digest=v=>createHash('sha256').update(v).digest('hex');
const displayName=p=>clean(p.name||[p.firstName,p.lastName].filter(Boolean).join(' '));
const identity=v=>clean(v).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(?:dr|prof|ra)\.?\s*/g,'').replace(/[^a-z0-9]/g,'');
const email=p=>clean(p.email||p.mail||p.contactEmail).toLowerCase();
const active=p=>!['inactive','archived','deleted'].includes(clean(p.status).toLowerCase());
const HEADER='\uFEFF"Vorname";"Nachname";"Unternehmen";"Rolle"\r\n';
function samePerson(a,b){return Boolean(email(a)&&email(a)===email(b))||Boolean(identity(displayName(a))&&identity(displayName(a))===identity(displayName(b)));}
function guestRole(person,{board=[],members=[],host=null}={}){
 if(board.filter(active).some(p=>samePerson(person,p)))return 'Vorstand';
 const company=clean(person.company).toLowerCase(),hostCompany=clean(host?.name||host?.company).toLowerCase();
 const hostMatch=Boolean(hostCompany&&company&&(company===hostCompany||company.startsWith(hostCompany+' ')||(company.length>=5&&hostCompany.startsWith(company+' '))));
 if(['co_host','co-host','host','co_gastgeber'].includes(person.registrationAudienceType)||['co_host','co-host','host'].includes(person.sourceGroup)||hostMatch)return 'Co-Gastgeber';
 if(person.isMember===true||person.matchedMemberId||person.registrationAudienceType==='member'||members.filter(active).some(p=>samePerson(person,p)))return 'Mitglied';
 return 'Gast';
}
function guestListCsv(registrations,context={}){
 const confirmed=registrations.filter(p=>['confirmed','checked_in','attended'].includes(p.status)&&!p.deleted&&!p.archived&&!p.inactive);
 const registeredIds=new Set(registrations.map(p=>p.id));const people=[...confirmed];
 for(const person of confirmed){const c=person.companion;if(!c||person.companionMigratedAt||person.migratedCompanionRegistrationId||registeredIds.has(person.additionalRegistrationId)||registrations.some(p=>p.primaryRegistrationId===person.id&&p.registrationRole==='additional_person'))continue;if(clean(c.firstName)||clean(c.lastName))people.push({...c,id:person.id+':companion'});}
 const rows=people.map(p=>({firstName:clean(p.firstName),lastName:clean(p.lastName),company:clean(p.company),role:guestRole(p,context)})).sort((a,b)=>a.lastName.localeCompare(b.lastName,'de')||a.firstName.localeCompare(b.firstName,'de'));
 const quote=v=>'"'+(/^[=+@-]/.test(v)?"'"+v:v).replaceAll('"','""')+'"';
 return {csv:HEADER+rows.map(p=>[p.firstName,p.lastName,p.company,p.role].map(quote).join(';')).join('\r\n')+'\r\n',guestCount:rows.length};
}
function boardRecipients(board,HttpsError){const recipients=new Map(),missing=[];for(const p of board.filter(person=>active(person)&&person.guestListMailEnabled!==false)){const to=email(p);if(!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(to))missing.push(displayName(p)||p.id);else recipients.set(to,{name:displayName(p),email:to});}if(missing.length)throw new HttpsError('failed-precondition','E-Mail-Adresse im Vorstand fehlt oder ist ungültig: '+missing.join(', '));if(!recipients.size)throw new HttpsError('failed-precondition','Keine aktiven Vorstandsmitglieder vorhanden.');return [...recipients.values()].sort((a,b)=>a.name.localeCompare(b.name,'de'));}
function createEventGuestListMail({db,FieldValue,requireEditor,HttpsError}){return async request=>{
 await requireEditor(request);const {eventId,action,requestId,fingerprint}=request.data||{};
 if(typeof eventId!=='string'||!eventId||eventId.includes('/')||eventId.length>200||!['preview','send'].includes(action))throw new HttpsError('invalid-argument','Bitte eine Veranstaltung auswählen.');
 if(action==='send'&&(typeof requestId!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(requestId)))throw new HttpsError('invalid-argument','Versandkennung fehlt.');
 const dispatch=action==='send'?db.collection('eventGuestListDispatches').doc(digest(eventId+'|'+request.auth.uid+'|'+requestId)):null;
 return db.runTransaction(async tx=>{
 const previous=dispatch?await tx.get(dispatch):null;if(previous?.exists)return previous.data().result;
 const event=await tx.get(db.collection('events').doc(eventId));if(!event.exists)throw new HttpsError('not-found','Veranstaltung fehlt.');const record=event.data();
 const regs=await tx.get(db.collection('registrations').where('eventId','==',eventId));const boards=await tx.get(db.collection('boardMembers'));const memberDocs=await tx.get(db.collection('members'));const hostDoc=record.hostId?await tx.get(db.collection('sponsors').doc(record.hostId)):null;
 const board=boards.docs.map(d=>({...d.data(),id:d.id}));const recipients=boardRecipients(board,HttpsError);const {csv,guestCount}=guestListCsv(regs.docs.map(d=>({...d.data(),id:d.id})),{board,members:memberDocs.docs.map(d=>({...d.data(),id:d.id})),host:hostDoc?.exists?hostDoc.data():null});
 if(!guestCount)throw new HttpsError('failed-precondition','Keine bestätigten Zusagen für diese Veranstaltung vorhanden.');if(Buffer.byteLength(csv)>400000)throw new HttpsError('resource-exhausted','Die Gästeliste ist zu groß.');
 const current=digest(JSON.stringify([record.title,record.date,csv,recipients]));const result={eventId,eventTitle:clean(record.title),guestCount,recipientCount:recipients.length,recipients,fingerprint:current};if(action==='preview')return result;
 if(fingerprint!==current)throw new HttpsError('failed-precondition','Gästeliste oder Vorstand hat sich geändert. Bitte Vorschau erneut öffnen.');
 const filename='Gaesteliste-'+clean(record.title||eventId).replace(/[^a-zA-Z0-9äöüÄÖÜß_-]+/g,'-').slice(0,100)+'-'+clean(record.date).replace(/[^0-9-]/g,'')+'.csv';const stamp=new Intl.DateTimeFormat('de-DE',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Berlin'}).format(new Date());
 const mailIds=recipients.map(p=>{const ref=db.collection('mailQueue').doc('board-guests-'+digest(dispatch.id+'|'+p.email));tx.create(ref,{type:'event_guest_list_csv',template:'event_guest_list_csv',to:p.email,eventId,personName:p.name,guestCount,recipientRole:'Vorstand',guestListDispatchId:dispatch.id,attachmentNames:[filename],subject:'Gästeliste als CSV an Vorstand ('+guestCount+' Gäste): '+clean(record.title).replace(/[\r\n]/g,' '),text:'Guten Tag '+p.name+',\n\nanbei die aktuelle Gästeliste für „'+clean(record.title)+'“ am '+clean(record.date)+'.\nStand: '+stamp+' Uhr.\n'+guestCount+' bestätigte Gäste.\n\nDie CSV enthält Vorname, Nachname, Unternehmen und Rolle (Gast, Mitglied, Vorstand oder Co-Gastgeber).\n\nViele Grüße\nPROdigitalTV',guestListAttachment:{filename,csvBase64:Buffer.from(csv).toString('base64'),sha256:digest(csv)},status:'queued',createdBy:request.auth.uid,createdAt:FieldValue.serverTimestamp(),queuedAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});return ref.id;});
 const sent={...result,status:'queued',mailIds};tx.create(dispatch,{eventId,createdBy:request.auth.uid,createdAt:FieldValue.serverTimestamp(),result:sent});return sent;
 });};}
function eventGuestListAttachment(mail){if(mail.template!=='event_guest_list_csv')return [];const a=mail.guestListAttachment||{},content=Buffer.from(a.csvBase64||'','base64');if(!content.length||content.length>400000||digest(content)!==a.sha256||!content.toString('utf8').startsWith(HEADER)||!/^Gaesteliste-[^/\\\r\n]+\.csv$/.test(a.filename||''))throw Error('Gästelistenanhang ist ungültig.');return [{filename:a.filename,content,contentType:'text/csv; charset=utf-8'}];}
module.exports={guestRole,guestListCsv,boardRecipients,createEventGuestListMail,eventGuestListAttachment};