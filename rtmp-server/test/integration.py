"""Run against srt-isolated-test, whose mock backend never touches production data."""
import subprocess,time,urllib.request,json,re
C='srt-isolated-test'
processes=[]
def publish(protocol,key='test-key'):
    url=f'rtmp://127.0.0.1:1935/live/{key}' if protocol=='rtmp' else f'srt://127.0.0.1:8890?mode=caller&streamid=publish:live/{key}&pkt_size=1316&latency=200000'
    args=['docker','exec',C,'ffmpeg','-hide_banner','-loglevel','error','-re','-f','lavfi','-i','testsrc2=size=320x180:rate=25','-f','lavfi','-i','sine=frequency=1000:sample_rate=48000','-t','90','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-g','50','-c:a','aac','-f','flv' if protocol=='rtmp' else 'mpegts',url]
    p=subprocess.Popen(args,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
    processes.append(p);return p

def stop_all():
    subprocess.run(['docker','exec',C,'pkill','-INT','ffmpeg'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    for p in processes:
        try:p.wait(timeout=8)
        except subprocess.TimeoutExpired:p.kill();p.wait()
    processes.clear()

def state():
    r=subprocess.run(['docker','exec',C,'node','-e','fetch("http://127.0.0.1:3000/state").then(r=>r.text()).then(console.log)'],capture_output=True,text=True,check=True)
    return json.loads(r.stdout)

def wait_state(protocol):
    for _ in range(30):
        current=state()
        if (protocol is None and not current) or (protocol and any(c['channelId']=='test-channel' and c['protocol']==protocol for c in current)):return
        time.sleep(.5)
    raise AssertionError(('state timeout',protocol,current))

def playlist():
    base='http://127.0.0.1:19000/live/test-channel/'
    for _ in range(35):
        try:
            with urllib.request.urlopen(base+'index.m3u8',timeout=3) as r:text=r.read().decode()
            assert 'test-key' not in text
            lines=[s for s in text.splitlines() if s and not s.startswith('#')]
            if lines and lines[0].split('?')[0].endswith('.m3u8'):
                with urllib.request.urlopen(base+lines[0],timeout=3) as r:text=r.read().decode()
            seg=[s for s in text.splitlines() if s and not s.startswith('#')]
            if seg:
                with urllib.request.urlopen(base+seg[-1],timeout=3) as r:assert len(r.read())>188
                break
        except (urllib.error.HTTPError,urllib.error.URLError,AssertionError):pass
        time.sleep(.5)
    else:raise AssertionError('HLS unavailable')
    result=subprocess.run(['docker','exec',C,'ffmpeg','-hide_banner','-loglevel','error','-i','http://127.0.0.1:8000/live/test-channel/index.m3u8','-t','2','-f','null','-'],capture_output=True,text=True,timeout=20)
    assert result.returncode==0,result.stderr

try:
    for protocol,other in [('rtmp','srt'),('srt','rtmp')]:
        subprocess.run(['docker','exec',C,'node','-e',f'fetch("http://127.0.0.1:3000/select/{protocol}")'],check=True)
        disabled=publish(other)
        disabled.wait(timeout=15);assert disabled.returncode!=0
        print(f'OK: entrada {other} desactivada incluso sin señal activa',flush=True)
        first=publish(protocol)
        wait_state(protocol)
        playlist()
        print(f'OK: {protocol} -> misma URL HLS, segmento descargado y audio/video decodificados',flush=True)
        second=publish(other)
        second.wait(timeout=15)
        assert second.returncode!=0, 'Second publisher accepted'
        assert first.poll() is None,'Original publisher was interrupted'
        wait_state(protocol)
        # Duplicate of the same protocol also must be refused.
        duplicate=publish(protocol)
        duplicate.wait(timeout=15)
        assert duplicate.returncode!=0
        assert first.poll() is None
        print(f'OK: {other} y duplicado {protocol} rechazados sin cortar primera señal',flush=True)
        stop_all();wait_state(None)
        print('OK: canal fuera de línea tras desconectar; listo para cambiar protocolo',flush=True)
    bad=publish('srt','invalid-key');bad.wait(timeout=15);assert bad.returncode!=0
    wait_state(None)
    print('OK: clave SRT inválida rechazada',flush=True)
    # Two different channels may transmit at the same time.
    subprocess.run(['docker','exec',C,'node','-e','fetch("http://127.0.0.1:3000/select/rtmp")'],check=True)
    a=publish('rtmp');b=publish('srt','second-key')
    for _ in range(20):
        if len(state())==2:break
        time.sleep(.5)
    assert len(state())==2
    print('OK: canales diferentes pueden usar protocolos distintos simultáneamente',flush=True)
finally:
    stop_all()
