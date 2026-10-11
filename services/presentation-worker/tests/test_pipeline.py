import io,sys,unittest,tempfile,pathlib,copy,zipfile
from unittest.mock import patch
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]))
import firebase_admin
from firebase_admin import auth
from google.cloud import firestore,storage
ROOT=pathlib.Path(__file__).parent
RECORDS={};OBJECTS={}
class Snapshot:
    def __init__(self,ref):self.reference=ref;self.exists=ref.path in RECORDS
    def to_dict(self):return copy.deepcopy(RECORDS.get(self.reference.path))
class Ref:
    def __init__(self,path):self.path=path
    def get(self,**kwargs):return Snapshot(self)
    def update(self,data):RECORDS.setdefault(self.path,{}).update(data)
    def set(self,data,merge=False):
        if not merge:RECORDS[self.path]={}
        self.update(data)
class DB:
    def collection(self,name):return type('Collection',(),{'document':lambda _,id:Ref(name+'/'+id)})()
    def transaction(self):return type('Tx',(),{'update':lambda _,ref,data:ref.update(data)})()
    def batch(self):return type('Batch',(),{'set':lambda _,ref,data:ref.set(data),'commit':lambda _:None})()
class Blob:
    def __init__(self,path):self.path=path
    def reload(self):self.size=len(OBJECTS[self.path])
    def download_to_filename(self,path):pathlib.Path(path).write_bytes(OBJECTS[self.path])
    def download_as_bytes(self):return OBJECTS[self.path]
    def upload_from_string(self,value,**kwargs):OBJECTS[self.path]=value
    def upload_from_filename(self,path,**kwargs):OBJECTS[self.path]=pathlib.Path(path).read_bytes()
class Bucket:
    def blob(self,path):return Blob(path)
with patch.object(firestore,'Client',lambda **k:DB()),patch.object(storage,'Client',lambda **k:type('Storage',(),{'bucket':lambda _,name:Bucket()})()),patch.object(firebase_admin,'initialize_app',lambda **k:None):
    import app as worker
worker.signed=lambda path,**kwargs:'https://example.invalid/'+path if path else ''
firestore.transactional=lambda function:function
auth.verify_id_token=lambda token,**k:{'uid':'editor'}
class PipelineTests(unittest.TestCase):
    def setUp(self):
        RECORDS.clear();OBJECTS.clear();RECORDS['users/editor']={'role':'editor','status':'active'}
        RECORDS['galleries/fixture']={'id':'fixture','type':'presentation','title':'Fixture','titleManual':False,'status':'draft','visibility':'internal','intendedVisibility':'internal','originalStoragePath':'presentations/fixture/original.pptx','originalFilename':'fixture.pptx'}
        OBJECTS['presentations/fixture/original.pptx']=(ROOT/'fixture.pptx').read_bytes();self.client=worker.app.test_client();self.headers={'Authorization':'Bearer test'}
    def test_conversion_audio_notes_access_and_original_retention(self):
        original=OBJECTS['presentations/fixture/original.pptx'];response=self.client.post('/process/fixture',json={},headers=self.headers)
        self.assertEqual(response.status_code,200,response.get_json());self.assertEqual(response.json['slideCount'],3);self.assertEqual(response.json['audioCount'],1)
        result=RECORDS['galleries/fixture'];self.assertEqual([s['title'] for s in result['slides']],['Folie 3','Folie 1','Folie 2']);self.assertEqual(len(result['slides'][2]['audioTracks']),1)
        self.assertEqual(result['slides'][1]['notes'],'Sprechertext für Folie 1');self.assertGreater(result['slides'][2]['audioTracks'][0]['durationSeconds'],.9)
        self.assertEqual(original,OBJECTS['presentations/fixture/original.pptx']);self.assertEqual(self.client.get('/manifest/fixture').status_code,403)
        self.assertEqual(self.client.get('/manifest/fixture',headers=self.headers).json['slideCount'],3)
        self.client.post('/settings/fixture',json={'visibility':'public'},headers=self.headers);self.assertEqual(self.client.get('/manifest/fixture').status_code,200)
        image_bytes=OBJECTS[result['slides'][0]['storagePath']];self.assertGreater(len(image_bytes),1000);self.assertEqual(image_bytes[:4],b'RIFF')
        result['slides'][0]['audioTracks']=[{'storagePath':'presentations/fixture/narration/test.mp3','source':'tts','durationSeconds':7,'order':0}]
        again=self.client.post('/process/fixture',json={},headers=self.headers);self.assertEqual(again.status_code,200,again.json)
        self.assertEqual(RECORDS['galleries/fixture']['slides'][0]['audioTracks'][0]['source'],'tts');self.assertEqual(again.json['audioCount'],2)
        OBJECTS['presentations/fixture/original.pptx']=b'invalid PPTX';failed=self.client.post('/process/fixture',json={},headers=self.headers);self.assertEqual(failed.status_code,422)
        self.assertEqual(OBJECTS['presentations/fixture/original.pptx'],b'invalid PPTX');self.assertEqual(RECORDS['galleries/fixture']['processingStatus'],'error');self.assertEqual(len(RECORDS['galleries/fixture']['slides']),3)
        OBJECTS['presentations/fixture/original.pptx']=original;retry=self.client.post('/process/fixture',json={},headers=self.headers);self.assertEqual(retry.status_code,200,retry.json)
    def test_requests_need_editor(self):
        self.assertEqual(self.client.post('/process/fixture',json={}).status_code,403);RECORDS['users/editor']['role']='member';self.assertEqual(self.client.post('/process/fixture',json={},headers=self.headers).status_code,403)
if __name__=='__main__':unittest.main()
