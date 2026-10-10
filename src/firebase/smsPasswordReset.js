import { getFirebaseServices } from './firebaseClient.js?v=2';
export function mountSmsPasswordReset(root=document){
 const open=root.querySelector('[data-login-sms-reset]'),panel=root.querySelector('#login-sms-reset'),login=root.querySelector('#login-form');
 if(!open||!panel||open.dataset.wired==='1')return;open.dataset.wired='1';
 root.querySelector('[data-login-reset-choice]')?.addEventListener('click',()=>{login.querySelector('[data-login-reset-method]').hidden=false;});
 let challengeId='',grant='';const result=panel.querySelector('[data-sms-result]');
 const notice=message=>{result.textContent=message;};
 const stage=name=>{panel.querySelectorAll('[data-sms-stage]').forEach(el=>{el.hidden=el.dataset.smsStage!==name;});};
 const email=()=>login.elements.email.value.trim().toLowerCase();
 const call=async(name,data)=>{const firebase=await getFirebaseServices();if(!firebase)throw Error('Der Dienst ist momentan nicht erreichbar.');return (await firebase.functionsLib.httpsCallable(firebase.functions,name)(data)).data;};
 open.addEventListener('click',()=>{login.elements.email.value=login.elements.email.value.trim();if(!login.elements.email.reportValidity())return;panel.hidden=false;login.hidden=true;panel.querySelector('[data-sms-email]').textContent=email();notice('Der Code wird ausschließlich an die im Konto hinterlegte Mobilnummer gesendet.');stage('request');});
 panel.querySelector('[data-sms-back]').addEventListener('click',()=>{panel.hidden=true;login.hidden=false;challengeId='';grant='';panel.querySelectorAll('input').forEach(el=>el.value='');});
 const action=(selector,fn)=>panel.querySelector(selector).addEventListener('click',async event=>{const button=event.currentTarget;if(button.disabled)return;button.disabled=true;try{await fn();}catch(error){notice(error.message||'Die Anfrage ist fehlgeschlagen.');}finally{button.disabled=false;}});
 action('[data-sms-request]',async()=>{notice('SMS-Code wird angefordert ...');const response=await call('requestLoginSmsPasswordReset',{email:email()});challengeId=response.challengeId;grant='';stage('verify');notice(response.message+' Der Code gilt 10 Minuten.');panel.querySelector('[name=smsCode]').focus();});
 action('[data-sms-verify]',async()=>{const input=panel.querySelector('[name=smsCode]');if(!input.reportValidity())return;notice('Code wird geprüft ...');const response=await call('verifyLoginSmsPasswordReset',{challengeId,code:input.value.trim()});grant=response.grant;stage('password');notice('Code bestätigt. Bitte jetzt ein neues Passwort festlegen.');panel.querySelector('[name=newPassword]').focus();});
 action('[data-sms-save]',async()=>{const password=panel.querySelector('[name=newPassword]'),repeat=panel.querySelector('[name=repeatPassword]');if(!password.reportValidity()||!repeat.reportValidity())return;if(password.value!==repeat.value){notice('Die beiden Passwörter stimmen nicht überein.');return;}notice('Neues Passwort wird gespeichert ...');await call('completeLoginSmsPasswordReset',{challengeId,grant,newPassword:password.value});grant='';challengeId='';panel.hidden=true;login.hidden=false;panel.querySelectorAll('input').forEach(el=>el.value='');login.elements.password.value='';login.querySelector('#login-result').textContent='Neues Passwort gespeichert. Bitte jetzt mit Ihrer E-Mail-Adresse und dem neuen Passwort anmelden.';login.elements.password.focus();});
}
