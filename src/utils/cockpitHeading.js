const cockpitRoutes=new Set(['live','live-moderation','live-results','assemblies','assembly-moderation','accounting-excel','mail-schedule','event-notifications','presentations','mailboxes','quality','people']);
export function mountCockpitHeading(root,route={}){
 if(!(route.path==='cms'&&cockpitRoutes.has(route.id)||route.path==='event-gallery'&&route.query?.get('from')==='cockpit'))return;
 if(root.querySelector('.cockpit-heading,.login-wrap'))return;
 const scope=root.querySelector('[data-event-gallery-page],.mobile-live-admin,.cms-main');if(!scope)return;
 const picker=scope.querySelector('.cockpit-event-picker');
 if(picker){const host=scope.querySelector('[data-mail-schedule]')||scope;scope.classList.add('cockpit-event-layout');picker.classList.add('cockpit-unified-picker');host.prepend(picker);}

 const heading=scope.querySelector('h1')||scope.querySelector('.mobile-live-results-head h2');if(!heading)return;
 let back=scope.querySelector('[data-cockpit-back],.mobile-cockpit-back');
 if(!back){back=document.createElement('a');back.href='#/cms/live';back.className='button mobile-cockpit-back';back.dataset.cockpitBack='';back.textContent='Zurück zum Event-Cockpit';}
 back.setAttribute('aria-label','Zurück zum Event-Cockpit');back.title='Zurück zum Event-Cockpit';
 const original=heading.parentElement,backParent=back.parentElement;
 const eyebrow=original.querySelector(':scope>.eyebrow');
 const next=heading.nextElementSibling;
 const description=next?.matches('p:not(.eyebrow):not([role]):not([data-mailbox-status])')?next:null;
 const host=back.closest('.mobile-live-hero')||heading.closest('.cms-title')||original;
 const header=document.createElement('header');header.className='cockpit-heading';host.prepend(header);
 const titles=document.createElement('div');titles.className='cockpit-heading__titles';if(eyebrow)titles.append(eyebrow);titles.append(heading);header.append(back,titles);
 if(description){description.classList.add('cockpit-heading__description');header.append(description);}
 for(const previous of new Set([original,backParent])){if(previous&&previous!==host&&previous!==scope&&!previous.contains(header)&&!previous.children.length)previous.remove();}
}
