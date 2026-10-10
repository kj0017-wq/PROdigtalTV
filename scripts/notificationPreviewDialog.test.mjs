import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmNotificationPreview } from '../src/utils/notificationPreviewDialog.js';
function setup(){let dialog;const frame={};globalThis.document={createElement:()=>dialog={style:{},setAttribute(){},querySelector:()=>frame,addEventListener:(type,handler)=>{dialog.closeHandler=handler;},showModal(){dialog.shown=true;},remove(){dialog.removed=true;}},body:{append(){}}};return {get dialog(){return dialog;},frame};}
const data={preview:{personName:'Klaus Juli',email:'klaus@example.com',mail:{subject:'Einladung',html:'<p>Guten Tag Klaus Juli</p>'},sms:'Hallo Klaus'},summary:'36 E-Mails vorbereitet'};
test('Preview shows complete rendered mail and sends only after explicit confirmation',async()=>{const state=setup();const pending=confirmNotificationPreview(data);assert.ok(state.dialog.shown);assert.equal(state.frame.srcdoc,data.preview.mail.html);assert.ok(state.dialog.innerHTML.includes('sandbox=""'));assert.ok(state.dialog.innerHTML.includes('Hallo Klaus'));state.dialog.returnValue='send';state.dialog.closeHandler();assert.equal(await pending,true);assert.ok(state.dialog.removed);});
test('Cancel and Escape never confirm sending',async()=>{for(const value of ['cancel','']){const state=setup();const pending=confirmNotificationPreview(data);state.dialog.returnValue=value;state.dialog.closeHandler();assert.equal(await pending,false);}});
test('Missing server preview prevents confirmation',async()=>{await assert.rejects(confirmNotificationPreview({preview:null}),/nicht verfügbar/);});
