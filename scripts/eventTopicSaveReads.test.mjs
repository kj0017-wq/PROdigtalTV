import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const section = source.slice(source.indexOf('    const topicId = form.dataset.topicId || `topics-${crypto.randomUUID()}`;', source.indexOf('document.querySelector("#event-topic-editor-form")?.addEventListener("submit"')), source.indexOf('    if (isNewTopicForEvent && talkTopicCount >= 6', source.indexOf('document.querySelector("#event-topic-editor-form")?.addEventListener("submit"')));
const load = new Function('form', 'getOne', 'isNeutralEventProgramItem', `return (async () => { ${section}; return {existingTopic, talkTopicCount}; })()`);
test('new talk avoids loading whole database and nonexistent topic', async () => {
 const calls=[];
 await load({dataset:{topicId:'new-topic',eventId:'event',topicMode:'new'}}, async (collection,id)=>{calls.push([collection,id]);return {id,topicIds:['a','b']};},()=>false);
 assert.deepEqual(calls,[['events','event']]);
});
test('six-item limit reads only event topics and excludes neutral entries', async () => {
 const calls=[];
 const result=await load({dataset:{topicId:'new-topic',eventId:'event',topicMode:'new'}},async (collection,id)=>{calls.push([collection,id]);return collection==='events'?{id,topicIds:['a','b','c','d','e','f']}:{id,neutral:id==='f'};},item=>item.neutral);
 assert.equal(result.talkTopicCount,5);
 assert.equal(calls.length,7);
 assert.ok(calls.every(([collection,id])=>collection==='events'||['a','b','c','d','e','f'].includes(id)));
});
test('editing assigned talk skips unrelated topic queries', async () => {
 const calls=[];
 await load({dataset:{topicId:'a',eventId:'event',topicMode:'edit'}},async (collection,id)=>{calls.push([collection,id]);return collection==='events'?{id,topicIds:['a','b','c','d','e','f']}:{id};},()=>false);
 assert.deepEqual(calls,[['events','event'],['topics','a']]);
});
