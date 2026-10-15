"""Event gallery upload authorization. No CMS permissions are granted to participants."""
import datetime, hashlib, re
from zoneinfo import ZoneInfo
from flask import request
from firebase_admin import auth

def event_window(event):
    day=str(event.get('date') or event.get('eventDate') or event.get('startDate') or '')[:10]
    zone=ZoneInfo(event.get('timeZone') or event.get('timezone') or 'Europe/Berlin')
    start=datetime.datetime.fromisoformat(day+'T'+str(event.get('startTime') or event.get('start_time') or event.get('time') or '09:00')[:5]).replace(tzinfo=zone)
    end_time=event.get('endTime') or event.get('end_time')
    end=datetime.datetime.fromisoformat(day+'T'+str(end_time)[:5]).replace(tzinfo=zone) if end_time else start+datetime.timedelta(minutes=float(event.get('durationMinutes') or event.get('defaultDurationMinutes') or 90))
    if end<=start:end=start+datetime.timedelta(minutes=float(event.get('durationMinutes') or event.get('defaultDurationMinutes') or 90))
    return start,end

def event_principal(db,viewer,event_id,payload,finishing=False):
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,100}',event_id or ''):raise ValueError('Ungültige Veranstaltung.')
    event=db.collection('events').document(event_id).get().to_dict()
    if not event:raise ValueError('Veranstaltung nicht gefunden.')
    user=viewer(optional=True)
    if user and user['editor']:return {'key':'user:'+user['uid'],'staff':True,'name':'Redaktion','event':event}
    access=db.collection('eventLiveAccess').document(event_id).get().to_dict() or {}
    if event.get('eventLiveEnabled') is not True or access.get('enabled') is not True or event.get('visible') is False or event.get('isLive') is False or event.get('status') in ('inactive','inaktiv','draft','deleted','cancelled','canceled'):raise PermissionError('Die Eventgalerie ist derzeit geschlossen.')
    try:start,end=event_window(event)
    except (ValueError,TypeError,KeyError):raise PermissionError('Die Veranstaltungszeit ist nicht verfügbar.')
    now=datetime.datetime.now(datetime.timezone.utc)
    if not start<=now<=end+datetime.timedelta(minutes=15 if finishing else 0):raise PermissionError('Video-Uploads sind nur während der Veranstaltung möglich.')
    if user:
        claims=auth.verify_id_token(request.headers['Authorization'][7:]);profile=db.collection('users').document(user['uid']).get().to_dict() or {}
        if claims.get('email_verified') is not True or profile.get('status') in ('inactive','deleted','archived','disabled') or profile.get('guestPasswordTemporary') is True:raise PermissionError('Bitte Ihren persönlichen Zugang aktivieren.')
        if profile.get('role') in ('member','mitglied') and not user.get('member'):raise PermissionError('Der Mitgliederzugang ist nicht aktiv.')
        email=str(claims.get('email') or '').strip().lower()
        regs=list(db.collection('registrations').where('eventId','==',event_id).where('email','==',email).limit(10).stream())
        regs+=list(db.collection('registrations').where('eventId','==',event_id).where('companion.email','==',email).limit(10).stream())
        allowed=('checked_in',) if profile.get('role') in ('guest','gast') else ('confirmed','checked_in')
        if not any(r.to_dict().get('status') in allowed for r in regs):raise PermissionError('Für dieses Event fehlt Ihre Anmeldung oder Ihr Check-in.')
        return {'key':'user:'+user['uid'],'staff':False,'name':str(profile.get('displayName') or profile.get('firstName') or 'Eventteilnehmer')[:100],'event':event}
    token=payload.get('ticketToken') or ''
    if not re.fullmatch(r'[a-fA-F0-9]{64}',token):raise PermissionError('Bitte zuerst am Event einchecken oder anmelden.')
    found=list(db.collection('registrations').where('ticketTokenHash','==',hashlib.sha256(token.encode()).hexdigest()).limit(1).stream())
    record=found[0].to_dict() if found else {}
    if record.get('eventId')!=event_id or record.get('status')!='checked_in' or record.get('checkedInEventId',event_id)!=event_id:raise PermissionError('Ihr Einlassticket ist für diese Veranstaltung nicht eingecheckt.')
    return {'key':'registration:'+found[0].id,'staff':False,'name':' '.join(str(record.get(k) or '') for k in ('firstName','lastName')).strip()[:100] or 'Gast','event':event}
