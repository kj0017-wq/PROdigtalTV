export function memberPortalTiles({documentsBadge='',eventsBadge=''}={}) {
 const icons={calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18m-13 5 3 3 5-5"/>',mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',news:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',people:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 5a3 3 0 0 1 0 6m2 10v-3a6 6 0 0 0-2-4"/>',strategy:'<path d="m3 18 6-6 4 3 8-11M15 4h6v6M3 21h18"/>',profile:'<circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>',events:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M7 14h3M14 14h3M7 17h3"/>'};
 const tiles=[['my-events','Meine Veranstaltungen','calendar',eventsBadge],['my-documents','Meine Dokumente','mail',documentsBadge],['documents','Member Infos','news',''],['directory','Mitgliederliste','people',''],['strategy','Zukunftsstrategie','strategy',''],['profile','Mein Profil','profile',''],['events','Alle Events','events','']];
 return `<style>
.member-portal-shell--overview .member-portal-mobile-nav{display:none!important}
.member-portal-shell--overview .member-portal-tabs{display:flex!important;justify-content:flex-end;margin-bottom:20px}
.member-portal-shell--overview .member-portal-tabs>a{display:none}
.member-portal-shell--overview .member-portal-section{margin-top:0}
.member-portal-tile-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:28px 16px;padding:10px 0 28px}
.member-portal-tile-grid>a{display:flex;flex-direction:column;align-items:center;gap:10px;min-width:0;color:var(--pdt-navy,#143656);text-decoration:none;text-align:center;font-size:15px;font-weight:750;line-height:1.3}
.member-portal-tile-icon{position:relative;display:grid;place-items:center;width:76px;height:76px;border-radius:22px;color:#fff;background:linear-gradient(145deg,#f0071b,#ca0013);box-shadow:0 5px 14px #e3061326,inset 0 1px 0 #ffffff44}
.member-portal-tile-grid>a:nth-child(2n) .member-portal-tile-icon{background:linear-gradient(145deg,#17365d,#071a33);box-shadow:0 5px 14px #071a3326,inset 0 1px 0 #ffffff44}
.member-portal-tile-icon svg{width:34px;height:34px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
.member-portal-tile-icon .mailbox-badge,.member-portal-tile-icon .participant-photo-badge{position:absolute;top:-6px;right:-6px;min-width:24px;min-height:24px;border:2px solid #fff;background:#e30613;color:#fff}
.member-portal-tile-grid>a:focus-visible{outline:3px solid #397cc0;outline-offset:5px;border-radius:12px}
@media(max-width:760px){.member-portal-tile-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:24px 10px}.member-portal-tile-grid>a{font-size:13px;hyphens:auto;overflow-wrap:anywhere}.member-portal-tile-icon{width:68px;height:68px;border-radius:20px}}
@media(max-width:360px){.member-portal-tile-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style><section class="member-portal-section"><nav class="member-portal-tile-grid" aria-label="Bereiche im Mitgliederportal">${tiles.map(([tab,label,icon,badge])=>`<a href="#/portal?tab=${tab}"><span class="member-portal-tile-icon"><svg viewBox="0 0 24 24" aria-hidden="true">${icons[icon]}</svg>${badge}</span><span>${label}</span></a>`).join('')}</nav></section>`;
}
const portalText = value => String(value || '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function compactMemberPortalHeader({title='Mitgliederbereich',overview=false,name=''}={}) {
 return `<style>
.member-portal-shell--compact{padding-top:20px!important;padding-bottom:28px!important}
.member-portal-shell--compact .member-portal-section{margin-top:0}
.member-portal-shell--compact .member-portal-section>h2:first-of-type,.member-portal-shell--compact .member-portal-section>.eyebrow,.member-portal-shell--compact .member-portal-section>.section-head>h2{display:none}
.member-portal-shell--compact .member-portal-section>.section-head:not(:has(a,button,input)){display:none}
.member-portal-shell--compact .mailbox-page{padding:0;min-height:0}
.member-portal-compact-heading{display:flex;align-items:center;gap:12px;margin:0 0 20px;min-width:0}
.member-portal-compact-heading>div{flex:1;min-width:0}
.member-portal-compact-heading .eyebrow{font-size:11px;letter-spacing:.12em;color:#c90027;margin:0 0 4px;font-weight:750}
.member-portal-compact-heading h1{font-size:24px;line-height:1.2;letter-spacing:-.02em;margin:0;color:var(--pdt-navy,#143656);overflow-wrap:anywhere}
.member-portal-back{flex:0 0 44px;display:grid;place-items:center;width:44px;height:44px;background:#e30613;color:#fff;border-radius:50%;box-shadow:0 4px 12px #071a3320;text-decoration:none}
.member-portal-back svg{width:26px;height:26px;fill:none;stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}
.member-portal-signout{flex:0 0 44px;display:grid;place-items:center;width:44px;height:44px;min-height:44px;padding:10px;border:1px solid #dce4ed;border-radius:12px;background:#fff;color:#143656}
.member-portal-signout svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
@media(max-width:760px){.member-portal-shell--compact>.container{width:calc(100% - 28px);padding:0}.member-portal-compact-heading h1{font-size:22px}.member-portal-shell--compact{padding-top:16px!important}.member-portal-compact-heading{gap:10px;margin-bottom:16px}}
</style><header class="member-portal-compact-heading">${overview?'':`<a class="member-portal-back" href="#/portal?tab=overview" aria-label="Zurück zur Mitgliederübersicht" title="Zurück"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 4-8 8 8 8"/></svg></a>`}<div><p class="eyebrow">Mitgliederbereich${overview&&name?' · '+portalText(name):''}</p><h1>${portalText(title)}</h1></div><button class="member-portal-signout" type="button" data-logout-button aria-label="Abmelden" title="Abmelden"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4H4v16h5M14 8l4 4-4 4M8 12h13"/></svg></button></header>`;
}
