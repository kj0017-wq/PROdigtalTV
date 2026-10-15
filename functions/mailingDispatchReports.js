'use strict';
const clean = value => String(value || '').trim();
const millis = value => value?.toMillis ? value.toMillis() : value?.seconds ? value.seconds * 1000 : Date.parse(value || '') || 0;
const excludedGroups = new Set(['test_group','test_person','single_person']);
function isAutomaticMailing(record = {}) {
  return !record.testOnly && !excludedGroups.has(record.recipientGroup) &&
    (['scheduled','auto_before_event'].includes(record.sendMode) || record.createdBy === 'system') &&
    (!Array.isArray(record.channels) || record.channels.includes('mail')) &&
    ['queued','failed'].includes(record.status);
}
function summarizeMailing(mails = [], expected = 0) {
  const counts = {total:Math.max(mails.length,Number(expected)||0),accepted:0,failed:0,skipped:0,bounced:0,delayed:0,pending:0};
  for(const mail of mails){
    if(mail.status==='failed')counts.failed++;
    else if(['skipped','cancelled','canceled'].includes(mail.status))counts.skipped++;
    else if(mail.status==='sent')counts.accepted++;
    else counts.pending++;
    if(mail.deliveryStatus==='bounced')counts.bounced++;
    if(mail.deliveryStatus==='delayed')counts.delayed++;
  }
  counts.pending += Math.max(0,counts.total-mails.length);
  return counts;
}
function reportText(record,counts,now){
  const time=new Date(now).toLocaleString('de-DE',{timeZone:'Europe/Berlin'});
  return [
    'Versandstatistik PROdigitalTV',record.title || 'Automatisches Mailing',
    `Stand: ${time} (Deutschland)`,
    `Empfängergruppe: ${{members:'Mitglieder',members_event_guests:'Mitglieder und ausgewählte Gäste',members_contacts:'Mitglieder und Mailingkontakte',contacts:'Mailingkontakte',event_registered:'Angemeldete Gäste',event_registered_speakers:'Gäste und Referenten',event_speakers:'Referenten'}[record.recipientGroup] || record.recipientGroup || 'Event-Empfänger'}`,
    '',`E-Mails insgesamt: ${counts.total}`,`Vom Mailserver angenommen: ${counts.accepted}`,`Fehlgeschlagen: ${counts.failed}`,`Übersprungen / abgebrochen: ${counts.skipped}`,`Noch offen: ${counts.pending}`,
    `Bekannte Rückläufer: ${counts.bounced}`,`Bekannte Zustellverzögerungen: ${counts.delayed}`,
    record.status==='failed'?'\nDer Versandauftrag wurde mit einem Fehler beendet.':'',
    counts.pending?'\nEinzelne Vorgänge sind nach 30 Minuten noch offen. Der Bericht zeigt den aktuellen Stand.':'',
    '\nDie Annahme durch den Mailserver ist keine Bestätigung der Zustellung oder des Lesens. Rückläufer können später eintreffen.',
    'Dieser Bericht wird einmal je automatischer Mailingrunde versendet.'
  ].filter(Boolean).join('\n');
}
function createMailingDispatchReports({db,FieldValue,Timestamp,now=Date.now}){
  async function sweep(){
    const config=(await db.collection('settings').doc('mailingDispatchReports').get()).data()||{};
    if(config.enabled!==true||!/^\S+@\S+\.\S+$/.test(clean(config.recipientEmail))||!millis(config.startAt))return {queued:0};
    const cutoff=Math.max(millis(config.startAt),now()-7*86400000);
    const snapshot=await db.collection('eventNotifications').where('updatedAt','>=',Timestamp.fromMillis(cutoff)).get();
    let queued=0;
    for(const document of snapshot.docs){
      const record=document.data();
      if(!isAutomaticMailing(record)||record.dispatchReportMailId)continue;
      const mails=await db.collection('mailQueue').where('notificationId','==',document.id).get();
      const counts=summarizeMailing(mails.docs.map(doc=>doc.data()),record.queuedMailCount);
      const completedAt=millis(record.processedAt)||millis(record.updatedAt);
      if(counts.pending && now()-completedAt<30*60000)continue;
      const mailRef=db.collection('mailQueue').doc(`mailing-statistics-${document.id}`);
      const didQueue=await db.runTransaction(async transaction=>{
        const [fresh,existing]=await Promise.all([transaction.get(document.ref),transaction.get(mailRef)]);
        if(!fresh.exists||fresh.data().dispatchReportMailId||existing.exists)return false;
        transaction.create(mailRef,{
          type:'mailing_dispatch_statistics',template:'mailing_dispatch_statistics',
          to:clean(config.recipientEmail).toLowerCase(),subject:`Versandstatistik: ${clean(record.title)||'Automatisches Mailing'}`,
          text:reportText(record,counts,now()),sourceNotificationId:document.id,
          status:'queued',queuedAt:FieldValue.serverTimestamp(),createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp(),statistics:counts
        });
        transaction.update(document.ref,{dispatchReportMailId:mailRef.id,dispatchReportQueuedAt:FieldValue.serverTimestamp()});
        return true;
      });
      if(didQueue)queued++;
    }
    return {queued};
  }
  return {sweep};
}
module.exports={isAutomaticMailing,summarizeMailing,reportText,createMailingDispatchReports};
