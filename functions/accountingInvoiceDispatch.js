const {assertAccountingWritable,accountingClosedYears,updateOpenAccountingRecord}=require('./accountingYearClosure');
const {invoiceContentFingerprint,resolvedInvoice}=require('./accountingInvoiceRevision');
const {createHash}=require('node:crypto');
const digest=value=>createHash('sha256').update(value).digest('hex');
function invoiceDispatchPlan(record,member={}){
 if(record.archived||record.notDue||record.paymentStatus==='cancelled')throw new Error('Diese Rechnung ist storniert oder archiviert.');
 if(!record.invoiceNumber||!Number.isSafeInteger(record.amountCents)||record.amountCents<=0||record.currency!=='EUR'||!/^\d{4}-\d{2}-\d{2}$/.test(record.invoiceDate||'')||!Number.isFinite(Date.parse(record.invoiceDate+'T12:00:00Z'))||new Date(record.invoiceDate+'T12:00:00Z').toISOString().slice(0,10)!==record.invoiceDate)throw new Error('Bitte zuerst die Rechnungsdaten vervollstaendigen.');
 const to=String(member.billingEmail||member.invoiceEmail||member.email||member.contactEmail||record.billingEmail||'').trim();
 if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(to))throw new Error('Bitte eine gueltige Rechnungs-E-Mail hinterlegen.');
 const salutation=member.personalSalutation||record.personalSalutation||`Guten Tag ${[member.firstName||record.firstName,member.lastName||record.lastName].filter(Boolean).join(' ')||record.memberName},`;
 const amount=new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(record.amountCents/100);
 const subject=`Ihre Rechnung ${record.invoiceNumber} - PROdigitalTV`;
 const text=`${salutation}\n\nim Anhang erhalten Sie Ihre Rechnung ${record.invoiceNumber} vom ${record.invoiceDate.split('-').reverse().join('.')} fuer Ihren Mitgliedsbeitrag ${record.year||''} in Hoehe von ${amount}.\n\nBitte beachten Sie die Zahlungsangaben auf der Rechnung und geben Sie bei Ihrer Ueberweisung die Rechnungsnummer ${record.invoiceNumber} als Verwendungszweck an. Falls Sie bereits bezahlt haben, ist keine erneute Zahlung erforderlich.\n\nVielen Dank fuer Ihre Mitgliedschaft und Ihre Unterstuetzung. Bei Fragen zur Rechnung helfen wir Ihnen gerne weiter.\n\nFreundliche Gruesse\nPROdigitalTV\nInteressengemeinschaft Digitale Medien e.V.`;
 return {to,subject,text,invoiceNumber:record.invoiceNumber,amountCents:record.amountCents,fingerprint:digest(JSON.stringify([record.invoiceNumber,record.invoiceDate,record.amountCents,record.paymentStatus,record.updatedAt||'',to,salutation,(record.invoiceDispatches||[]).length,record.invoiceRevision||0,record.invoiceNeedsRegeneration||false]))};
}
function invoicePdfBytes(base64){
 if(typeof base64!=='string'||!base64||base64.length>7*1024*1024||base64.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(base64))throw new Error('Ungueltiger PDF-Anhang.');
 const bytes=Buffer.from(base64,'base64');
 if(bytes.toString('base64')!==base64||bytes.length>5*1024*1024||bytes.subarray(0,5).toString()!=='%PDF-')throw new Error('Bitte eine PDF mit maximal 5 MB verwenden.');
 return bytes;
}
function createInvoiceDispatch({db,bucket,requireAdmin,HttpsError,FieldValue}){return async request=>{
 await requireAdmin(request);const input=request.data||{},id=input.invoiceId;
 if(typeof id!=='string'||!id||id.includes('/')||id.length>200||!['preview','send'].includes(input.action))throw new HttpsError('invalid-argument','Ungueltiger Rechnungsversand.');
 let pdf,storagePath;
 if(input.action==='send'){
  const source=await db.collection('membershipContributions').doc(id).get();if(source.exists)await assertAccountingWritable(db,[source.data()],HttpsError);
  if(input.pdfConfirmed!==true)throw new HttpsError('invalid-argument','Bitte den Rechnungsanhang bestaetigen.');
  try{pdf=invoicePdfBytes(input.pdfBase64);}catch(error){throw new HttpsError('invalid-argument',error.message);}
  if(typeof input.subject!=='string'||!input.subject.trim()||input.subject.length>250||/[\r\n]/.test(input.subject)||typeof input.text!=='string'||!input.text.trim()||input.text.length>20000)throw new HttpsError('invalid-argument','Bitte Betreff und Mailtext pruefen.');
  storagePath=`accounting-mail/${digest(id)}/${digest(pdf)}.pdf`;
  await bucket.file(storagePath).save(pdf,{resumable:false,contentType:'application/pdf',metadata:{metadata:{invoiceId:id,uploadedBy:request.auth.uid}}});
 }
 return db.runTransaction(async tx=>{
  const ref=db.collection('membershipContributions').doc(id),snap=await tx.get(ref);
  if(!snap.exists)throw new HttpsError('not-found','Rechnung nicht gefunden.');
  const record=snap.data();if(input.action!=='preview')await assertAccountingWritable(db,[record],HttpsError,tx);const member=record.memberId?(await tx.get(db.collection('members').doc(record.memberId))).data()||{}:{};
  let plan;try{plan=invoiceDispatchPlan(record,member);}catch(error){throw new HttpsError('failed-precondition',error.message);}
  if(input.action==='preview'){
   const history=await Promise.all((record.invoiceDispatches||[]).map(async item=>{
    const mail=await tx.get(db.collection('mailQueue').doc(item.mailId));
    return {...item,status:mail.data()?.status||'unknown'};
   }));
   return {...plan,history};
  }
  if(record.invoiceNeedsRegeneration)throw new HttpsError('failed-precondition','Rechnung wurde geändert. Bitte zuerst eine aktuelle PDF erzeugen.');
  if(record.invoicePdfArtifact&&(record.invoicePdfArtifact.sha256!==digest(pdf)||record.invoicePdfArtifact.fingerprint!==invoiceContentFingerprint(resolvedInvoice(record,member))))throw new HttpsError('failed-precondition','Die PDF gehört nicht zur aktuellen Rechnungsfassung. Bitte neu erzeugen.');
  if(input.expectedFingerprint!==plan.fingerprint)throw new HttpsError('failed-precondition','Rechnung, Empfaenger oder Versandstatus geaendert. Bitte die Vorschau neu oeffnen.');
  if((record.invoiceDispatches||[]).length>=100)throw new HttpsError('failed-precondition','Maximale Anzahl von Versandvorgaengen erreicht.');
  const now=new Date().toISOString(),mailId='accounting-invoice-'+digest(id+plan.fingerprint).slice(0,40),timestamp=FieldValue.serverTimestamp();
  const attachment={storagePath,sha256:digest(pdf),filename:`Rechnung-${record.invoiceNumber.replace(/[^a-zA-Z0-9_.-]/g,'_')}.pdf`};
  tx.create(db.collection('mailQueue').doc(mailId),{type:'accounting_invoice',template:'accounting_invoice',to:plan.to,subject:input.subject.trim(),text:input.text.trim(),invoiceAttachment:attachment,contributionId:id,invoiceRevision:record.invoiceRevision||0,invoiceAmountCents:plan.amountCents,status:'queued',queuedAt:timestamp,createdAt:timestamp,updatedAt:timestamp,createdBy:request.auth.uid});
  tx.update(ref,{invoiceNeedsRedispatch:false,invoiceDispatches:[...(record.invoiceDispatches||[]),{mailId,invoiceRevision:record.invoiceRevision||0,to:plan.to,subject:input.subject.trim(),text:input.text.trim(),attachment,queuedAt:now,queuedBy:request.auth.uid}]});
  return {mailId,status:'queued'};
 });
};}
async function invoiceMailAttachment(mail,bucket){
 if(!['accounting_invoice','accounting_reminder'].includes(mail.template))return [];
 const attachment=mail.invoiceAttachment;
 if(!attachment||!/^accounting-mail\/[a-f0-9]{64}\/[a-f0-9]{64}\.pdf$/.test(attachment.storagePath||''))throw new Error('Rechnungsanhang fehlt.');
 const [content]=await bucket.file(attachment.storagePath).download();
 if(content.length>5*1024*1024||content.subarray(0,5).toString()!=='%PDF-'||digest(content)!==attachment.sha256)throw new Error('Rechnungsanhang ist ungueltig oder wurde geaendert.');
 return [{filename:attachment.filename,content,contentType:'application/pdf'}];
}
module.exports={invoiceDispatchPlan,invoicePdfBytes,createInvoiceDispatch,invoiceMailAttachment};
