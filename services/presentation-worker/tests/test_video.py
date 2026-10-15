import pathlib, tempfile, subprocess, sys
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]))
from video_routes import convert,probe
with tempfile.TemporaryDirectory() as temp:
    p=pathlib.Path(temp)
    for name,size,audio in [('landscape','1920x1080',True),('portrait','720x1280',False)]:
        source=p/(name+'.mov');out=p/(name+'.mp4');poster=p/(name+'.webp')
        cmd=['ffmpeg','-y','-v','error','-f','lavfi','-i','testsrc2=size='+size+':rate=30']
        if audio:cmd+=['-f','lavfi','-i','sine=frequency=440:sample_rate=44100']
        cmd+=['-t','1','-c:v','mpeg4','-q:v','2']
        if audio:cmd+=['-c:a','pcm_s16le']
        subprocess.run(cmd+[str(source)],check=True)
        meta=convert(source,out,poster)
        assert meta['width']<=1280 and meta['height']<=720
        assert meta['width']%2==0 and meta['height']%2==0
        assert out.stat().st_size<source.stat().st_size
        assert poster.stat().st_size>0
        raw=out.read_bytes();assert raw.index(b'moov')<raw.index(b'mdat')
        print('PASS',name,'H.264/AAC conversion, smaller file, poster, faststart',meta)
    bad=p/'bad.mp4';bad.write_bytes(b'not a video')
    try:probe(bad);raise AssertionError('invalid accepted')
    except subprocess.CalledProcessError:pass
print('PASS invalid input rejected')
