"""PPTX package inspection. Only referenced embedded media is extracted."""
import posixpath, zipfile, xml.etree.ElementTree as ET
NS={'p':'http://schemas.openxmlformats.org/presentationml/2006/main','a':'http://schemas.openxmlformats.org/drawingml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
AUDIO_EXT={'.mp3','.wav','.m4a','.aac','.wma','.ogg','.oga','.flac','.aiff','.aif','.mp4'}
def inspect_pptx(path):
    with zipfile.ZipFile(path) as z:
        entries=z.infolist()
        if len(entries)>10000 or sum(i.file_size for i in entries)>512*1024*1024: raise ValueError('Die PPTX ist entpackt zu groß.')
        if any(i.file_size>128*1024*1024 or (i.compress_size and i.file_size/i.compress_size>1000) for i in entries): raise ValueError('Die PPTX überschreitet die Dateigrenzen.')
        def xml(name):
            data=z.read(name)
            if b'<!DOCTYPE' in data or b'<!ENTITY' in data: raise ValueError('Nicht unterstütztes XML.')
            return ET.fromstring(data)
        def rels(part):
            relname=posixpath.join(posixpath.dirname(part),'_rels',posixpath.basename(part)+'.rels')
            if relname not in z.namelist(): return {}
            result={}
            for r in xml(relname):
                if r.get('TargetMode')=='External': continue
                target=posixpath.normpath(posixpath.join(posixpath.dirname(part),r.get('Target','')))
                if target.startswith('../') or target.startswith('/'): continue
                result[r.get('Id')]={'target':target,'type':r.get('Type','')}
            return result
        presentation=xml('ppt/presentation.xml'); relationships=rels('ppt/presentation.xml')
        title=''
        if 'docProps/core.xml' in z.namelist():
            title=xml('docProps/core.xml').findtext('{http://purl.org/dc/elements/1.1/}title') or ''
        slides=[]
        for slide_id in presentation.findall('p:sldIdLst/p:sldId',NS):
            relationship=relationships.get(slide_id.get('{'+NS['r']+'}id'))
            if not relationship: raise ValueError('Folienreihenfolge fehlt.')
            part=relationship['target']; root=xml(part); links=rels(part)
            texts=[n.text or '' for n in root.findall('.//a:t',NS)]
            audio=[];seen=set()
            for node in root.iter():
                local=node.tag.split('}')[-1]
                if local not in ('audioFile','snd','media','wavAudioFile'): continue
                for key in ('embed','link'):
                    r=links.get(node.get('{'+NS['r']+'}'+key))
                    if not r: continue
                    target=r['target']
                    if target in seen or posixpath.splitext(target)[1].lower() not in AUDIO_EXT: continue
                    if target not in z.namelist(): continue
                    seen.add(target);audio.append(target)
            notes=[]
            for r in links.values():
                if r['type'].endswith('/notesSlide'):
                    nr=xml(r['target'])
                    for shape in nr.findall('.//p:sp',NS):
                        ph=shape.find('p:nvSpPr/p:nvPr/p:ph',NS)
                        if ph is not None and ph.get('type') in ('sldNum','hdr','ftr','dt','sldImg'): continue
                        notes.extend(n.text or '' for n in shape.findall('.//a:t',NS))
            transition=root.find('p:transition',NS)
            duration_ms=int(transition.get('advTm','5000')) if transition is not None else 5000
            slides.append({'part':part,'title':texts[0][:300] if texts else 'Folie '+str(len(slides)+1),'notes':'\n'.join(notes)[:20000],'audio':audio,'advanceSeconds':max(1,min(300,duration_ms/1000)),'hidden':root.get('show')=='0'})
        if not 1<=len(slides)<=200: raise ValueError('Es sind 1 bis 200 Folien erlaubt.')
        return {'title':title.strip() or slides[0]['title'],'slides':slides}
