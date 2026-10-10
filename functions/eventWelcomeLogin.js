const { createHash, randomInt, randomBytes, scryptSync, timingSafeEqual } = require('node:crypto');
const { eligibleGuestCandidates } = require('./eventGuestLoginDomain');
const digest = value => createHash('sha256').update(value).digest('hex');
const normalized = value => String(value || '').trim().toLowerCase();
const lifetime = 10 * 60 * 1000;
function createEventWelcomeLogin({ db, auth, FieldValue, Timestamp, HttpsError, now = Date.now }) {
  const invalid = () => new HttpsError('permission-denied', 'Der Code ist ungültig, abgelaufen oder bereits verwendet. Bitte einen neuen Code anfordern.');
  function inputs(eventId, email) {
    email = normalized(email); eventId = String(eventId || '').trim();
    if (!eventId || eventId.includes('/') || eventId.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new HttpsError('invalid-argument', 'Bitte Event und gültige E-Mail-Adresse eingeben.');
    return { eventId, email };
  }
  async function eligible(eventId, email) {
    const [event, access, registrations] = await Promise.all([
      db.collection('events').doc(eventId).get(), db.collection('eventLiveAccess').doc(eventId).get(),
      db.collection('registrations').where('eventId', '==', eventId).get()
    ]);
    if (!event.exists || event.data().eventLiveEnabled !== true || access.data()?.enabled !== true || ['inactive','deleted','archived','draft','cancelled'].includes(normalized(event.data().status))) return null;
    const people = eligibleGuestCandidates(registrations.docs.map(d => ({ ...d.data(), id: d.id })), email);
    return people.length === 1 ? people[0] : null;
  }
  async function rate(key, limit, window) {
    const ref = db.collection('eventWelcomeLoginRates').doc(digest(key));
    await db.runTransaction(async tx => {
      const value = (await tx.get(ref)).data() || {}; const fresh = now() - (value.startedAt?.toMillis?.() || 0) >= window;
      const count = fresh ? 0 : (value.count || 0);
      if (count >= limit) throw new HttpsError('resource-exhausted', 'Bitte warten Sie einige Minuten und versuchen Sie es erneut.');
      tx.set(ref, { count: count + 1, startedAt: fresh ? Timestamp.fromMillis(now()) : value.startedAt, expiresAt: Timestamp.fromMillis(now() + window) });
    });
  }
  async function issue(eventId, email, throttled = false) {
    ({ eventId, email } = inputs(eventId, email));
    if (throttled) await rate('mail:'+eventId+':'+email, 1, 60 * 1000);
    const person = await eligible(eventId, email); if (!person) return null;
    const code = String(randomInt(0, 1000000)).padStart(6, '0'); const salt = randomBytes(16).toString('hex');
    const ref = db.collection('eventWelcomeLoginCodes').doc(digest(eventId+':'+email));
    await ref.set({ eventId, emailHash: digest(email), registrationId: person.registrationId, salt,
      codeHash: scryptSync(code, salt, 32).toString('hex'), attempts: 0, consumed: false,
      expiresAt: Timestamp.fromMillis(now() + lifetime), createdAt: FieldValue.serverTimestamp() });
    return { code, minutes: 10 };
  }
  async function requestCode(request) {
    const { eventId, email } = inputs(request.data?.eventId, request.data?.email);
    await rate('request-ip:'+String(request.rawRequest?.ip || 'unknown'), 10, lifetime);
    const issued = await issue(eventId, email, true);
    if (issued) await db.collection('mailQueue').add({ type:'event_login_code', template:'plain_message', to:email,
      subject:'Ihr Anmeldecode für den PROdigitalTV-Veranstaltungsbereich',
      text:'Ihr Anmeldecode: '+issued.code+'\n\nÖffnen Sie Ihre bereits gespeicherte PROdigitalTV-App und geben Sie dort Ihre E-Mail-Adresse und diesen Code im Veranstaltungsbereich ein.\n\nDer Code gilt 10 Minuten und kann einmal verwendet werden. Falls Sie noch keine App gespeichert haben, öffnen Sie https://prodigitaltv.de/#/event-live/'+encodeURIComponent(eventId)+' und melden Sie sich dort mit dem Code an.\n\nWenn Sie den Code nicht angefordert haben, ignorieren Sie diese Nachricht.',
      eventId, status:'queued', queuedAt:FieldValue.serverTimestamp(), createdAt:FieldValue.serverTimestamp(), updatedAt:FieldValue.serverTimestamp() });
    return { ok:true, message:'Wenn Ihre Anmeldung freigeschaltet ist, erhalten Sie einen neuen Code per E-Mail.' };
  }
  async function verify(request) {
    const { eventId, email } = inputs(request.data?.eventId, request.data?.email); const code = String(request.data?.code || '').trim();
    if (!/^\d{6}$/.test(code)) throw invalid();
    await rate('verify-ip:'+String(request.rawRequest?.ip || 'unknown'), 30, lifetime);
    const person = await eligible(eventId, email); if (!person) throw invalid();
    const ref = db.collection('eventWelcomeLoginCodes').doc(digest(eventId+':'+email));
    const accepted = await db.runTransaction(async tx => {
      const value = (await tx.get(ref)).data();
      if (!value || value.consumed || value.attempts >= 5 || value.expiresAt.toMillis() <= now() || value.registrationId !== person.registrationId) return false;
      const expected = Buffer.from(value.codeHash, 'hex'); const actual = scryptSync(code, value.salt, 32);
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) { tx.update(ref,{ attempts:value.attempts+1 }); return false; }
      tx.update(ref,{ consumed:true, consumedAt:FieldValue.serverTimestamp(), codeHash:FieldValue.delete(), salt:FieldValue.delete() }); return true;
    });
    if (!accepted) throw invalid();
    let user;
    try { user = await auth.getUserByEmail(email); } catch (error) {
      if (error.code !== 'auth/user-not-found') throw error;
      try { user = await auth.createUser({ email, emailVerified:true, displayName:[person.person.firstName,person.person.lastName].filter(Boolean).join(' ') }); }
      catch (createError) { if(createError.code !== 'auth/email-already-exists') throw createError; user = await auth.getUserByEmail(email); }
    }
    const profileRef = db.collection('users').doc(user.uid); const profile = await profileRef.get();
    if (user.multiFactor?.enrolledFactors?.length) throw new HttpsError('failed-precondition', 'Dieses Konto verwendet eine zusätzliche Sicherheitsprüfung. Bitte melden Sie sich mit Ihrem bisherigen Zugang an.');
    if (user.disabled || ['inactive','archived','deleted','disabled'].includes(normalized(profile.data()?.status))) throw new HttpsError('permission-denied','Dieser Zugang ist deaktiviert. Bitte wenden Sie sich an den Empfang.');
    const patch = !profile.exists ? { email, firstName:person.person.firstName || '', lastName:person.person.lastName || '', displayName:user.displayName || email, role:'guest',accountType:'guest',status:'active',createdVia:'welcome_email_code',createdAt:FieldValue.serverTimestamp() } : {};
    if (profile.data()?.guestPasswordTemporary === true) {
      await auth.updateUser(user.uid,{ password:randomBytes(32).toString('hex') });
      Object.assign(patch,{guestPasswordTemporary:false,guestPasswordHash:FieldValue.delete(),guestPasswordExpiresAt:FieldValue.delete()});
    }
    await auth.updateUser(user.uid,{emailVerified:true});
    await profileRef.set({...patch,updatedAt:FieldValue.serverTimestamp()},{merge:true});
    return { customToken:await auth.createCustomToken(user.uid), eventId };
  }
  return { issue, requestCode, verify };
}
module.exports = { createEventWelcomeLogin };
