import {publicShell} from '../components/layout.js?v=17';
import {escapeHtml} from '../utils/format.js?v=4';
import {mountEventPhotos} from '../utils/eventPhotos.js?v=10';
export function eventGalleryPage(eventId,query=new URLSearchParams()){
 if(!/^[a-zA-Z0-9_-]{1,100}$/.test(eventId||''))return publicShell('events','<main class="event-live-page"><p>Bitte eine Veranstaltung auswählen.</p></main>');
 const back=query.get('from')==='cockpit'?'#/cms/live':'#/event-live/'+encodeURIComponent(eventId);
 return publicShell('events',`<main class="event-live-page" data-event-gallery-page data-gallery-inline="1" data-event-id="${escapeHtml(eventId)}"><a class="button button--small mobile-cockpit-back" style="background:#e30613;color:white;border-color:#e30613" href="${escapeHtml(back)}">← Zurück${query.get('from')==='cockpit'?' zum Event-Cockpit':''}</a><p class="eyebrow">Eventgalerie</p><h1>Bilder und Videos</h1><button type="button" data-event-photo-open hidden>Galerie öffnen</button><div data-event-gallery-content></div></main>`);
}
export function mountEventGalleryPage(){const root=document.querySelector('[data-event-gallery-page]');if(!root||root.dataset.mounted)return;root.dataset.mounted='1';mountEventPhotos(root);root.querySelector('[data-event-photo-open]').click();}
