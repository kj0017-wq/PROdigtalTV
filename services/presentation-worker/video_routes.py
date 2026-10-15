"""Direct uploads in the existing media_videos library; private source + H.264/AAC delivery."""
import datetime, json, pathlib, subprocess, tempfile, uuid, math
from flask import request, jsonify, Response
from google.cloud import firestore
from event_video_access import event_principal
MAX_SIZE = 500 * 1024 * 1024
EXTENSIONS = {'.mp4', '.mov', '.m4v', '.webm', '.mkv', '.avi'}

def probe(path):
    data=json.loads(subprocess.check_output(['ffprobe','-v','error','-protocol_whitelist','file,pipe','-show_streams','-show_format','-of','json',str(path)],timeout=30))
    streams=[s for s in data.get('streams',[]) if s.get('codec_type')=='video' and not s.get('disposition',{}).get('attached_pic')]
    if not streams: raise ValueError('Die Datei enthält keine Videospur.')
    duration=float(data.get('format',{}).get('duration',0))
    if not math.isfinite(duration) or not 0<duration<=1800: raise ValueError('Videos dürfen höchstens 30 Minuten lang sein.')
    if max(int(streams[0].get('width',0)),int(streams[0].get('height',0)))>8192: raise ValueError('Die Videoauflösung ist zu groß.')
    return duration,streams[0]

def convert(source,output,poster):
    duration,input_stream=probe(source)
    subprocess.run(['ffmpeg','-y','-nostdin','-v','error','-protocol_whitelist','file,pipe','-i',str(source),'-map','0:'+str(input_stream['index']),'-map','0:a:0?','-map_metadata','-1','-vf',"scale=w='min(1280,iw)':h='min(720,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1,fps=30",'-c:v','libx264','-preset','fast','-crf','28','-pix_fmt','yuv420p','-threads','2','-c:a','aac','-b:a','96k','-ac','2','-movflags','+faststart',str(output)],check=True,timeout=450,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    subprocess.run(['ffmpeg','-y','-nostdin','-v','error','-i',str(output),'-frames:v','1','-vf',"scale=w='min(640,iw)':h=-2",'-c:v','libwebp',str(poster)],check=True,timeout=30,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    _,stream=probe(output)
    return {'durationSeconds':round(duration,3),'width':stream['width'],'height':stream['height'],'optimizedSize':output.stat().st_size,'codec':'H.264 / AAC','format':'MP4'}

def register_video_routes(app,db,bucket,editor,viewer,signed):
    def load(id):
        if not id or len(id)>100 or not all(c.isalnum() or c in '-_' for c in id): raise ValueError('Ungültiges Video.')
        ref=db.collection('media_videos').document(id);data=ref.get().to_dict()
        if not data or data.get('sourceType')!='upload': raise ValueError('Video nicht gefunden.')
        return ref,data
    def allowed(data,user):
        if user and user['editor']:return True
        if data.get('processingStatus')!='ready' or data.get('status') not in ('ready','published') or data.get('visible') is False or data.get('trash_status')=='paperkorb':return False
        return data.get('visibility')=='public' or (data.get('visibility')=='members' and user and user['member'])
    @app.route('/video/event-create',methods=['POST','OPTIONS'])
    @app.route('/video/create',methods=['POST','OPTIONS'])
    def video_create():
        if request.method=='OPTIONS':return '',204
        payload=request.get_json() or {};event_id=str(payload.get('eventId') or '') if request.path=='/video/event-create' else '';principal=event_principal(db,viewer,event_id,payload) if event_id else None
        if request.path=='/video/event-create' and not event_id:raise ValueError('Veranstaltung fehlt.')
        if principal and payload.get('rightsConfirmed') is not True:raise ValueError('Bitte bestätigen Sie, dass Sie dieses Video teilen dürfen.')
        user={'uid':principal['key']} if principal else editor();filename=pathlib.PurePath(str(payload.get('filename',''))).name
        if pathlib.Path(filename).suffix.lower() not in EXTENSIONS:raise ValueError('Bitte MP4, MOV, M4V, WebM, MKV oder AVI auswählen.')
        size=int(payload.get('size',0))
        if not 0<size<=MAX_SIZE:raise ValueError('Videos dürfen höchstens 500 MB groß sein.')
        visibility='internal' if principal else payload.get('visibility','public')
        if visibility not in ('public','members','internal'):raise ValueError('Ungültige Sichtbarkeit.')
        id='video-'+str(uuid.uuid4());source='presentations/'+id+'/original'+pathlib.Path(filename).suffix.lower()
        data={'id':id,'sourceType':'upload','mediaVideoId':id,'title':str(payload.get('title') or pathlib.Path(filename).stem)[:300],'originalFilename':filename,'originalStoragePath':source,'originalSize':size,'processingStatus':'awaiting_upload','status':'draft','visibility':'internal','intendedVisibility':visibility,'createdBy':user['uid'],'createdAt':firestore.SERVER_TIMESTAMP,'updatedAt':firestore.SERVER_TIMESTAMP}
        if principal:
            data.update(eventId=event_id,source='event-gallery-video',uploadedByName=principal['name'],caption=str(payload.get('caption') or '')[:500])
        db.collection('media_videos').document(id).set(data)
        if principal:db.collection('eventMedia').document(id).set({'id':id,'eventId':event_id,'mediaType':'video','mediaVideoId':id,'source':'event-gallery-video','title':data['title'],'caption':data.get('caption',''),'fileName':filename,'status':'uploading','visibility':'internal','uploadedBy':user['uid'],'uploadedByName':principal['name'],'uploadedAt':firestore.SERVER_TIMESTAMP,'rightsConfirmed':True})
        return jsonify(id=id,uploadUrl=signed(source,'PUT','application/octet-stream'))
    @app.route('/video/process/<id>',methods=['POST','OPTIONS'])
    def video_process(id):
        if request.method=='OPTIONS':return '',204
        ref,data=load(id)
        if data.get('source')=='event-gallery-video':
            principal=event_principal(db,viewer,data['eventId'],request.get_json() or {},finishing=True)
            if not principal['staff'] and principal['key']!=data.get('createdBy'):raise PermissionError('Dieses Video gehört zu einem anderen Teilnehmer.')
        else:editor()
        now=datetime.datetime.now(datetime.timezone.utc);run=str(uuid.uuid4())
        @firestore.transactional
        def claim(tx):
            fresh=ref.get(transaction=tx).to_dict();started=fresh.get('processingStartedAt')
            if fresh.get('processingStatus')=='processing' and started and (now-started).total_seconds()<900:raise ValueError('Dieses Video wird bereits verarbeitet.')
            tx.update(ref,{'processingStatus':'processing','processingRunId':run,'processingStartedAt':now,'processingError':'','updatedAt':firestore.SERVER_TIMESTAMP})
        claim(db.transaction());outputs=[]
        try:
            with tempfile.TemporaryDirectory(prefix='video-') as temp:
                work=pathlib.Path(temp);source=work/('original'+pathlib.Path(data['originalFilename']).suffix.lower());blob=bucket.blob(data['originalStoragePath']);blob.reload()
                if not 0<blob.size<=MAX_SIZE:raise ValueError('Das Video ist leer oder größer als 500 MB.')
                blob.download_to_filename(source);output=work/'video.mp4';poster=work/'poster.webp';meta=convert(source,output,poster)
                prefix='presentations/'+id+'/processed/'+run+'/'
                for path,file,mime in [(prefix+'video.mp4',output,'video/mp4'),(prefix+'poster.webp',poster,'image/webp')]:
                    bucket.blob(path).upload_from_filename(file,content_type=mime);outputs.append(path)
                current=ref.get().to_dict()
                if current.get('processingRunId')!=run:raise ValueError('Ein anderer Verarbeitungslauf hat diesen ersetzt.')
                visibility=current.get('intendedVisibility','internal');base='https://'+request.host
                ref.update({**meta,'originalSize':blob.size,'storagePath':outputs[0],'posterStoragePath':outputs[1],'posterImageUrl':base+'/video/poster/'+id,'processingStatus':'ready','processingError':'','visibility':visibility,'status':current.get('status','draft') if current.get('storagePath') else ('ready' if visibility!='internal' else 'draft'),'updatedAt':firestore.SERVER_TIMESTAMP})
                if current.get('source')=='event-gallery-video':db.collection('eventMedia').document(id).set({'status':'uploaded','visibility':'participants','storagePath':outputs[0],'posterStoragePath':outputs[1],'durationSeconds':meta['durationSeconds'],'updatedAt':firestore.SERVER_TIMESTAMP},merge=True)
                return jsonify(id=id,processingStatus='ready',**meta)
        except Exception as exc:
            for path in outputs:
                try:bucket.blob(path).delete()
                except Exception:pass
            app.logger.exception('Video conversion failed: %s',id)
            message=str(exc) if isinstance(exc,ValueError) else 'Video konnte nicht konvertiert werden. Das Original bleibt gespeichert; bitte erneut verarbeiten.'
            if ref.get().to_dict().get('processingRunId')==run:ref.update({'processingStatus':'error','processingError':message[:1000],'updatedAt':firestore.SERVER_TIMESTAMP})
            if data.get('source')=='event-gallery-video':db.collection('eventMedia').document(id).set({'status':'error','processingError':message[:1000]},merge=True)
            return jsonify(error=message),422
    @app.route('/video/manifest/<id>',methods=['GET','OPTIONS'])
    def video_manifest(id):
        if request.method=='OPTIONS':return '',204
        _,data=load(id);user=viewer(optional=True)
        if not allowed(data,user):raise PermissionError('Dieses Video ist nicht für diesen Zugang freigegeben.')
        if data.get('processingStatus')!='ready':raise ValueError('Das Video ist noch nicht fertig verarbeitet.')
        return jsonify(id=id,title=data.get('title'),url=signed(data.get('storagePath')),posterUrl=signed(data.get('posterStoragePath')),durationSeconds=data.get('durationSeconds'))
    @app.route('/video/poster/<id>')
    def video_poster(id):
        _,data=load(id)
        if not allowed(data,None) or not data.get('posterStoragePath'):return '',404
        return Response(bucket.blob(data['posterStoragePath']).download_as_bytes(),mimetype='image/webp')
    @app.route('/video/settings/<id>',methods=['POST','OPTIONS'])
    def video_settings(id):
        if request.method=='OPTIONS':return '',204
        editor();ref,data=load(id);payload=request.get_json() or {};visibility=payload.get('visibility',data.get('visibility','internal'));status=payload.get('status',data.get('status','draft'))
        if visibility not in ('public','members','internal') or status not in ('ready','draft','hidden'):raise ValueError('Ungültige Freigabe.')
        if status=='ready' and data.get('processingStatus')!='ready':raise ValueError('Bitte das Video zuerst verarbeiten.')
        ref.update({'title':str(payload.get('title') or data['title'])[:300],'description':str(payload.get('description',''))[:5000],'caption':str(payload.get('description',''))[:5000],'visibility':visibility,'intendedVisibility':visibility,'status':status,'visible':status=='ready','updatedAt':firestore.SERVER_TIMESTAMP})
        return jsonify(ok=True)

    @app.route('/video/event-list/<event_id>',methods=['POST','OPTIONS'])
    def event_video_list(event_id):
        if request.method=='OPTIONS':return '',204
        principal=event_principal(db,viewer,event_id,request.get_json() or {})
        videos=[]
        for snapshot in db.collection('eventMedia').where('eventId','==',event_id).stream():
            item=snapshot.to_dict()
            if item.get('source')!='event-gallery-video' or item.get('mediaType')!='video' or item.get('status') not in ('uploaded','error','uploading'):continue
            own=principal['staff'] or item.get('uploadedBy')==principal['key']
            if item['status']!='uploaded' and not own:continue
            videos.append({'id':snapshot.id,'mediaVideoId':snapshot.id,'sourceType':'upload','title':item.get('title','Video'),'caption':item.get('caption',''),'uploadedByName':item.get('uploadedByName',''),'status':item['status'],'canDelete':own,'canRetry':own and item['status']=='error','processingError':item.get('processingError',''),'posterUrl':signed(item.get('posterStoragePath')) if item['status']=='uploaded' else ''})
        return jsonify(videos=videos[:200],eventTitle=principal['event'].get('title','Eventgalerie'))
    @app.route('/video/event-manifest/<id>',methods=['POST','OPTIONS'])
    def event_video_manifest(id):
        if request.method=='OPTIONS':return '',204
        _,data=load(id)
        if data.get('source')!='event-gallery-video':raise PermissionError('Dieses Video gehört nicht zur Eventgalerie.')
        event_principal(db,viewer,data['eventId'],request.get_json() or {})
        media=db.collection('eventMedia').document(id).get().to_dict() or {}
        if media.get('status')!='uploaded' or data.get('processingStatus')!='ready':raise PermissionError('Das Video ist nicht verfügbar.')
        return jsonify(id=id,url=signed(data.get('storagePath')),posterUrl=signed(data.get('posterStoragePath')))
    @app.route('/video/event-delete/<id>',methods=['POST','OPTIONS'])
    def event_video_delete(id):
        if request.method=='OPTIONS':return '',204
        _,data=load(id);principal=event_principal(db,viewer,data.get('eventId'),request.get_json() or {})
        if not principal['staff'] and principal['key']!=data.get('createdBy'):raise PermissionError('Sie können nur Ihre eigenen Videos entfernen.')
        batch=db.batch();batch.update(db.collection('media_videos').document(id),{'status':'archived','visible':False,'trash_status':'paperkorb'});batch.update(db.collection('eventMedia').document(id),{'status':'deleted','visibility':'internal'});batch.commit()
        return jsonify(ok=True)
