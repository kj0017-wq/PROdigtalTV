import datetime, pathlib, sys, unittest
from unittest.mock import patch
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]))
import event_video_access as access
from flask import Flask
from firebase_admin import auth
NOW=datetime.datetime.now(datetime.timezone.utc);local=NOW.astimezone(access.ZoneInfo('Europe/Berlin'));start=local-datetime.timedelta(hours=1);end=local+datetime.timedelta(hours=1)
EVENT={'date':start.date().isoformat(),'startTime':start.strftime('%H:%M'),'endTime':end.strftime('%H:%M'),'eventLiveEnabled':True,'status':'published'}
TOKEN='a'*64
RECORDS={'events/e':EVENT,'eventLiveAccess/e':{'enabled':True},'registrations/r':{'eventId':'e','status':'checked_in','checkedInEventId':'e','ticketTokenHash':access.hashlib.sha256(TOKEN.encode()).hexdigest(),'email':'user@example.invalid'},'users/u':{'status':'active','role':'user'}}
class Snap:
 def __init__(self,path):self.path=path;self.id=path.split('/')[-1]
 def to_dict(self):return RECORDS.get(self.path)
class Query:
 def __init__(self,name,filters=[]):self.name=name;self.filters=filters
 def document(self,id):return type('Ref',(),{'get':lambda _:Snap(self.name+'/'+id)})()
 def where(self,field,op,value):return Query(self.name,self.filters+[(field,value)])
 def limit(self,n):return self
 def stream(self):return [Snap(k) for k,v in RECORDS.items() if k.startswith(self.name+'/') and all(v.get(f)==x for f,x in self.filters)]
class DB:
 def collection(self,name):return Query(name)
app=Flask(__name__)
class Tests(unittest.TestCase):
 def setUp(self):RECORDS['events/e']=dict(EVENT);RECORDS['eventLiveAccess/e']={'enabled':True};RECORDS['registrations/r']['status']='checked_in'
 def test_guest_checked_in_and_wrong_event(self):
  with app.test_request_context():
   result=access.event_principal(DB(),lambda **k:None,'e',{'ticketToken':TOKEN});self.assertEqual(result['key'],'registration:r')
   RECORDS['registrations/r']['status']='confirmed'
   with self.assertRaises(PermissionError):access.event_principal(DB(),lambda **k:None,'e',{'ticketToken':TOKEN})
 def test_closed_and_outside_event_rejected(self):
  with app.test_request_context():
   RECORDS['eventLiveAccess/e']['enabled']=False
   with self.assertRaises(PermissionError):access.event_principal(DB(),lambda **k:None,'e',{'ticketToken':TOKEN})
   RECORDS['eventLiveAccess/e']['enabled']=True;RECORDS['events/e']['date']='2000-01-01'
   with self.assertRaises(PermissionError):access.event_principal(DB(),lambda **k:None,'e',{'ticketToken':TOKEN})
   result=access.event_principal(DB(),lambda **k:{'uid':'a','editor':True},'e',{});self.assertTrue(result['staff'])
 def test_authenticated_user_and_email_verification(self):
  with app.test_request_context(headers={'Authorization':'Bearer test'}),patch.object(auth,'verify_id_token',lambda t:{'uid':'u','email':'user@example.invalid','email_verified':True}):
   result=access.event_principal(DB(),lambda **k:{'uid':'u','editor':False},'e',{});self.assertEqual(result['key'],'user:u')
  with app.test_request_context(headers={'Authorization':'Bearer test'}),patch.object(auth,'verify_id_token',lambda t:{'uid':'u','email':'user@example.invalid','email_verified':False}):
   with self.assertRaises(PermissionError):access.event_principal(DB(),lambda **k:{'uid':'u','editor':False},'e',{})
if __name__=='__main__':unittest.main()
