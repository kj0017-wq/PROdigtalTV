export function mountMobileMailingList(root = document) {
  const table = root.querySelector('.table--people');
  if (!table) return;
  table.closest('.cms-main')?.classList.add('mailing-list-page');
  if (window.matchMedia('(max-width:720px)').matches) {
    root.querySelectorAll('.people-filter-grid select').forEach(select => { select.value = 'all'; });
    try {
      const filters = JSON.parse(sessionStorage.getItem('pdtv-people-filters') || '{}');
      for (const key of ['names','type','active','push','mail']) filters[key] = 'all';
      sessionStorage.setItem('pdtv-people-filters',JSON.stringify(filters));
      const params = new URLSearchParams(location.hash.split('?')[1] || '');
      params.delete('names'); params.delete('mail');
      if (location.hash.startsWith('#/cms/people')) history.replaceState(null,'',location.pathname+location.search+'#/cms/people'+(params.size?'?'+params:''));
    } catch {}
  }
  if (!document.querySelector('#mobile-mailing-list-style')) {
    const style = document.createElement('style'); style.id = 'mobile-mailing-list-style';
    style.textContent = `
@media(max-width:720px){
.mailing-list-page .people-filter-grid>.field:has(select){display:none}

.mailing-list-page .people-list-head>label:has([data-people-import-file]),
.mailing-list-page .people-list-head+p.muted,
.mailing-list-page .people-list-head+p.muted+p.muted,
.mailing-list-page .people-list-head+p.muted+p.muted+p.muted{display:none}

.mailing-list-page{min-width:0;padding:14px!important}
.mailing-list-page .panel:has(.setup-steps){display:none}
.mailing-list-page .panel{min-width:0;padding:14px}
.mailing-list-page .people-filter-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.mailing-list-page .people-filter-grid>.field:first-child{grid-column:1/-1}
.mailing-list-page .people-filter-grid input,.mailing-list-page .people-filter-grid select{width:100%;min-width:0;min-height:44px;font-size:16px}
.mailing-list-page .table-wrap:has(.table--people){overflow:visible}
.mailing-list-page .table--people{display:block;width:100%;min-width:0!important;table-layout:auto}
.mailing-list-page .table--people thead{display:none}
.mailing-list-page .table--people tbody{display:block}
.mailing-list-page .table--people tr:not([hidden]){display:block;margin:0 0 12px;border:1px solid #dce4ee;border-radius:14px;background:#fff;padding:12px}
.mailing-list-page .table--people tr[hidden]{display:none!important}
.mailing-list-page .table--people td{display:block;width:auto!important;min-width:0!important;max-width:none!important;padding:5px 0!important;border:0;white-space:normal!important;overflow-wrap:anywhere}
.mailing-list-page .table--people td:nth-child(3):before{content:'Funktion: ';color:#66717e}
.mailing-list-page .table--people td:nth-child(5):before{content:'Push: ';color:#66717e}
.mailing-list-page .table--people td:first-child strong{font-size:18px}
.mailing-list-page .table--people .people-name-action{text-align:left;white-space:normal}
.mailing-list-page .table--people td:last-child .table-actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-start}
.mailing-list-page .table--people td:last-child .button{min-height:44px;padding:10px 12px}
.mailing-list-page .table--people [data-people-edit-open].button{background:#143656;color:#fff;border-color:#143656;font-weight:700}
.mailing-list-page .table--people tr[data-people-row]:not([hidden]){position:relative;display:block;margin:0 0 6px;padding:10px 62px 10px 10px;min-height:64px;border-radius:10px;box-sizing:border-box}
.mailing-list-page .table--people tr[data-people-row]>td{padding:0!important;line-height:22px;font-size:14px;white-space:nowrap!important;overflow:hidden;text-overflow:ellipsis;overflow-wrap:normal}
.mailing-list-page .table--people tr[data-people-row]>td:first-child strong{display:inline;font-size:16px}
.mailing-list-page .table--people tr[data-people-row]>td:first-child small{display:inline;font-size:13px;margin:0;color:#687280}
.mailing-list-page .table--people tr[data-people-row]>td:first-child small:before{content:' · '}
.mailing-list-page .table--people tr[data-people-row]>td:first-child small~small{display:none}
.mailing-list-page .table--people tr[data-people-row] .people-name-action{display:inline;padding:0;min-height:0;border:0;font-size:16px;line-height:22px;white-space:nowrap}
.mailing-list-page .table--people tr[data-people-row]>td:nth-child(n+3):not(:last-child){display:none}
.mailing-list-page .table--people tr[data-people-row]>td:last-child{position:absolute;right:8px;top:50%;transform:translateY(-50%);width:44px!important;overflow:visible}
.mailing-list-page .table--people tr[data-people-row]>td:last-child .table-actions>*{display:none}
.mailing-list-page .table--people tr[data-people-row]>td:last-child .table-actions>[data-people-edit-open]{display:flex;align-items:center;justify-content:center;width:44px;height:44px;min-height:44px;padding:0;font-size:0;border-radius:10px}
.mailing-list-page .table--people tr[data-people-row]>td:last-child [data-people-edit-open]:before{content:'✎';font-size:26px;line-height:1}
.people-edit-dialog .people-edit-form .form-grid--two{grid-template-columns:minmax(0,1fr)}
.people-edit-dialog input:not([type=checkbox]),.people-edit-dialog select,.people-edit-dialog textarea{font-size:16px;min-width:0;width:100%}
.people-edit-dialog .people-edit-form__actions{position:sticky;bottom:0;padding:12px 0;background:#fff;z-index:2;display:flex;flex-wrap:wrap}
.people-edit-dialog .people-edit-form__actions button[type=submit]{width:100%;min-height:48px}
}
[data-people-save-confirmation]{padding:14px 16px;border:2px solid #1e7445;border-radius:12px;background:#edf8f0;color:#14532d;font-weight:700;margin:12px 0;scroll-margin-top:90px}
`;
    document.head.append(style);
  }
}
export function returnToMailingList(email) {
  document.querySelector('[data-people-save-confirmation]')?.remove();
  const table = document.querySelector('.table--people');
  if (!table) return;
  const banner = document.createElement('p'); banner.dataset.peopleSaveConfirmation = ''; banner.setAttribute('role','status'); banner.setAttribute('aria-live','polite'); banner.tabIndex = -1;
  banner.textContent = '✓ Änderungen gespeichert. Zurück in der Mailliste.';
  table.closest('.table-wrap').before(banner);
  const row = [...table.querySelectorAll('[data-people-row]')].find(item => item.dataset.email === String(email||'').toLowerCase());
  if(row)row.classList.add('is-highlighted');
  banner.scrollIntoView({block:'start',behavior:'instant'}); banner.focus({preventScroll:true});
}
