import {getFirebaseServices} from '../firebase/firebaseClient.js?v=3';
const singles=['speakerId','moderatorId','coModeratorId'];
const arrays=['speakerIds','speakers','moderatorIds','coModeratorIds'];
const contains=(record,id)=>singles.some(key=>record[key]===id)||arrays.some(key=>Array.isArray(record[key])&&record[key].includes(id))||Boolean(record.speakerRoles?.[id]);
const eventTopic=(event,topic)=>(event.topicIds||[]).includes(topic.id)||topic.eventId===event.id||topic.linkedEventId===event.id||(topic.eventIds||[]).includes(event.id);
export function speakerEventsForRemoval(speaker,events,topics){return events.filter(event=>contains(event,speaker.id)||speaker.eventId===event.id||(speaker.eventIds||[]).includes(event.id)||topics.some(topic=>eventTopic(event,topic)&&(contains(topic,speaker.id)||speaker.topicId===topic.id||(speaker.topicIds||[]).includes(topic.id))));}
function withoutPerson(record,id){const patch={};for(const key of arrays)if(Array.isArray(record[key]))patch[key]=record[key].filter(value=>value!==id);for(const key of singles)if(record[key]===id)patch[key]=(patch[key+'s']||[])[0]||'';if(record.speakerRoles?.[id]){patch.speakerRoles={...record.speakerRoles};delete patch.speakerRoles[id];}if(Array.isArray(record.moderators))patch.moderators=record.moderators.filter(person=>person.id!==id&&person.speakerId!==id);return patch;}
export function eventSpeakerRemovalPlan(event,speaker,topics,events,cloneId=id=>id+'-copy'){
 const writes=[],replacements=new Map(),detached=new Set();
 for(const topic of topics.filter(topic=>eventTopic(event,topic))){
  if(!contains(topic,speaker.id)&&speaker.topicId!==topic.id&&!(speaker.topicIds||[]).includes(topic.id))continue;
  const shared=events.some(other=>other.id!==event.id&&eventTopic(other,topic))||(topic.eventIds||[]).some(id=>id!==event.id)||Boolean(topic.eventId&&topic.eventId!==event.id)||Boolean(topic.linkedEventId&&topic.linkedEventId!==event.id);
  if(shared){const otherIds=[...new Set([...events.filter(other=>other.id!==event.id&&eventTopic(other,topic)).map(other=>other.id),...(topic.eventIds||[]).filter(id=>id!==event.id),topic.eventId!==event.id?topic.eventId:'',topic.linkedEventId!==event.id?topic.linkedEventId:''].filter(Boolean))];const originalPatch={eventIds:otherIds};if(topic.eventId===event.id)originalPatch.eventId=otherIds[0]||'';if(topic.linkedEventId===event.id)originalPatch.linkedEventId=otherIds[0]||'';writes.push({collection:'topics',id:topic.id,data:originalPatch});const id=cloneId(topic.id);replacements.set(topic.id,id);writes.push({collection:'topics',id,create:true,data:{...topic,...withoutPerson(topic,speaker.id),id,eventId:event.id,linkedEventId:event.id,eventIds:[event.id]}});}else{detached.add(topic.id);writes.push({collection:'topics',id:topic.id,data:withoutPerson(topic,speaker.id)});}
 }
 const eventPatch={...withoutPerson(event,speaker.id),topicIds:[...new Set((event.topicIds||[]).map(id=>replacements.get(id)||id))]};
 for(const id of replacements.values())if(!eventPatch.topicIds.includes(id))eventPatch.topicIds.push(id);
 if(Array.isArray(event.scheduleItems))eventPatch.scheduleItems=event.scheduleItems.map(item=>({...item,...withoutPerson(item,speaker.id),...(item.person===speaker.name?{person:''}:{}),...(replacements.has(item.topicId)?{topicId:replacements.get(item.topicId)}:{})}));
 if(event.moderatorId===speaker.id)eventPatch.moderatorName='';
 const speakerPatch={eventIds:(speaker.eventIds||[]).filter(id=>id!==event.id),topicIds:(speaker.topicIds||[]).filter(id=>!detached.has(id))};
 if(speaker.eventId===event.id)speakerPatch.eventId='';
 if(detached.has(speaker.topicId))speakerPatch.topicId='';
 writes.push({collection:'speakers',id:speaker.id,data:speakerPatch},{collection:'events',id:event.id,data:eventPatch});
 return writes;
}
export async function removeSpeakerFromEvent(eventId,speakerId){
 const f=await getFirebaseServices(),fs=f.firestore;
 const sources=await Promise.all(['topics','events'].map(collection=>fs.getDocs(fs.collection(f.db,collection))));
 const refs=sources.flatMap(snapshot=>snapshot.docs.map(doc=>doc.ref));
 const eventRef=fs.doc(f.db,'events',eventId),speakerRef=fs.doc(f.db,'speakers',speakerId),cloneIds=new Map();
 return fs.runTransaction(f.db,async tx=>{const [eventSnapshot,speakerSnapshot,...snapshots]=await Promise.all([tx.get(eventRef),tx.get(speakerRef),...refs.map(ref=>tx.get(ref))]);if(!eventSnapshot.exists()||!speakerSnapshot.exists())throw Error('Event oder Referent nicht mehr vorhanden.');const event={...eventSnapshot.data(),id:eventId},speaker={...speakerSnapshot.data(),id:speakerId};const records=snapshots.filter(snapshot=>snapshot.exists()).map(snapshot=>({collection:snapshot.ref.parent.id,...snapshot.data(),id:snapshot.id}));const topics=records.filter(row=>row.collection==='topics').map(({collection,...row})=>row),events=records.filter(row=>row.collection==='events').map(({collection,...row})=>row);const writes=eventSpeakerRemovalPlan(event,speaker,topics,events,id=>{if(!cloneIds.has(id))cloneIds.set(id,'topics-'+crypto.randomUUID());return cloneIds.get(id);});for(const write of writes){const ref=fs.doc(f.db,write.collection,write.id),data={...write.data,updatedAt:new Date().toISOString()};if(write.create)tx.set(ref,data);else tx.update(ref,data);}return {previousEvent:event};});
}
export function mountEventSpeakerRemoval({render,updateTexts}){document.querySelectorAll('[data-remove-speaker-from-event]').forEach(button=>button.addEventListener('click',async()=>{if(!window.confirm('Referent aus diesem Event und seinen Vorträgen entfernen? Das Personenprofil bleibt gespeichert.'))return;button.disabled=true;try{const result=await removeSpeakerFromEvent(button.dataset.eventId,button.dataset.removeSpeakerFromEvent);await render();if(updateTexts)await updateTexts(button.dataset.eventId,result.previousEvent);}catch(error){button.disabled=false;window.alert(error.message||'Eventzuordnung konnte nicht entfernt werden.');}}));}
