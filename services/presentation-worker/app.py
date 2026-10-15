import hashlib
import os, io, json, uuid, tempfile, subprocess, datetime, pathlib, zipfile, time
from flask import Flask, request, jsonify, Response
import firebase_admin
from firebase_admin import auth
from google.cloud import firestore, storage
import google.auth
from google.auth.transport.requests import Request
import fitz
from PIL import Image
from pptx_package import inspect_pptx
PROJECT=os.environ.get('GOOGLE_CLOUD_PROJECT','prodigitaltv-da47b')
BUCKET=os.environ.get('STORAGE_BUCKET','prodigitaltv-da47b-presentations')
firebase_admin.initialize_app(options={'projectId':PROJECT})
db=firestore.Client(project=PROJECT);bucket=storage.Client(project=PROJECT).bucket(BUCKET)
app=Flask(__name__)
ALLOWED={'https://prodigitaltv.de','https://www.prodigitaltv.de','https://prodigitaltv.web.app','https://prodigitaltv-da47b.web.app'}
@app.after_request
def cors(response):
    origin=request.headers.get('Origin','')
    if origin in ALLOWED or origin.startswith('http://localhost:'): response.headers['Access-Control-Allow-Origin']=origin;response.headers['Vary']='Origin'
    response.headers['Access-Control-Allow-Headers']='Authorization,Content-Type'
    response.headers['Access-Control-Allow-Methods']='GET,POST,OPTIONS'
    response.headers['Cache-Control']='private, no-store'
    return response
@app.errorhandler(Exception)
def error(exc):
    if isinstance(exc,PermissionError): return jsonify(error=str(exc)),403
    if isinstance(exc,ValueError): return jsonify(error=str(exc)),400
    app.logger.exception('Presentation request failed')
    return jsonify(error='Die Verarbeitung ist fehlgeschlagen. Die Originaldatei bleibt gespeichert.'),500

def viewer(optional=False):
    bearer=request.headers.get('Authorization','')
    if not bearer.startswith('Bearer '):
        if optional:return None
        raise PermissionError('Bitte im CMS anmelden.')
    try: claims=auth.verify_id_token(bearer[7:])
    except Exception as exc:
        app.logger.warning('Firebase token verification failed: %s: %s', type(exc).__name__, str(exc))
        raise PermissionError('Die Anmeldung ist abgelaufen.')
    profile=db.collection('users').document(claims['uid']).get().to_dict() or {}
    role=str(profile.get('role',claims.get('role',''))).lower()
    editor=role in ('admin','administrator','owner','editor','redakteur','redaktion') and profile.get('status')!='inactive'
    member=False
    if not editor and role in ('member','mitglied') and profile.get('status')!='inactive' and profile.get('memberId'):
        m=db.collection('members').document(profile['memberId']).get().to_dict() or {}
        effective=m.get('membershipAccessEffectiveAt');blocked=m.get('membershipAccessStatus') in ('inactive','cancelled')
        if effective and hasattr(effective,'timestamp') and effective.timestamp()>datetime.datetime.now(datetime.timezone.utc).timestamp():blocked=False
        member=m.get('status')=='active' and not blocked
    return {'uid':claims['uid'],'editor':editor,'member':member}
def editor():
    user=viewer()
    if not user['editor']:raise PermissionError('Nur Redaktion und Administration dürfen Präsentationen verarbeiten.')
    return user

def load_gallery(id):
    if not id or '/' in id or len(id)>100:raise ValueError('Ungültige Präsentation.')
    snapshot=db.collection('galleries').document(id).get();data=snapshot.to_dict()
    if not data or data.get('type')!='presentation':raise ValueError('Präsentation nicht gefunden.')
    return snapshot,data

def accessible(data,user):
    if user and user['editor']:return True
    if data.get('status')!='published':return False
    return data.get('visibility')=='public' or (data.get('visibility')=='members' and user and user['member'])

def signed(path,method="GET",content_type=None):
    if not path or not path.startswith('presentations/'):return ''
    credentials,_=google.auth.default(scopes=['https://www.googleapis.com/auth/cloud-platform']);credentials.refresh(Request())
    account=os.environ['SIGNING_ACCOUNT']
    return bucket.blob(path).generate_signed_url(version='v4',expiration=datetime.timedelta(minutes=10) if method=='PUT' else datetime.timedelta(hours=2),method=method,content_type=content_type,service_account_email=account,access_token=credentials.token)

@app.route('/health')
def health():return jsonify(ok=True,converter='LibreOffice / WebP / MP3')
@app.route('/create',methods=['POST','OPTIONS'])
def create():
    if request.method=='OPTIONS':return '',204
    user=editor();payload=request.get_json() or {};filename=pathlib.PurePath(str(payload.get('filename',''))).name
    if not filename.lower().endswith('.pptx'):raise ValueError('Bitte eine .pptx-Datei auswählen.')
    size=int(payload.get('size',0))
    if not 0<size<=80*1024*1024:raise ValueError('PPTX-Dateien dürfen höchstens 80 MB groß sein.')
    id='presentation-'+str(uuid.uuid4());stamp=firestore.SERVER_TIMESTAMP
    target=payload.get('target') or {};collection=target.get('collection','');target_id=str(target.get('id',''))
    if collection not in ('editorialContent','events','topics') or '/' in target_id:target={}
    visibility=payload.get('visibility','internal')
    if visibility not in ('public','members','internal'):raise ValueError('Ungültige Sichtbarkeit.')
    source='presentations/'+id+'/original.pptx';title=str(payload.get('title','')).strip()[:300]
    gallery={'id':id,'type':'presentation','mediaType':'presentation','title':title or filename[:-5],'titleManual':bool(title),'images':[],'slides':[],'slideCount':0,'processingStatus':'awaiting_upload','originalStoragePath':source,'originalFilename':filename,'visibility':'internal','intendedVisibility':visibility,'status':'draft','createdBy':user['uid'],'createdAt':stamp,'updatedAt':stamp,'schemaVersion':1,'target':target}
    asset={'id':id,'media_type':'presentation','type':'presentation','title':gallery['title'],'galleryId':id,'presentationId':id,'filename_original':filename,'file_size':size,'storagePath':source,'originalStoragePath':source,'status':'active','visibility':'internal','processingStatus':'awaiting_upload','createdAt':stamp,'updatedAt':stamp}
    batch=db.batch();batch.set(db.collection('galleries').document(id),gallery);batch.set(db.collection('media_assets').document(id),asset);batch.commit()
    return jsonify(id=id,storagePath=source,uploadUrl=signed(source,method="PUT",content_type="application/vnd.openxmlformats-officedocument.presentationml.presentation"))

@app.route('/manifest/<id>',methods=['GET','OPTIONS'])
def manifest(id):
    if request.method=='OPTIONS':return '',204
    _,data=load_gallery(id);user=viewer(optional=True)
    if not accessible(data,user):raise PermissionError('Für diese Präsentation fehlt die Freigabe.')
    result={k:data.get(k) for k in ('id','type','title','slideCount','audioCount','durationSeconds','processingStatus','processingError','originalFilename')}
    result['originalUrl']=signed(data.get('originalStoragePath'))
    result['slides']=[]
    for slide in data.get('slides',[]):
        notes=bucket.blob(slide['transcriptStoragePath']).download_as_bytes().decode('utf-8') if slide.get('transcriptStoragePath') else slide.get('notes','')
        result['slides'].append({**slide,'notes':notes,'url':signed(slide.get('storagePath')),'audioTracks':[{**a,'url':signed(a.get('storagePath'))} for a in slide.get('audioTracks',[])]})
    return jsonify(result)

@app.route('/poster/<id>')
def poster(id):
    _,data=load_gallery(id)
    if not accessible(data,None) or not data.get('slides'):return '',404
    blob=bucket.blob(data['slides'][0]['storagePath'])
    return Response(blob.download_as_bytes(),mimetype='image/webp',headers={'Cache-Control':'public,max-age=300'})

@app.route('/process/<id>',methods=['POST','OPTIONS'])
def process(id):
    if request.method=='OPTIONS':return '',204
    editor();snapshot,data=load_gallery(id);ref=snapshot.reference;run=str(uuid.uuid4());now=datetime.datetime.now(datetime.timezone.utc)
    @firestore.transactional
    def claim(tx):
        fresh=ref.get(transaction=tx).to_dict();started=fresh.get('processingStartedAt')
        if fresh.get('narrationStatus')=='processing' and (time.time()*1000-fresh.get('narrationStartedAt',0))<900000:raise ValueError('Die Vertonung läuft noch. Bitte anschließend erneut verarbeiten.')
        if fresh.get('processingStatus')=='processing' and started and (now-started).total_seconds()<900:raise ValueError('Diese Präsentation wird bereits verarbeitet.')
        tx.update(ref,{'processingStatus':'processing','processingRunId':run,'processingStartedAt':now,'processingError':'','updatedAt':firestore.SERVER_TIMESTAMP})
    claim(db.transaction());asset_ref=db.collection('media_assets').document(id);asset_ref.set({'processingStatus':'processing','processingError':''},merge=True)
    outputs=[];deadline=time.monotonic()+450
    try:
        with tempfile.TemporaryDirectory(prefix='pptx-') as temp:
            work=pathlib.Path(temp);original=work/'original.pptx';blob=bucket.blob(data['originalStoragePath']);blob.reload()
            if blob.size>80*1024*1024:raise ValueError('Die PPTX ist größer als 80 MB.')
            blob.download_to_filename(original);package=inspect_pptx(original)
            env={**os.environ,'HOME':temp}
            conversion=subprocess.run(['libreoffice','-env:UserInstallation=file://'+str(work/'profile'),'--headless','--convert-to','pdf:impress_pdf_Export:{"ExportHiddenSlides":{"type":"boolean","value":"true"}}','--outdir',temp,str(original)],check=True,timeout=240,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=env)
            pdf=work/'original.pdf'
            if not pdf.exists():
                app.logger.error('LibreOffice output: %s', (conversion.stdout+conversion.stderr).decode('utf-8',errors='replace')[-2000:])
                raise ValueError('LibreOffice konnte keine Folien erzeugen.')
            slides=[];audio_count=0;total_duration=0;doc=fitz.open(pdf)
            if len(doc)!=len(package['slides']):raise ValueError('Die gerenderten Folien stimmen nicht mit der PPTX-Reihenfolge überein.')
            prefix='presentations/'+id+'/processed/'+run+'/'
            base='https://'+request.host
            with zipfile.ZipFile(original) as archive:
                for i,meta in enumerate(package['slides']):
                    if time.monotonic()>deadline:raise ValueError('Die Verarbeitung dauert zu lange. Bitte die Präsentation verkleinern und erneut versuchen.')
                    if len(meta['audio'])>20:raise ValueError('Eine Folie enthält mehr als 20 Audiospuren.')
                    notes_path=''
                    if meta['notes']:
                        notes_path=prefix+'slide-'+str(i+1)+'-notes.txt';bucket.blob(notes_path).upload_from_string(meta['notes'].encode('utf-8'),content_type='text/plain; charset=utf-8');outputs.append(notes_path)
                    page=doc[i];scale=2560/max(page.rect.width,page.rect.height);pix=page.get_pixmap(matrix=fitz.Matrix(scale,scale),alpha=False)
                    image=Image.frombytes('RGB',[pix.width,pix.height],pix.samples);buf=io.BytesIO();image.save(buf,format='WEBP',quality=94,method=6)
                    image_path=prefix+'slide-'+str(i+1)+'.webp';bucket.blob(image_path).upload_from_string(buf.getvalue(),content_type='image/webp');outputs.append(image_path)
                    tracks=[]
                    for j,media in enumerate(meta['audio']):
                        src=work/('audio-source'+pathlib.PurePosixPath(media).suffix);src.write_bytes(archive.read(media));audio=work/'audio.mp3'
                        subprocess.run(['ffmpeg','-y','-nostdin','-i',str(src),'-vn','-codec:a','libmp3lame','-q:a','2',str(audio)],check=True,timeout=120,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
                        duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',str(audio)],timeout=20).decode().strip())
                        audio_path=prefix+'slide-'+str(i+1)+'-audio-'+str(j+1)+'.mp3';bucket.blob(audio_path).upload_from_filename(audio,content_type='audio/mpeg');outputs.append(audio_path)
                        tracks.append({'storagePath':audio_path,'durationSeconds':round(duration,3),'sourcePart':media,'order':j});audio_count+=1
                    notes_hash=hashlib.sha256(meta['notes'].encode('utf-8')).hexdigest()
                    previous=next((s for s in data.get('slides',[]) if s.get('sourcePart')==meta['part'] and s.get('notesHash')==notes_hash),None)
                    if not tracks and previous:
                        tracks=[t for t in previous.get('audioTracks',[]) if t.get('source')=='tts'];audio_count+=len(tracks)
                    duration=sum(t['durationSeconds'] for t in tracks) or meta['advanceSeconds'];total_duration+=duration
                    slides.append({'id':'slide-'+str(i+1),'sourcePart':meta['part'],'notesHash':notes_hash,'order':i,'sortOrder':i,'title':meta['title'],'notes':meta['notes'][:1000],'transcriptStoragePath':notes_path,'storagePath':image_path,'url':base+'/poster/'+id if i==0 else '', 'width':pix.width,'height':pix.height,'audioTracks':tracks,'durationSeconds':duration,'hidden':meta['hidden']})
            current=ref.get().to_dict()
            if current.get('processingRunId')!=run:raise ValueError('Ein neuer Verarbeitungslauf hat diesen ersetzt.')
            if len(json.dumps(slides,ensure_ascii=False).encode('utf-8'))>700000:raise ValueError('Die Folienmetadaten sind zu umfangreich. Bitte die Präsentation aufteilen.')
            visibility=current.get('intendedVisibility','internal');status='published' if visibility in ('public','members') else 'draft'
            title=current['title'] if current.get('titleManual') else package['title'][:300]
            ref.update({'title':title,'slides':slides,'images':[{'url':base+'/poster/'+id,'storagePath':s['storagePath'],'sortOrder':s['order'],'caption':s['title']} for s in slides],'slideCount':len(slides),'audioCount':audio_count,'durationSeconds':round(total_duration,3),'processingStatus':'ready','processingError':'','visibility':visibility,'status':status,'updatedAt':firestore.SERVER_TIMESTAMP})
            asset_ref.set({'title':title,'processingStatus':'ready','slideCount':len(slides),'audioCount':audio_count,'durationSeconds':round(total_duration,3),'thumbnail_url':base+'/poster/'+id,'assetUrl':base+'/poster/'+id,'visibility':visibility,'updatedAt':firestore.SERVER_TIMESTAMP},merge=True)
            target=current.get('target') or {}
            if target.get('collection') in ('editorialContent','events','topics') and target.get('id'):
                target_ref=db.collection(target['collection']).document(target['id'])
                if target_ref.get().exists:target_ref.update({'presentationIds':firestore.ArrayUnion([id]),'updatedAt':firestore.SERVER_TIMESTAMP})
            return jsonify(id=id,processingStatus='ready',slideCount=len(slides),audioCount=audio_count)
    except Exception as exc:
        message=str(exc) if isinstance(exc,ValueError) else 'Folien oder Audio konnten nicht konvertiert werden. Original bleibt gespeichert; bitte erneut verarbeiten.'
        ref.update({'processingStatus':'error','processingError':message[:1000],'updatedAt':firestore.SERVER_TIMESTAMP});asset_ref.set({'processingStatus':'error','processingError':message[:1000],'updatedAt':firestore.SERVER_TIMESTAMP},merge=True)
        app.logger.exception('PPTX conversion failed: %s',id)
        return jsonify(error=message),422
@app.route('/settings/<id>',methods=['POST','OPTIONS'])
def settings(id):
    if request.method=='OPTIONS':return '',204
    editor();snapshot,data=load_gallery(id);payload=request.get_json() or {};patch={'updatedAt':firestore.SERVER_TIMESTAMP}
    if 'title' in payload:
        title=str(payload['title']).strip()[:300]
        if not title:raise ValueError('Bitte einen Titel angeben.')
        patch.update(title=title,titleManual=True)
    if 'visibility' in payload:
        visibility=payload['visibility']
        if visibility not in ('public','members','internal'):raise ValueError('Ungültige Freigabe.')
        patch.update(intendedVisibility=visibility,visibility=visibility,status='published' if visibility!='internal' and data.get('processingStatus')=='ready' else 'draft')
    snapshot.reference.update(patch)
    asset_patch={key:patch[key] for key in ('title','visibility') if key in patch}
    if asset_patch:db.collection('media_assets').document(id).set(asset_patch,merge=True)
    return jsonify(ok=True)

from video_routes import register_video_routes
register_video_routes(app,db,bucket,editor,viewer,signed)
