const {assertAccountingWritable,accountingClosedYears,updateOpenAccountingRecord}=require('./accountingYearClosure');
const {invoiceContentFingerprint,resolvedInvoice}=require('./accountingInvoiceRevision');
const {createHash}=require('node:crypto');
const {invoicePdfBytes}=require('./accountingInvoiceDispatch');
const digest=value=>createHash('sha256').update(value).digest('hex');
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const date=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
const format=value=>value.split('-').reverse().join('.');
function reminderPlan(record,member={},today=new Date().toISOString().slice(0,10)){
 if(record.invoiceNeedsRegeneration||record.invoiceNeedsRedispatch)throw new Error('Geänderte Rechnung bitte zuerst neu erstellen und versenden.');
 if(record.paymentStatus!=='outstanding'||record.archived||record.notDue)throw new Error('Nur offene Rechnungen koennen angemahnt werden. Zahlungsstatus bitte zuerst pruefen.');
 if(!record.invoiceNumber||!date(record.invoiceDate||'')||record.invoiceDate>today||!Number.isSafeInteger(record.amountCents)||record.amountCents<=0||record.currency!=='EUR')throw new Error('Rechnungsnummer, Datum oder Betrag sind ungueltig.');
 if(record.dueDate&&(!date(record.dueDate)||record.dueDate>=today))throw new Error('Die Rechnung ist noch nicht ueberfaellig oder das Faelligkeitsdatum ist ungueltig.');
 const to=String(member.billingEmail||member.invoiceEmail||member.email||member.contactEmail||record.billingEmail||'').trim();
 if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(to))throw new Error('Bitte eine gueltige Rechnungs-E-Mail hinterlegen.');
 const name=member.personalSalutation||record.personalSalutation||`Guten Tag ${[member.firstName||record.firstName,member.lastName||record.lastName].filter(Boolean).join(' ')||record.memberName},`;
 const level=(record.reminders||[]).length+1;
 if(level>4)throw new Error('Mahnstufe 4 wurde bereits erreicht. Keine weitere Mahnung vorgesehen.');
 const amount=new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(record.amountCents/100);
 const paymentDeadline=new Date(Date.parse(today+'T12:00:00Z')+14*86400000).toISOString().slice(0,10);
 const subject=`${level===1?'Zahlungserinnerung':level+'. Mahnung'} zur Rechnung ${record.invoiceNumber} - PROdigitalTV`;
 const text=`${name}\n\nzu unserer Rechnung ${record.invoiceNumber} vom ${format(record.invoiceDate)} ueber ${amount} fuer Ihren Mitgliedsbeitrag ${record.year||''} ist bislang kein vollstaendiger Zahlungseingang erfasst.\n\nEine Kopie der Rechnung finden Sie im Anhang.\n\nBitte ueberweisen Sie den offenen Betrag von ${amount} bis zum ${format(paymentDeadline)} auf das in der Rechnung angegebene Konto. Geben Sie als Verwendungszweck bitte die Rechnungsnummer ${record.invoiceNumber} an.\n\nSollten Sie die Zahlung bereits veranlasst haben, betrachten Sie diese Nachricht bitte als gegenstandslos und senden Sie uns einen kurzen Hinweis, damit wir den Zahlungseingang zuordnen koennen. Bei Fragen zur Rechnung helfen wir Ihnen gerne weiter.\n\nVielen Dank und freundliche Gruesse\nPROdigitalTV\nInteressengemeinschaft Digitale Medien e.V.`;
 return {to,subject,text,paymentDeadline,level,invoiceNumber:record.invoiceNumber,amountCents:record.amountCents,fingerprint:hash([record.invoiceNumber,record.invoiceDate,record.amountCents,record.paymentStatus,record.dueDate||'',to,name,level,record.updatedAt||''])};
}
function createAccountingReminder({db,bucket,requireAdmin,HttpsError,FieldValue}){return async request=>{
 await requireAdmin(request);
 const input=request.data||{},id=input.invoiceId;
 if(typeof id!=='string'||!id||id.includes('/')||id.length>200||!['preview','save','send'].includes(input.action))throw new HttpsError('invalid-argument','Ungueltige Mahnungsanfrage.');
 let pdf,storagePath;
 if(input.action==='send'){
  const source=await db.collection('membershipContributions').doc(id).get();if(source.exists)await assertAccountingWritable(db,[source.data()],HttpsError);
  if(input.pdfConfirmed!==true)throw new HttpsError('invalid-argument','Bitte die Rechnungskopie als PDF prüfen und bestätigen.');
  try{pdf=invoicePdfBytes(input.pdfBase64);}catch(error){throw new HttpsError('invalid-argument',error.message);}
  storagePath=`accounting-mail/${digest(id)}/${digest(pdf)}.pdf`;
  await bucket.file(storagePath).save(pdf,{resumable:false,contentType:'application/pdf',metadata:{metadata:{invoiceId:id,uploadedBy:request.auth.uid}}});
 }
 return db.runTransaction(async tx=>{
  const ref=db.collection('membershipContributions').doc(id),snapshot=await tx.get(ref);
  if(!snapshot.exists)throw new HttpsError('not-found','Rechnung nicht gefunden.');
  const record=snapshot.data();if(input.action!=='preview')await assertAccountingWritable(db,[record],HttpsError,tx);
  const member=record.memberId?(await tx.get(db.collection('members').doc(record.memberId))).data()||{}:{};
  let plan;try{plan=reminderPlan(record,member);}catch(error){throw new HttpsError('failed-precondition',error.message);}
  if(input.action==='preview'){
   const history=await Promise.all((record.reminders||[]).map(async item=>{const mail=await tx.get(db.collection('mailQueue').doc(item.mailId));return {...item,status:mail.data()?.status||'unknown'};}));
   return {...plan,draft:record.reminderDraft?.fingerprint===plan.fingerprint?record.reminderDraft:null,history};
  }
  if(record.invoicePdfArtifact?.fingerprint&&record.invoicePdfArtifact.fingerprint!==invoiceContentFingerprint(resolvedInvoice(record,member)))throw new HttpsError('failed-precondition','Rechnungsdaten wurden geändert. Bitte die Rechnung neu erzeugen und versenden.');
  if(input.expectedFingerprint!==plan.fingerprint)throw new HttpsError('failed-precondition','Rechnung oder Empfaenger wurde geaendert. Bitte die Mahnung neu oeffnen.');
  const now=new Date().toISOString();
  if(input.action==='save'){
   const subject=String(input.subject||'').trim(),text=String(input.text||'').trim(),paymentDeadline=String(input.paymentDeadline||'');
   if(!subject||subject.length>250||/[\r\n]/.test(subject)||!text||text.length>20000||!date(paymentDeadline)||paymentDeadline<=now.slice(0,10))throw new HttpsError('invalid-argument','Betreff, Text und eine zukuenftige Zahlungsfrist sind erforderlich.');
   const draft={...plan,subject,text,paymentDeadline,savedAt:now,savedBy:request.auth.uid};
   tx.update(ref,{reminderDraft:draft});return {draft};
  }
  const draft=record.reminderDraft;
  if(!draft||draft.fingerprint!==plan.fingerprint||draft.paymentDeadline<=now.slice(0,10))throw new HttpsError('failed-precondition','Bitte zuerst einen aktuellen Mahnungsentwurf speichern.');
  if((record.reminders||[]).length>=100)throw new HttpsError('failed-precondition','Maximale Anzahl von Mahnungen erreicht.');
  const mailId=`accounting-reminder-${hash([id,plan.level]).slice(0,40)}`;
  const attachment={storagePath,sha256:digest(pdf),filename:`Rechnung-${record.invoiceNumber.replace(/[^a-zA-Z0-9_.-]/g,'_')}.pdf`};
  const timestamp=FieldValue?.serverTimestamp()||now;
  tx.create(db.collection('mailQueue').doc(mailId),{type:'accounting_reminder',template:'accounting_reminder',invoiceAttachment:attachment,to:plan.to,subject:draft.subject,text:draft.text,status:'queued',queuedAt:timestamp,createdAt:timestamp,updatedAt:timestamp,createdBy:request.auth.uid,contributionId:id,invoiceRevision:record.invoiceRevision||0,reminderLevel:plan.level,invoiceAmountCents:plan.amountCents});
  const reminder={mailId,attachment,level:plan.level,to:plan.to,subject:draft.subject,text:draft.text,paymentDeadline:draft.paymentDeadline,queuedAt:now,queuedBy:request.auth.uid};
  tx.update(ref,{reminders:[...(record.reminders||[]),reminder],reminderDraft:null});
  return {mailId,status:'queued',level:plan.level};
 });
};}
module.exports={reminderPlan,createAccountingReminder};
