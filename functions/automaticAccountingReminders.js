const {assertAccountingWritable,accountingClosedYears,updateOpenAccountingRecord}=require('./accountingYearClosure');
const {createAccountingReminder}=require('./accountingReminders');
const {invoiceMailAttachment}=require('./accountingInvoiceDispatch');
const timestamp=value=>value?.toDate?value.toDate().toISOString():String(value||'');
const calendar=value=>{const raw=timestamp(value);return raw.includes('T')&&Number.isFinite(Date.parse(raw))?new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(raw)):raw.slice(0,10);};
const days=(now,date)=>Math.floor((Date.parse(now+'T12:00:00Z')-Date.parse(calendar(date)+'T12:00:00Z'))/86400000);
function automaticReminderDecision(record,mails,today){
 if(record.paymentStatus!=='outstanding'||record.archived||record.notDue)return {action:'skip'};
 if(record.invoiceNeedsRegeneration||record.invoiceNeedsRedispatch)return {action:'review'};
 if(Number(record.invoiceRevision||0)>0&&!(record.invoiceDispatches||[]).some(item=>Number(item.invoiceRevision||0)===Number(record.invoiceRevision)&&mails.get(item.mailId)?.status==='sent'))return {action:'review'};
 const history=record.reminders||[];
 // A pending or failed attempt must be reviewed instead of silently sending another level.
 if(history.some(item=>mails.get(item.mailId)?.status!=='sent'))return {action:'review'};
 if(history.length){const latest=[...history].sort((a,b)=>b.level-a.level)[0],mail=mails.get(latest.mailId);const elapsed=days(today,mail.sentAt||latest.queuedAt);if(latest.level>=4)return {action:elapsed>=30?'vacant':'skip'};return {action:elapsed>=30?'send':'skip',attachment:record.invoicePdfArtifact||latest.attachment};}
 const dispatched=(record.invoiceDispatches||[]).filter(item=>mails.get(item.mailId)?.status==='sent').sort((a,b)=>timestamp(mails.get(a.mailId).sentAt||a.queuedAt).localeCompare(timestamp(mails.get(b.mailId).sentAt||b.queuedAt)));
 if(!dispatched.length)return {action:'skip'};
 const first=dispatched[0],mail=mails.get(first.mailId);return {action:days(today,mail.sentAt||first.queuedAt)>=90?'send':'skip',attachment:dispatched.at(-1).attachment};
}
function createAutomaticAccountingReminders({db,bucket,HttpsError,FieldValue,logger=console}){
 const handler=createAccountingReminder({db,bucket,HttpsError,FieldValue,requireAdmin:async()=>{}});
 return async()=>{
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());const snapshot=await db.collection('membershipContributions').where('paymentStatus','==','outstanding').get();let sent=0,failed=0;
  for(const doc of snapshot.docs){const record=doc.data();if(record.archived||record.notDue)continue;try{if((await accountingClosedYears(db,[record])).length)continue;
   const mails=new Map();for(const item of [...(record.reminders||[]),...(record.invoiceDispatches||[])])mails.set(item.mailId,(await db.collection('mailQueue').doc(item.mailId).get()).data()||{});
   const decision=automaticReminderDecision(record,mails,today);
   if(decision.action==='vacant'){await updateOpenAccountingRecord(db,doc.ref,{automaticDunningStatus:'vacant'},HttpsError);continue;}
   if(decision.action==='review'){await updateOpenAccountingRecord(db,doc.ref,{automaticReminderError:'Rechnung geändert oder früherer Mahnversand ausstehend/fehlgeschlagen. Bitte Rechnung und Versandstatus prüfen.'},HttpsError);continue;}
   if(decision.action!=='send')continue;
   const attachments=await invoiceMailAttachment({template:'accounting_reminder',invoiceAttachment:decision.attachment},bucket);const pdfBase64=attachments[0].content.toString('base64');
   const call=data=>handler({auth:{uid:'system-accounting-dunning'},data:{invoiceId:doc.id,...data}});const plan=await call({action:'preview'});
   await call({action:'save',expectedFingerprint:plan.fingerprint,subject:plan.subject,text:plan.text,paymentDeadline:plan.paymentDeadline});
   await call({action:'send',expectedFingerprint:plan.fingerprint,pdfConfirmed:true,pdfBase64});sent++;
   await updateOpenAccountingRecord(db,doc.ref,{automaticReminderError:FieldValue.delete(),automaticReminderQueuedAt:FieldValue.serverTimestamp()},HttpsError);
  }catch(error){if((await accountingClosedYears(db,[record])).length)continue;failed++;logger.error('Automatischer Mahnversand fehlgeschlagen',{invoiceId:doc.id,error:error.message});await updateOpenAccountingRecord(db,doc.ref,{automaticReminderError:String(error.message||'Automatischer Mahnversand fehlgeschlagen.').slice(0,1000),automaticReminderErrorAt:FieldValue.serverTimestamp()},HttpsError);}}
  return {sent,failed};
 };
}
module.exports={automaticReminderDecision,createAutomaticAccountingReminders};
