import { getFirebaseServices } from "../firebase/firebaseClient.js?v=2";
import { escapeHtml } from "./format.js?v=3";
import { requestEventLiveContact } from "../firebase/eventLiveService.js?v=8";
import { openParticipantPhoto } from "./participantPhotos.js?v=6";
async function call(name,data) {
  const firebase = await getFirebaseServices();
  if (!firebase) throw new Error("Firebase ist nicht erreichbar.");
  return (await firebase.functionsLib.httpsCallable(firebase.functions,name,{timeout:45000})(data)).data;
}
async function optimizeChatPhoto(file) {
  if (!file?.type?.startsWith("image/") || file.size < 450 * 1024 || typeof createImageBitmap !== "function") return file;
  let bitmap;
  try {
    try { bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }); }
    catch { bitmap = await createImageBitmap(file); }
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/webp", 0.82));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name, { type: "image/webp", lastModified: file.lastModified });
  } catch { return file; }
  finally { bitmap?.close?.(); }
}
export function chatAttachmentMarkup(item) {
  const file = item.deleted ? null : item.attachment;
  if (!file?.id) return "";
  return `<div class="chat-attachment" data-chat-attachment="${escapeHtml(file.id)}" data-file-type="${escapeHtml(file.fileType)}" data-file-name="${escapeHtml(file.fileName)}"><button type="button" data-chat-media-open>${file.fileType?.startsWith("video/") ? "▶ Video ansehen" : "▧ Foto anzeigen"} · ${escapeHtml(file.fileName)}</button><span role="status"></span></div>`;
}
export function mountChatAttachments({form,list,eventId,peerId="",canSend=()=>true,contacts=()=>[],status,onSent,onContactSent}) {
  const field=form.elements.message;
  const send=form.querySelector('button[type="submit"]');
  form.classList.add("chat-composer--attachments");
  const picker=document.createElement("div");
  picker.className="chat-attach-picker";
  picker.innerHTML=`<button type="button" class="chat-attach-plus" aria-label="Foto, Video oder Kontaktanfrage anhängen" aria-expanded="false">+</button><div class="chat-attach-menu" hidden><button type="button" data-chat-attach="photo">Foto</button><button type="button" data-chat-attach="video">Video</button><button type="button" data-chat-attach="contact">Kontaktanfrage</button></div><input type="file" hidden>`;
  form.prepend(picker);
  const plus=picker.querySelector(".chat-attach-plus"),menu=picker.querySelector(".chat-attach-menu"),input=picker.querySelector("input");
  plus.disabled=!canSend();
  picker.querySelector('[data-chat-attach="contact"]').hidden = !peerId;
  let selected,intent,uploaded=false,sending=false,previewUrl;
  const preview=document.createElement("div");
  preview.className="chat-attachment-selection";preview.hidden=true;form.before(preview);
  const closeMenu=()=>{menu.hidden=true;plus.setAttribute("aria-expanded","false");};
  plus.onclick=()=>{if(!canSend()||sending||send.disabled)return;menu.hidden=!menu.hidden;plus.setAttribute("aria-expanded",String(!menu.hidden));};
  picker.addEventListener("keydown",event=>{if(event.key==="Escape"){closeMenu();plus.focus();}});
  const requestContact=async person=>{
    status.textContent="Kontaktanfrage wird gesendet …";
    try {
      const result=await requestEventLiveContact(eventId,person.contactId);
      await onContactSent?.();
      status.textContent=result.status==="accepted"?"Kontaktdaten sind bereits freigegeben.":"Kontaktanfrage gesendet.";
    }catch(error){status.textContent=error.message||"Kontaktanfrage fehlgeschlagen.";}
  };
  menu.addEventListener("click",async event=>{
    const action=event.target.closest("[data-chat-attach]")?.dataset.chatAttach;
    if(!action||!canSend())return;closeMenu();
    if(action==="contact"){
      if (!peerId) return;
      const people=contacts();
      if(!people.length){status.textContent="Keine andere eingecheckte Person verfügbar.";return;}
      if(people.length===1){await requestContact(people[0]);return;}
      const dialog=document.createElement("dialog");dialog.className="event-photo-dialog";
      dialog.setAttribute("aria-label","Person für Kontaktanfrage auswählen");
      dialog.innerHTML=`<h2>Kontaktanfrage an</h2><div class="chat-contact-picker">${people.map((person,index)=>`<button class="button button--secondary" data-person-index="${index}">${escapeHtml(person.displayName||[person.firstName,person.lastName].filter(Boolean).join(" ")||"Teilnehmende Person")}</button>`).join("")}</div><button class="button button--secondary" data-close>Schließen</button>`;
      dialog.querySelector("[data-close]").onclick=()=>dialog.close();
      dialog.addEventListener("close",()=>dialog.remove(),{once:true});
      dialog.onclick=event=>{const button=event.target.closest("[data-person-index]");if(!button)return;const person=people[Number(button.dataset.personIndex)];dialog.close();requestContact(person);};
      document.body.append(dialog);dialog.showModal();return;
    }
    input.accept=action==="photo"?"image/jpeg,image/png,image/webp":"video/mp4,video/webm,video/quicktime";
    input.value="";input.click();
  });
  const releasePreview=()=>{if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null;}};
  const clear=()=>{releasePreview();selected=null;intent=null;uploaded=false;field.required=true;preview.hidden=true;preview.replaceChildren();};
  input.onchange=async()=>{
    const sourceFile=input.files[0];if(!sourceFile)return;
    let file=sourceFile;
    const image=/^image\/(jpeg|png|webp)$/.test(file.type),video=/^video\/(mp4|webm|quicktime)$/.test(file.type);
    if((!image&&!video)||file.size>(image?15:50)*1024*1024){status.textContent="Fotos: JPG, PNG oder WebP bis 15 MB. Videos: MP4, WebM oder MOV bis 50 MB.";return;}
    if(image&&file.size>=450*1024){status.textContent="Foto wird für schnellen Versand vorbereitet …";file=await optimizeChatPhoto(file);if(input.files[0]!==sourceFile)return;status.textContent="";}
    releasePreview();selected=file;intent=null;uploaded=false;field.required=false;preview.hidden=false;
    preview.innerHTML=`<span>${escapeHtml(file.name)}</span><button type="button">Entfernen</button>`;
    if (image) {
      const photo=document.createElement("img");
      previewUrl=URL.createObjectURL(file);
      photo.src=previewUrl;photo.alt="Vorschau: "+file.name;
      photo.className="chat-attachment-selection__image";
      preview.prepend(photo);
    }
    preview.querySelector("button").onclick=()=>{if(!sending)clear();};field.focus();
    if(image)await form.requestSubmit();
  };
  form.addEventListener("submit",async event=>{
    if(!selected)return;event.preventDefault();event.stopImmediatePropagation();
    if(sending||!canSend()||send.disabled)return;
    sending=true;const oldText=send.textContent;send.disabled=plus.disabled=field.disabled=true;
    const data={eventId,peerId,channel:peerId?"private":"group"};
    try{
      status.textContent="Anhang wird hochgeladen …";
      const firebase=await getFirebaseServices();
      if(!intent)intent=await call("beginEventChatAttachment",{...data,fileName:selected.name,fileType:selected.type,fileSize:selected.size});
      if(!uploaded){await firebase.storageLib.uploadBytes(firebase.storageLib.ref(firebase.storage,intent.storagePath),selected,{contentType:selected.type});uploaded=true;}
      await call("finishEventChatAttachment",{...data,attachmentId:intent.attachmentId,text:field.value.trim()});
      clear();field.value="";field.dispatchEvent(new Event("input",{bubbles:true}));await onSent?.();status.textContent="";
    }catch(error){status.textContent=error.message||"Upload fehlgeschlagen. Sie können erneut senden.";}
    finally{sending=false;send.disabled=field.disabled=false;plus.disabled=!canSend();send.textContent=oldText;}
  },{capture:true});
  const media=new Map(),viewers=new Set(),loadingMedia=new Set(),failedMedia=new Set();
  const loadMedia=async host=>{
    const button=host.querySelector("[data-chat-media-open]");
    const id=host.dataset.chatAttachment,notice=host.querySelector('[role="status"]');
    if(!button || loadingMedia.has(id))return;
    loadingMedia.add(id);failedMedia.delete(id);
    button.disabled=true;notice.textContent="Anhang wird geladen …";
    try{
      let entry=media.get(id);
      if(!entry){
        const firebase=await getFirebaseServices(),token=await firebase.auth.currentUser.getIdToken();
        const response=await fetch(`https://europe-west3-prodigitaltv-da47b.cloudfunctions.net/getEventChatAttachment?attachmentId=${encodeURIComponent(id)}`,{headers:{Authorization:`Bearer ${token}`},cache:"default"});
        if(!response.ok)throw new Error(response.status===404?"Anhang wurde gelöscht.":"Anhang konnte nicht geladen werden.");
        const url=URL.createObjectURL(await response.blob());
        if(!list.isConnected || !form.isConnected || ![...list.querySelectorAll("[data-chat-attachment]")].some(item=>item.dataset.chatAttachment===id)){URL.revokeObjectURL(url);return;}
        entry={url};media.set(id,entry);
      }
      host=[...list.querySelectorAll("[data-chat-attachment]")].find(item=>item.dataset.chatAttachment===id);
      if(!host)return;
      host.querySelector('[role="status"]').textContent="";
      if(host.dataset.fileType.startsWith("video/")){
        const video=document.createElement("video");video.controls=true;video.playsInline=true;video.src=entry.url;entry.node = video;host.replaceChildren(video);
      }else{
        const card=document.createElement("figure"),image=document.createElement("img"),trigger=document.createElement("button");
        image.dataset.participantPhotoImage="";image.src=entry.url;image.alt=host.dataset.fileName;
        trigger.type="button";trigger.setAttribute("aria-label","Foto vergrößern");trigger.append(image);card.append(trigger);entry.node = card;host.replaceChildren(card);
        trigger.onclick=()=>{const viewer=openParticipantPhoto(card,trigger);if(viewer){viewers.add(viewer);viewer.addEventListener("close",()=>viewers.delete(viewer),{once:true});}};
      }
    }catch(error){notice.textContent=error.message;button.disabled=false;failedMedia.add(id);}
    finally{loadingMedia.delete(id);}
  };
  list.addEventListener("click",event=>{
    const button=event.target.closest("[data-chat-media-open]");
    if(button)loadMedia(button.closest("[data-chat-attachment]"));
  });
  const autoLoadPhotos=()=>{
    if(!list.isConnected)return;
    list.querySelectorAll("[data-chat-attachment]").forEach(host=>{
      if(host.dataset.fileType?.startsWith("image/") && !media.has(host.dataset.chatAttachment)
        && !failedMedia.has(host.dataset.chatAttachment))loadMedia(host);
    });
  };
  const cleanup=()=>{if(form.isConnected)return;releasePreview();media.forEach(entry=>URL.revokeObjectURL(entry.url));media.clear();viewers.forEach(viewer=>viewer.close());viewers.clear();changes.disconnect();};
  const changes=new MutationObserver(() => {
    cleanup();
    if (!form.isConnected) return;
    const hosts = [...list.querySelectorAll("[data-chat-attachment]")];
    const available = new Set(hosts.map(host => host.dataset.chatAttachment));
    media.forEach((entry,id) => {
      if (available.has(id)) return;
      viewers.forEach(viewer => { if (viewer.querySelector("img")?.src === entry.url) viewer.close(); });
      URL.revokeObjectURL(entry.url);media.delete(id);
    });
    hosts.forEach(host => {
      const node = media.get(host.dataset.chatAttachment)?.node;
      if (node && node.parentNode !== host) host.replaceChildren(node);
    });
    autoLoadPhotos();
  });changes.observe(document.body,{childList:true,subtree:true});
  autoLoadPhotos();
}
