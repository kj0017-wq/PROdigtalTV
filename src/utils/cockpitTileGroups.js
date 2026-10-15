const groups = [
  ['Veranstaltung planen', ['a[href="#/cms/live/dashboard"]','a[href="#/cms/live/invitations"]','a[href="#/cms/live/guests"]','a[href="#/cms/live/labels"]']],
  ['Kommunikation', ['[data-cockpit-mailing-list]','[data-mobile-mail-schedule-link]','[data-cockpit-mailbox-admin]']],
  ['Veranstaltung durchführen', ['a[href="#/cms/live/qr"]','a[href="#/cms/live/checkin"]','a[href="#/cms/live-moderation"]','[data-mobile-presentation-link]','[data-pause-gong]','[data-mobile-event-chat-link]','a[href="#/cms/live/survey"]','[data-mobile-gallery-link]']],
  ['Auswertung', ['a[href="#/cms/live-results"]','a[href="#/cms/live/feedback"]']],
  ['Verband und Informationen', ['a[href="#/cms/assemblies"]','[data-mobile-accounting-excel-link]','[data-cockpit-project-description]','[data-mobile-cms-website-link]']]
];
export function groupCockpitTiles(root = document) {
  const nav = root.querySelector('.mobile-cms-launcher');
  if (!nav || nav.hidden || nav.dataset.grouped) return;
  nav.dataset.grouped='true';
  const tiles=[...nav.children].filter(node=>node.matches('a,button'));
  const remaining=new Set(tiles), fragment=document.createDocumentFragment();
  const append=(title,nodes)=>{
    if(!nodes.length)return;
    const heading=document.createElement('h2'); heading.textContent=title;
    heading.style.cssText='grid-column:1/-1;margin:16px 0 2px;font-size:16px;line-height:1.3;font-weight:750;text-align:left;color:var(--pdt-navy,#143656)';
    heading.dataset.cockpitTileGroup='';fragment.append(heading,...nodes);
  };
  for(const [title,selectors] of groups){
    const nodes=[];
    for(const selector of selectors){const node=tiles.find(tile=>remaining.has(tile)&&tile.matches(selector));if(node){nodes.push(node);remaining.delete(node);}}
    append(title,nodes);
  }
  append('Weitere Funktionen',[...remaining]);
  nav.replaceChildren(fragment);
}
