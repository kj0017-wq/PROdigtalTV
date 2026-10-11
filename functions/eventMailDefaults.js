const {eventLiveBounds,localDateTimeMillis}=require('./eventLiveDomain');
const VERSION=1;
function defaultEventMailPlan(event,now=Date.now()) {
 const bounds=eventLiveBounds(event);const start=bounds.start;const end=event.endDate?localDateTimeMillis(String(event.endDate).slice(0,10),event.endTime||event.end_time||'23:59',event.timeZone||event.timezone||'Europe/Berlin'):bounds.end;
 if(!start||!end||end<=now||['archived','deleted','cancelled','canceled','hidden','draft','inactive'].includes(String(event.status||'').toLowerCase()))return null;
 const date=String(event.date||event.eventDate||event.startDate||'').slice(0,10);const previous=new Date(date+'T12:00:00Z');previous.setUTCDate(previous.getUTCDate()-7);
 return {reminderAt:localDateTimeMillis(previous.toISOString().slice(0,10),event.startTime||event.start_time||event.time||'09:00',event.timeZone||event.timezone||'Europe/Berlin'),feedbackAt:end};
}
function createEventMailDefaults({db,FieldValue,Timestamp,now=Date.now}) {
 async function ensure(eventRef,settings) {
  if(!settings)settings=(await db.collection('settings').doc('eventMailDefaults').get()).data()||{};
  if(settings.enabled!==true)return;
  return db.runTransaction(async tx=>{
   const snapshot=await tx.get(eventRef);if(!snapshot.exists)return;const event=snapshot.data(),plan=defaultEventMailPlan(event,now());if(!plan)return;
   const notificationRef=db.collection('eventNotifications').doc('event-reminder-'+snapshot.id+'-reminder7d');const notification=await tx.get(notificationRef);
   const invitationRef=db.collection('eventNotifications').doc('event-invitation-'+snapshot.id+'-7days');const invitation=await tx.get(invitationRef);
   const patch={};if(event.eventMailDefaultsAppliedVersion!==VERSION)Object.assign(patch,{eventMailDefaultsAppliedVersion:VERSION,checkinWelcomeMailEnabled:true,reminder7d:true});
   if(!event.feedbackAutoSentAt&&!event.feedbackAutoSendAt&&!event.feedbackAutoScheduleStatus)Object.assign(patch,{feedbackAutoSendAt:new Date(plan.feedbackAt).toISOString(),feedbackAutoSendEnabled:true,feedbackAutoScheduleStatus:'scheduled',feedbackAutoDefaultManaged:true,feedbackScheduleRevision:0});
   else if(event.feedbackAutoDefaultManaged&& !event.feedbackAutoSentAt && event.feedbackAutoScheduleStatus==='scheduled' && !Number(event.feedbackScheduleRevision||0) && Date.parse(event.feedbackAutoSendAt)!==plan.feedbackAt)patch.feedbackAutoSendAt=new Date(plan.feedbackAt).toISOString();
   if(Object.keys(patch).length)tx.update(eventRef,{...patch,updatedAt:FieldValue.serverTimestamp()});
   if(plan.reminderAt<=now())return;
   const date=String(event.date||event.startDate||event.eventDate||'').slice(0,10).split('-').reverse().join('.');const title=event.title||'PROdigitalTV Veranstaltung';const when=date+', '+(event.startTime||event.time||'09:00')+' Uhr';
   for(const [ref,existingSnapshot,isInvitation] of [[notificationRef,notification,false],[invitationRef,invitation,true]]) {
    const text=isInvitation?('Hallo {{firstName}} {{lastName}},\n\nin einer Woche findet '+title+' statt. Wir haben noch begrenzte Plätze. Melden Sie sich jetzt an, wenn Sie teilnehmen möchten.\n\nTermin: '+when+'\n\nDas Programm und die Anmeldung finden Sie über den Veranstaltungslink.\n\nIhr PROdigitalTV-Team'):(event.reminderMail||('Hallo {{firstName}} {{lastName}},\n\nin einer Woche findet '+title+' statt. Sie sind bereits angemeldet.\n\nTermin: '+when+'\n\nWir freuen uns auf Ihre Teilnahme. Das Programm und weitere Informationen finden Sie über den Veranstaltungslink.\n\nIhr PROdigitalTV-Team'));
    const source=isInvitation?'event_mail_defaults_invitation_7days':'event_mail_defaults_7days';const content={eventTitle:title,title:(isInvitation?'Einladung: ':'Erinnerung: ')+title+' – in einer Woche',shortText:text,invitationText:text,...(!isInvitation?{registeredText:text}:{})};
    if(!existingSnapshot.exists)tx.set(ref,{id:ref.id,eventId:snapshot.id,...content,notificationKind:'event',link:'https://prodigitaltv.de/#/event/'+encodeURIComponent(snapshot.id),linkEnabled:true,channels:['mail'],recipientGroup:isInvitation?'members_contacts':'event_registered',includeMembers:isInvitation,includeContacts:isInvitation,includeRegistered:!isInvitation,includeSpeakers:isInvitation,registrationStatus:isInvitation?'unregistered':'registered',allowRegistrationCancellation:!isInvitation,sendMode:'scheduled',offsetMinutes:0,status:'scheduled',testOnly:false,source,scheduleRevision:0,scheduledAt:Timestamp.fromMillis(plan.reminderAt),createdBy:'system',createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
    else {const existing=existingSnapshot.data();if(!isInvitation&&['scheduled','paused'].includes(existing.status)&&existing.allowRegistrationCancellation!==true)tx.update(ref,{allowRegistrationCancellation:true,updatedAt:FieldValue.serverTimestamp()});if(existing.source===source&&existing.status==='scheduled'&&!Number(existing.scheduleRevision||0)&&(existing.scheduledAt?.toMillis?.()!==plan.reminderAt||existing.shortText!==text||existing.title!==content.title))tx.update(ref,{...content,scheduledAt:Timestamp.fromMillis(plan.reminderAt),updatedAt:FieldValue.serverTimestamp()});}
   }
  });
 }
 return {ensure};
}
module.exports={createEventMailDefaults,defaultEventMailPlan};
