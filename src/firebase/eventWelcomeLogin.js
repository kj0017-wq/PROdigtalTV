import { getFirebaseServices } from './firebaseClient.js?v=2';
import { refreshAuthToken } from './authService.js?v=479';
export async function mountEventWelcomeLogin() {
  for (const form of document.querySelectorAll('[data-live-code-login]')) {
    if (form.dataset.mounted) continue;
    form.dataset.mounted = '1';
    const status = form.querySelector('[data-code-status]');
    const buttons = [...form.querySelectorAll('button')];
    form.insertBefore(status, form.querySelector('button[type=submit]'));
    status.hidden = true;
    status.tabIndex = -1;
    const message = (text, kind = 'info', heading = 'Anmeldung abgelehnt') => {
      status.hidden = false;
      status.replaceChildren();
      status.className = 'alert' + (kind === 'error' ? ' alert--error' : kind === 'success' ? ' alert--success' : '');
      status.setAttribute('role', kind === 'error' ? 'alert' : 'status');
      status.setAttribute('aria-live', kind === 'error' ? 'assertive' : 'polite');
      status.style.cssText = kind === 'error'
        ? 'margin:16px 0;padding:18px;border:2px solid #dc2626;border-left-width:7px;border-radius:12px;background:#fff0f0;color:#991b1b;font-size:17px;line-height:1.5;'
        : 'margin:16px 0;';
      if (kind === 'error') {
        const title = document.createElement('strong'); title.textContent = '⚠ ' + heading;
        title.style.cssText = 'display:block;font-size:20px;margin-bottom:8px;'; status.append(title);
      }
      const detail = document.createElement('div'); detail.textContent = text; status.append(detail);
      form.elements.code.removeAttribute('aria-invalid');
      if (kind === 'error') {
        if (/ungültig|abgelaufen|bereits verwendet/i.test(text)) form.elements.code.setAttribute('aria-invalid','true');
        status.focus({preventScroll:true}); status.scrollIntoView({behavior:'smooth',block:'nearest'});
      }
    };
    const busy = value => { buttons.forEach(button => button.disabled = value); };
    const service = async () => { const f=await getFirebaseServices(); if(!f)throw new Error('Anmeldung momentan nicht erreichbar.'); return f; };
    form.querySelector('[data-request-login-code]').addEventListener('click',async()=>{
      if(!form.elements.email.reportValidity())return;
      busy(true);message('Code wird angefordert ...');
      try {const f=await service();const response=await f.functionsLib.httpsCallable(f.functions,'requestEventWelcomeLoginCode')({eventId:form.dataset.eventId,email:form.elements.email.value.trim()});message(response.data.message, 'success');}
      catch(error){message(error.message || 'Code konnte nicht angefordert werden.', 'error', 'Codeversand fehlgeschlagen');}finally{busy(false);}
    });
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(form.dataset.busy==='1')return;form.dataset.busy='1';busy(true);message('Anmeldung läuft ...');
      try {
        const f=await service();const email=form.elements.email.value.trim().toLowerCase();
        const response=await f.functionsLib.httpsCallable(f.functions,'verifyEventWelcomeLoginCode')({eventId:form.dataset.eventId,email,code:form.elements.code.value.trim()});
        await f.authLib.setPersistence(f.auth,f.authLib.browserLocalPersistence);
        await f.authLib.signInWithCustomToken(f.auth,response.data.customToken);
        await refreshAuthToken(true);
        try{localStorage.setItem('pdtv-event-login-email',email);}catch{}
        form.elements.code.value='';message('Angemeldet. Der Veranstaltungsbereich wird geöffnet.');
        location.reload();
      }catch(error){message(error.message || 'Bitte prüfen Sie den Code oder fordern Sie einen neuen Code an.', 'error');}
      finally{delete form.dataset.busy;busy(false);}
    });
  }
}
