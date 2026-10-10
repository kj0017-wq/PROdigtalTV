import test from 'node:test';
import assert from 'node:assert/strict';
import {reminderEngagement} from '../src/utils/accountingReminderEngagement.js';
const record={reminders:[{mailId:'old',level:1,queuedAt:'2026-10-01T10:00:00Z'},{mailId:'new',level:2,queuedAt:'2026-10-07T10:00:00Z'}]};
test('only latest reminder controls opening signal',()=>{const mails=new Map([['old',{status:'sent',opened:true}],['new',{status:'sent'}]]);assert.equal(reminderEngagement(record,mails).label,'Keine Öffnung erfasst');assert.equal(reminderEngagement({...record,invoiceDispatches:[{mailId:'invoice'}]},new Map([...mails,['invoice',{status:'sent',opened:true}]] )).opened,false);});
test('timestamps render in Berlin and support Firebase Timestamp',()=>{const state=reminderEngagement(record,new Map([['new',{status:'sent',opened:true,firstOpenedAt:{toDate:()=>new Date('2026-10-07T10:05:00Z')},lastOpenedAt:'2026-10-07T11:00:00Z'}]]));assert.equal(state.label,'Mahnung geöffnet 07.10.2026, 12:05');assert.match(state.note,/13:00/);});
test('no reminder or unsuccessful dispatch stays blank',()=>{assert.equal(reminderEngagement({}).label,'');assert.equal(reminderEngagement(record,new Map([['new',{status:'failed',opened:true}]] )).label,'');});
test('timestamp or count is sufficient evidence, newest attempt wins',()=>{assert.equal(reminderEngagement(record,new Map([['new',{status:'sent',openCount:1}]] )).opened,true);assert.equal(reminderEngagement({reminders:[record.reminders[1],record.reminders[0]]},new Map([['new',{status:'sent',lastOpenedAt:{seconds:1791367500}}]])).opened,true);});
