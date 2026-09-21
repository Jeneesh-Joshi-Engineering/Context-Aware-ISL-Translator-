"""Fetch the official PyPI TensorFlow wheel in verified parallel ranges."""
import concurrent.futures, hashlib, json, urllib.request, time, math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
with urllib.request.urlopen('https://pypi.org/pypi/tensorflow/2.20.0/json',timeout=30) as r: info=json.load(r)
wheel=next(x for x in info['urls'] if x['filename'].endswith('cp312-cp312-win_amd64.whl'))
target=ROOT/'.cache'/wheel['filename'];size=wheel['size'];block=2*1024*1024;chunks=math.ceil(size/block)
parts=ROOT/'.cache'/'tensorflow-download-parts';parts.mkdir(exist_ok=True)
def part(i):
    start=block*i;end=min(size,start+block)-1;path=parts/f'{i:04d}.part'
    if path.exists() and path.stat().st_size==end-start+1:return path
    for attempt in range(8):
        try:
            request=urllib.request.Request(wheel['url'],headers={'Range':f'bytes={start}-{end}'})
            with urllib.request.urlopen(request,timeout=90) as r:
                if r.status!=206:raise RuntimeError('Server does not support byte ranges')
                data=r.read()
            if len(data)!=end-start+1:raise RuntimeError('Incomplete download')
            path.write_bytes(data)
            if i%10==0:print(f'Saved range {i+1}/{chunks}',flush=True)
            return path
        except Exception:
            if attempt==7:raise
            time.sleep(min(attempt+1,5))
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:paths=list(pool.map(part,range(chunks)))
data=b''.join(path.read_bytes() for path in paths)
if hashlib.sha256(data).hexdigest()!=wheel['digests']['sha256']:raise RuntimeError('PyPI checksum mismatch')
target.write_bytes(data);print(f'Verified official wheel: {target}',flush=True)
