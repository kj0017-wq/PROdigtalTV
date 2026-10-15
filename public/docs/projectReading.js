const bar = document.createElement('section');
bar.setAttribute('aria-label','Projektbeschreibung mit ElevenLabs vorlesen');bar.className='project-reading';
bar.innerHTML='<button type="button" data-project-read aria-pressed="false">▶ Vorlesen</button><button type="button" data-project-stop disabled>■ Stoppen</button><span role="status" aria-live="polite" data-project-read-status></span>';
const style=document.createElement('style');style.textContent='.project-reading{position:sticky;top:0;z-index:10;display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:12px max(16px,calc((100vw - 1180px)/2));background:#fff;border-bottom:1px solid #dce4ed}.project-reading button{min-height:44px;border:0;border-radius:10px;padding:10px 16px;background:#143656;color:#fff;font-size:16px;font-weight:700;cursor:pointer}.project-reading button:disabled{opacity:.45;cursor:default}.project-reading [role=status]{font-size:14px;color:#526174}@media(max-width:600px){.project-reading{padding-right:70px}.project-reading [role=status]{flex-basis:100%}}@media print{.project-reading{display:none}}';document.head.append(style);
(document.querySelector('.hero') || document.querySelector('header'))?.after(bar);
const read=bar.querySelector('[data-project-read]'),stop=bar.querySelector('[data-project-stop]'),status=bar.querySelector('[role=status]');
const audio = new Audio(); audio.preload='none';
let manifest=null,parts=[],index=0,active=false,paused=false,busy=false,generation=0;
const manifestReady=fetch('/docs/project-audio/manifest.json?v=elevenlabs1').then(async response=>{
 if(!response.ok)throw Error('Audiodateien sind derzeit nicht verfügbar.');
 const data=await response.json();if(data.provider!=='elevenlabs'||!data.parts?.length)throw Error('ElevenLabs-Audio nicht verfügbar.');
 manifest=data;parts=data.parts;return data;
});
manifestReady.catch(()=>{});
function progress(){const fraction=Number.isFinite(audio.duration)&&audio.duration>0?audio.currentTime/audio.duration:0;return Math.round((index+fraction)/Math.max(1,parts.length)*100);}
function reset(message=''){
 generation++;audio.pause();audio.removeAttribute('src');audio.load();active=false;paused=false;busy=false;index=0;
 read.disabled=false;read.textContent='▶ Vorlesen';read.setAttribute('aria-pressed','false');stop.disabled=true;status.textContent=message;
}
async function playPart(version){
 if(version!==generation)return;
 audio.src=parts[index].url;
 status.textContent=`ElevenLabs · ${manifest.voiceName} · Audio lädt …`;
 await audio.play();
 if(version!==generation)return;
 active=true;paused=false;read.textContent='Ⅱ Pause';read.setAttribute('aria-pressed','true');stop.disabled=false;
 status.textContent=`ElevenLabs · ${manifest.voiceName} · ${progress()} %`;
}
read.addEventListener('click',async()=>{
 if(busy)return;
 if(active&&!paused){audio.pause();paused=true;read.textContent='▶ Weiterlesen';status.textContent='Vorlesen pausiert.';return;}
 busy=true;read.disabled=true;const version=++generation;
 try{
  if(active&&paused){await audio.play();paused=false;read.textContent='Ⅱ Pause';}
  else{status.textContent='ElevenLabs-Audio wird geladen …';await manifestReady;if(version!==generation)return;index=0;stop.disabled=false;await playPart(version);}
 }catch(error){if(version===generation)reset('Wiedergabe nicht gestartet. Bitte erneut auf Vorlesen tippen.');}
 finally{if(version===generation){busy=false;read.disabled=false;}}
});
stop.addEventListener('click',()=>reset('Vorlesen gestoppt.'));
audio.addEventListener('timeupdate',()=>{if(active&&!paused)status.textContent=`ElevenLabs · ${manifest.voiceName} · ${progress()} %`;});
audio.addEventListener('ended',async()=>{
 if(!active)return;index++;if(index>=parts.length){reset('Vorlesen beendet.');return;}
 const version=generation;try{await playPart(version);}catch{if(version===generation)reset('Audio konnte nicht fortgesetzt werden. Bitte erneut starten.');}
});
audio.addEventListener('error',()=>{if(audio.getAttribute('src'))reset('Audiodatei konnte nicht geladen werden. Bitte erneut starten.');});
window.addEventListener('pagehide',()=>reset());document.querySelector('.project-close')?.addEventListener('click',()=>reset());
