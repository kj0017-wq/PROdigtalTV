import { getFirebaseServices } from './firebaseClient.js?v=2';
import { refreshAuthToken } from './authService.js?v=479';
export async function mountEventWelcomeLogin() {
  for (const form of document.querySelectorAll('[data-live-code-login]')) {
    if (form.dataset.mounted) continue;
    form.dataset.mounted = '1';
    const status = form.querySelector('[data-code-status]');
    const buttons = [...form.querySelectorAll('button')];
    const message = text => { status.textContent = text; };
    const busy = value => { buttons.forEach(button => button.disabled = value); };
    const service = async () => { const f=await getFirebaseServices(); if(!f)throw new Error('Anmeldung momentan nicht erreichbar.'); return f; };
    form.querySelector('[data-request-login-code]').addEventListener('click',async()=>{
      if(!form.elements.email.reportValidity())return;
      busy(true);message('Code wird angefordert ...');
      try {const f=await service();const response=await f.functionsLib.httpsCallable(f.functions,'requestEventWelcomeLoginCode')({eventId:form.dataset.eventId,email:form.elements.email.value.trim()});message(response.data.message);}
      catch(error){message(error.message || 'Code konnte nicht angefordert werden.');}finally{busy(false);}
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
      }catch(error){message(error.message || 'Anmeldung fehlgeschlagen. Bitte einen neuen Code anfordern.');}
      finally{delete form.dataset.busy;busy(false);}
    });
  }
}
