const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { eventInvitationDetails } = require('./eventInvitationDetails');
const event = {id:'event-test', title:'Von den Besten lernen – München',date:'2026-10-22',startTime:'18:30',endTime:'21:30',locationName:'Hofbräukeller',address:'Innere Wiener Strasse 19',postalCode:'81667',city:'München'};
test('Complete event details independent of invitation text',()=>{
const text=eventInvitationDetails(event);
for(const part of ['Von den Besten','22. Oktober 2026','18:30 Uhr','21:30 Uhr','Hofbräukeller','Innere Wiener Strasse 19','81667 München'])assert.ok(text.includes(part),part);
});
test('Missing event details block sending with specific errors',()=>{
for(const key of ['title','date','startTime','endTime','locationName','address','postalCode','city'])assert.throws(()=>eventInvitationDetails({...event,[key]:''}),/unvollständig/);
assert.throws(()=>eventInvitationDetails({...event,startTime:'29:12'}),/Beginn/);
});
test('Virtual events do not require a postal address',()=>assert.ok(eventInvitationDetails({...event,isVirtualEvent:true,address:'',postalCode:'',city:'',onlineMeetingLabel:'Zoom'}).includes('Location: Zoom')));
test('Real mail renderer includes details in HTML and plain text; surveys stay unaffected',()=>{
const source=fs.readFileSync(__dirname+'/index.js','utf8');
const render=source.slice(source.indexOf('function renderMail('),source.indexOf('async function sendQueuedMail('));
const escape=(v)=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const context={eventInvitationDetails,clean:(v)=>String(v||'').trim(),mailTemplateSettings:()=>({}),eventUrl:()=> 'https://prodigitaltv.de/',eventMailClickTrackingUrl:()=>'',renderTemplateText:(v)=>v,notificationOptOutUrl:()=>'',textToHtml:(v)=>'<p>'+v.replace(/\n/g,'<br>')+'</p>',escapeAttribute:escape,mailHtmlShell:(title,body)=>body,mailButton:()=>''};
vm.createContext(context);vm.runInContext(render,context);
const mail={template:'event_notification',eventId:event.id,title:'Einladung',shortText:'Kurzer Einladungstext ohne Veranstaltungsdaten.',personName:'Klaus Juli'};
const result=context.renderMail(mail,{eventRecord:{...event,locationName:'Ort <Test>'}});
assert.ok(result.text.includes('18:30 Uhr'));assert.ok(result.html.includes('81667 München'));assert.ok(result.html.includes('Ort &lt;Test&gt;'));
assert.throws(()=>context.renderMail(mail,{eventRecord:{...event,address:''}}),/Straße/);
assert.doesNotThrow(()=>context.renderMail({...mail,surveyId:'survey'},{}));
});
