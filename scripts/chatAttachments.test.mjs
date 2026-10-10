import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const source=readFileSync(new URL("../src/utils/chatAttachments.js",import.meta.url),"utf8").replace(/^import .*;\r?\n/gm,"").replaceAll("export function","function");
function fixture(peerId="bert",hosts=[],fetchMedia){
 const calls=[],events=new Map(),menuEvents=new Map();
 const plus={setAttribute(){}},contactButton={},input={files:[],click(){calls.push("picker");}},menu={hidden:true,addEventListener:(name,fn)=>menuEvents.set(name,fn)};
 const remove={};
 const picker={querySelector:selector=>selector===".chat-attach-plus"?plus:selector===".chat-attach-menu"?menu:selector==="input"?input:contactButton,addEventListener(){}};
 const preview={querySelector:()=>remove,replaceChildren(){},prepend(node){calls.push({preview:node});}};
 const field={required:true,value:"",focus(){},dispatchEvent(){}},send={disabled:false,textContent:"↑"};
 const form={isConnected:true,elements:{message:field},querySelector:()=>send,classList:{add(){}},prepend(node){assert.equal(node,picker);},before(){},addEventListener:(name,fn)=>events.set(name,fn),requestSubmit(){calls.push("requested");return events.get("submit")({preventDefault(){},stopImmediatePropagation(){calls.push("stopped");}});}};
 const list={isConnected:true,addEventListener(){},querySelectorAll:()=>hosts},status={};
 let elements=0;
 const firebase={functions:{},functionsLib:{httpsCallable:(_,name)=>async data=>{calls.push({name,data});return{data:name==="beginEventChatAttachment"?{attachmentId:"id",storagePath:"path"}:{id:"attachment-id"}};}},
 auth:{currentUser:{getIdToken:async()=>"token"}},storage:{},storageLib:{ref:(_,path)=>path,uploadBytes:async(...args)=>calls.push({upload:args})}};
 const context={URL:{createObjectURL:file=>{calls.push({previewFile:file});return "blob:preview";},revokeObjectURL:url=>calls.push({revoked:url})},document:{body:{},createElement:()=>++elements===1?picker:elements===2?preview:{dataset:{},setAttribute(){},append(){}}},Event,
 fetch:fetchMedia,MutationObserver:class{constructor(fn){context.refresh=fn;}observe(){}disconnect(){}},getFirebaseServices:async()=>firebase,
 escapeHtml:value=>String(value||"").replaceAll("<","&lt;"),requestEventLiveContact:async(eventId,id)=>{calls.push({contact:id});return{status:"pending"};}};
 vm.createContext(context);vm.runInContext(source,context);
 context.mountChatAttachments({form,list,eventId:"event",peerId,status,contacts:()=>[{contactId:"bert"}],onSent:()=>calls.push("sent")});
 return{calls,input,menuEvents,events,field,send,contactButton,plus,context};
}
test("a selected photo is sent immediately without another tap",async()=>{
 const f=fixture();assert.equal(f.contactButton.hidden,false);
 f.input.files=[{name:"test.jpg",type:"image/jpeg",size:100}];await f.input.onchange();
 assert.equal(f.calls.find(call=>call.preview)?.preview.src,"blob:preview");
 assert.equal(f.calls.find(call=>call.preview)?.preview.alt,"Vorschau: test.jpg");
 assert.equal(f.calls.includes("requested"),true);
 assert.equal(f.calls.includes("stopped"),true);
 assert.deepEqual(f.calls.filter(call=>call.name).map(call=>call.name),["beginEventChatAttachment","finishEventChatAttachment"]);
 assert.equal(f.calls.find(call=>call.name==="finishEventChatAttachment").data.text,"");
 assert.equal(f.calls.filter(call=>call.upload).length,1);
 assert.equal(f.field.required,true);
 assert.equal(f.send.disabled,false);
 assert.equal(f.calls.includes("sent"),true);
 assert.equal(f.calls.some(call=>call.revoked==="blob:preview"),true);
});
test("contact request is available only in private chat",async()=>{
 const direct=fixture();
 await direct.menuEvents.get("click")({target:{closest:()=>({dataset:{chatAttach:"contact"}})}});
 assert.equal(direct.calls.find(call=>call.contact)?.contact,"bert");
 const group=fixture("");
 assert.equal(group.contactButton.hidden,true);
 await group.menuEvents.get("click")({target:{closest:()=>({dataset:{chatAttach:"contact"}})}});
 assert.equal(group.calls.some(call=>call.contact),false);
});
test("oversized video is rejected before upload and text validation stays enabled",()=>{
 const f=fixture();f.input.files=[{name:"large.mp4",type:"video/mp4",size:51*1024*1024}];f.input.onchange();
 assert.equal(f.field.required,true);
 assert.equal(f.calls.length,0);
});
test("deleted attachments render no media links and filenames are escaped",()=>{
 const f=fixture();
 assert.equal(f.context.chatAttachmentMarkup({deleted:true,attachment:{id:"id"}}),"");
 assert.match(f.context.chatAttachmentMarkup({attachment:{id:"id",fileName:"<img>",fileType:"image/jpeg"}}),/&lt;img>/);
});

function mediaHost(id,type="image/jpeg"){
 const button={},notice={};
 return {dataset:{chatAttachment:id,fileType:type,fileName:"photo.jpg"},
 querySelector:selector=>selector==='[role="status"]'?notice:button,
 replaceChildren(node){this.node=node;node.parentNode=this;}};
}
test("group photos load automatically and complete in the current list after a refresh",async()=>{
 const old=mediaHost("photo"),video=mediaHost("video","video/mp4"),hosts=[old,video];
 let requests=0,resolveFetch;
 const f=fixture("",hosts,async()=>{requests++;return await new Promise(resolve=>resolveFetch=resolve);});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(requests,1);
 const current=mediaHost("photo");hosts[0]=current;f.context.refresh();
 assert.equal(requests,1);
 resolveFetch({ok:true,blob:async()=>({})});
 await new Promise(resolve=>setImmediate(resolve));
 assert.ok(current.node);
 assert.equal(old.node,undefined);
 f.context.refresh();assert.equal(requests,1);
});
test("private photos also load immediately without a click",async()=>{
 let requests=0;
 fixture("bert",[mediaHost("photo")],async()=>{requests++;return {ok:true,blob:async()=>({})};});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(requests,1);
});

test("large chat photos are resized before upload",async()=>{
 const f=fixture();let closed=false,drawn=[];
 f.context.createImageBitmap=async()=>({width:4000,height:3000,close(){closed=true;}});
 f.context.File=class{constructor(parts,name,options){this.name=name;this.type=options.type;this.lastModified=options.lastModified;this.size=parts[0].size;}};
 f.context.document.createElement=()=>({getContext:()=>({drawImage(...args){drawn=args;}}),toBlob(resolve,type){resolve({size:200000,type});}});
 const result=await f.context.optimizeChatPhoto({name:"large.jpg",type:"image/jpeg",size:4*1024*1024,lastModified:7});
 assert.equal(result.type,"image/webp");
 assert.equal(result.size,200000);
 assert.equal(drawn[3],1600);
 assert.equal(drawn[4],1200);
 assert.equal(closed,true);
});