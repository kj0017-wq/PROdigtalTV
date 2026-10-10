const test=require("node:test"),assert=require("node:assert/strict");
const {createEventChatAttachments,removeChatAttachment}=require("./eventChatAttachments");
function fixture(){
 const store=new Map(),files=new Map();let counter=0;
 const ref=path=>({path,id:path.split("/").at(-1),doc:id=>ref(path+"/"+(id||"generated"+(++counter))),
  collection:name=>ref(path+"/"+name),get:async()=>({exists:store.has(path),data:()=>store.get(path)}),
  set:async value=>store.set(path,value),delete:async()=>store.delete(path)});
 const db={collection:ref,runTransaction:async action=>action({get:r=>r.get(),set:(r,value,options)=>store.set(r.path,options?.merge?{...store.get(r.path),...value}:value)})};
 class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
 const bucket={file:path=>({path,getMetadata:async()=>{if(!files.has(path))throw new Error("Missing upload");return[files.get(path)];},
 setMetadata:async()=>{},delete:async()=>files.delete(path)})};
 const viewer=req=>{if(!["anna","bert","cara"].includes(req.auth?.uid))throw new HttpsError("permission-denied","Not present");return{contactId:req.auth.uid};};
 const access=async req=>{
  const v=viewer(req);const peer=req.data.peerId;
  if(!["anna","bert","cara"].includes(peer)||peer===v.contactId||req.data.eventId!=="event")throw new HttpsError("permission-denied","No event access");
  const participants=[v.contactId,peer].sort();
  return{viewer:v,peerId:peer,participants,thread:ref("events/event/threads/"+participants.join("-"))};
 };
 const groupAccess=async req=>{const v=viewer(req);if(req.data.eventId!=="event")throw new HttpsError("permission-denied","Wrong event");return{viewer:v,group:ref("events/event/groups/everyone")};};
 const service=createEventChatAttachments({db,bucket,messages:{access,groupAccess},eventLiveUser:async(req,eventId)=>{if(eventId!=="event")throw new HttpsError("permission-denied","Wrong event");return viewer(req);},FieldValue:{serverTimestamp:()=>"now"},HttpsError});
 const request=(data={},uid="anna")=>({auth:{uid},data:{eventId:"event",peerId:"bert",channel:"private",fileName:"foto.jpg",fileType:"image/jpeg",fileSize:100,...data}});
 const upload=async(data={})=>{const intent=await service.begin(request(data));files.set(intent.storagePath,{size:data.fileSize||100,contentType:data.fileType||"image/jpeg"});return intent;};
 return{store,files,db,bucket,service,request,upload};
}
test("upload intents enforce checked-in chat access, supported types and media size",async()=>{
 const{service,request}=fixture();
 await assert.rejects(service.begin(request({},"outsider")),{code:"permission-denied"});
 await assert.rejects(service.begin(request({eventId:"other"})),{code:"permission-denied"});
 await assert.rejects(service.begin(request({fileType:"text/html"})),{code:"invalid-argument"});
 await assert.rejects(service.begin(request({fileSize:16*1024*1024})),{code:"invalid-argument"});
 await assert.rejects(service.begin(request({fileType:"video/mp4",fileSize:51*1024*1024})),{code:"invalid-argument"});
 await assert.rejects(service.begin(request({adminTestContactId:"bert"})),{code:"permission-denied"});
});
test("finished private attachments are visible only to their two participants and finish is idempotent",async()=>{
 const{service,request,upload,store}=fixture(),intent=await upload();
 const result=await service.finish(request({attachmentId:intent.attachmentId,text:"Foto"}));
 await service.finish(request({attachmentId:intent.attachmentId,text:"Foto"}));
 assert.equal([...store.keys()].filter(key=>key.includes("/messages/")).length,1);
 assert.equal(result.id,"attachment-"+intent.attachmentId);
 assert.equal((await service.read({uid:"bert"},intent.attachmentId)).fileType,"image/jpeg");
 await assert.rejects(service.read({uid:"cara"},intent.attachmentId),{code:"permission-denied"});
 await assert.rejects(service.finish(request({attachmentId:intent.attachmentId},"bert")),{code:"permission-denied"});
});
test("upload metadata must match intent; unpublished uploads cannot be retrieved",async()=>{
 const{service,request,upload,files}=fixture(),intent=await upload();
 await assert.rejects(service.read({uid:"anna"},intent.attachmentId),{code:"not-found"});
 files.set(intent.storagePath,{size:101,contentType:"image/jpeg"});
 await assert.rejects(service.finish(request({attachmentId:intent.attachmentId})),{code:"failed-precondition"});
});
test("group videos are available to checked-in event members, never outsiders",async()=>{
 const{service,request,upload}=fixture(),intent=await upload({channel:"group",fileType:"video/mp4"});
 await service.finish(request({channel:"group",attachmentId:intent.attachmentId}));
 assert.equal((await service.read({uid:"cara"},intent.attachmentId)).fileType,"video/mp4");
 await assert.rejects(service.read({uid:"outsider"},intent.attachmentId),{code:"permission-denied"});
});
test("deleted messages revoke attachment access and storage cleanup removes the uploaded file",async()=>{
 const{service,request,upload,store,files,db,bucket}=fixture(),intent=await upload();
 const result=await service.finish(request({attachmentId:intent.attachmentId}));
 const path="events/event/threads/anna-bert/messages/"+result.id;
 const message=store.get(path);store.set(path,{...message,deleted:true});
 await assert.rejects(service.read({uid:"bert"},intent.attachmentId),{code:"not-found"});
 await removeChatAttachment({db,bucket},message);
 assert.equal(files.has(intent.storagePath),false);
 assert.equal(store.has("eventChatAttachments/"+intent.attachmentId),false);
});
