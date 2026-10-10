import test from 'node:test';
import assert from 'node:assert/strict';
import { eventTextsChanged, eventTextFacts } from '../src/utils/eventTextUpdateDialog.js';
const event={id:'e',title:'Test',date:'2026-10-22',moderatorName:'Gerhard Fischer',moderators:[{name:'Gerhard Fischer'}],topicIds:['t'],scheduleItems:[{time:'19:30',title:'Interview',person:'Gerhard Fischer'}],invitationText:'alter Text'};
test('moderator replacement triggers review',()=>assert.equal(eventTextsChanged(event,{...event,moderatorName:'Thorsten Lork',moderators:[{name:'Thorsten Lork'}]}),true));
test('program, date and location changes trigger review',()=>{for(const change of [{topicIds:[]},{scheduleItems:[]},{date:'2026-10-23'},{address:'Neue Straße 1'}])assert.equal(eventTextsChanged(event,{...event,...change}),true);});
test('text editing and technical timestamps do not trigger another overlay',()=>assert.equal(eventTextsChanged(event,{...event,invitationText:'neuer Text',updatedAt:'now'}),false));
test('saving unchanged event does not prompt',()=>assert.equal(eventTextsChanged(event,structuredClone(event)),false));
test('AI event facts omit private moderator access data',()=>{const facts=eventTextFacts({...event,moderatorLoginEmails:['private@example.com'],moderators:[{name:'Thorsten Lork',email:'private@example.com',uid:'private-id'}]});assert.ok(!JSON.stringify(facts).includes('private'));});
import { showEventTextUpdate } from '../src/utils/eventTextUpdateDialog.js';
function dialogDocument(){
 let dialog;
 const nodes=new Map();
 function node(){return {textContent:'',disabled:false,hidden:false,readOnly:false,value:'',onclick:null};}
 const fields=node();Object.defineProperty(fields,'innerHTML',{set(value){fields.html=value;for(const match of value.matchAll(/data-update-draft="(\d+)"[^>]*>([\s\S]*?)<\/textarea>/g))nodes.set(`[data-update-draft="${match[1]}"]`,{...node(),value:match[2]});}});
 fields.querySelector=selector=>nodes.get(selector);fields.querySelectorAll=()=>[...nodes.entries()].filter(([k])=>k.startsWith('[data-update-draft')).map(([,v])=>v);
 for(const key of ['status','generate','save','close'])nodes.set(`[data-update-${key}]`,node());nodes.set('[data-update-fields]',fields);
 globalThis.document={createElement(){const events=new Map();dialog={style:{},isConnected:true,querySelector:s=>nodes.get(s),addEventListener:(name,fn)=>events.set(name,fn),showModal(){},close(){events.get('close')?.();},remove(){this.isConnected=false;}};return dialog;},body:{append(){}},querySelector(){return null;}};
 return {nodes,get dialog(){return dialog;}};
}
test('overlay waits for consent; cancel never generates or saves',async()=>{
 const ui=dialogDocument();let writes=0,calls=0;
 const task=showEventTextUpdate({eventId:'e',previousEvent:event,getOne:async()=>event,upsert:async()=>writes++,generate:async()=>calls++});
 await new Promise(resolve=>setTimeout(resolve,0));ui.nodes.get('[data-update-close]').onclick();await task;
 assert.equal(writes,0);assert.equal(calls,0);
});
test('AI suggestions remain drafts until save is clicked',async()=>{
 const ui=dialogDocument();const writes=[];let calls=0;
 const record={id:'e',title:'Event',date:'2026-10-22',description:'Original',topicIds:[]};
 const task=showEventTextUpdate({eventId:'e',previousEvent:record,getOne:async()=>record,upsert:async(c,p)=>writes.push([c,p]),generate:async()=>{calls++;return {suggestedText:'Überarbeiteter Text'};}});
 await new Promise(resolve=>setTimeout(resolve,0));await ui.nodes.get('[data-update-generate]').onclick();assert.equal(calls,1);assert.equal(writes.length,0);
 await ui.nodes.get('[data-update-save]').onclick();assert.deepEqual(writes,[['events',{id:'e',description:'Überarbeiteter Text'}]]);
 ui.nodes.get('[data-update-close]').onclick();await task;
});
test('concurrent event edits block saving outdated draft',async()=>{
 const ui=dialogDocument();const record={id:'e',title:'Event',date:'2026-10-22',description:'Original',topicIds:[]};let current=record,writes=0;
 const task=showEventTextUpdate({eventId:'e',previousEvent:record,getOne:async()=>current,upsert:async()=>writes++,generate:async()=>({suggestedText:'Vorschlag'})});
 await new Promise(resolve=>setTimeout(resolve,0));await ui.nodes.get('[data-update-generate]').onclick();current={...record,date:'2026-10-23'};await ui.nodes.get('[data-update-save]').onclick();assert.equal(writes,0);assert.match(ui.nodes.get('[data-update-status]').textContent,/inzwischen geändert/);
 ui.nodes.get('[data-update-close]').onclick();await task;
});
