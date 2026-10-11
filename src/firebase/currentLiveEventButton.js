import {getFirebaseServices} from './firebaseClient.js?v=2';
import {openEventWithTicket} from './eventTicketLogin.js?v=3';
let events=[],checking=false,lastCheck=0,started=false;
function render(){
 const home=document.querySelector('.pdtv-home');if(!home)return;
 let banner=home.querySelector('[data-current-live-events]');
 if(!events.length){banner?.remove();return;}
 if(!banner){banner=document.createElement('section');banner.dataset.currentLiveEvents='';banner.className='container';banner.style.cssText='padding-top:18px;padding-bottom:18px;';home.prepend(banner);}
 banner.replaceChildren();
 for(const event of events){
  const card=document.createElement('div');card.style.cssText='background:#fff;border:2px solid #e30613;border-radius:16px;padding:20px;margin-bottom:12px;';
  const heading=document.createElement('strong');heading.textContent='Live-Event ist geöffnet';heading.style.cssText='display:block;font-size:20px;margin-bottom:8px;';
  const title=document.createElement('p');title.textContent=event.title;
  const button=document.createElement('button');button.type='button';button.className='button button--primary';button.textContent='Zum Live-Event';
  const status=document.createElement('p');status.setAttribute('role','status');
  button.addEventListener('click',async()=>{button.disabled=true;status.textContent='';try{await openEventWithTicket(event.id);}catch(error){status.textContent=error.message||'Bitte mit dem Welcome-Code anmelden.';const link=document.createElement('a');link.href=`#/event-live/${encodeURIComponent(event.id)}`;link.textContent=' Mit Welcome-Code anmelden';status.append(link);}finally{button.disabled=false;}});
  card.append(heading,title,button,status);banner.append(card);
 }
}
async function refresh(force=false){
 if(document.hidden||!document.querySelector('.pdtv-home')||checking)return;
 if(!force&&Date.now()-lastCheck<30000){render();return;}
 checking=true;
 try{const f=await getFirebaseServices();if(!f)return;const response=await f.functionsLib.httpsCallable(f.functions,'listCurrentPublicLiveEvents')({});events=response.data.events||[];lastCheck=Date.now();render();}catch{events=[];render();}finally{checking=false;}
}
export function mountCurrentLiveEventButton(){
 render();refresh(true);
 if(started)return;started=true;
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh(true);});
 window.addEventListener('pageshow',()=>refresh(true));
 window.addEventListener('focus',()=>refresh(true));
 window.setInterval(()=>refresh(true),60000);
}
