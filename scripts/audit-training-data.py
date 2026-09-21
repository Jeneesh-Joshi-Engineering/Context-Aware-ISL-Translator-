"""Read-only recording audit; cumulative exports are deduplicated by frame content."""
import collections
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'isl-translator/model-training/dataset/raw'

def collect():
    unique = {}; counts = collections.Counter(); rejected = collections.Counter(); conflicts = []
    for path in sorted(RAW.rglob('*.json')):
        data = json.loads(path.read_text(encoding='utf-8-sig'))
        for s in data.get('sequences', []):
            label = str(s.get('label', '')).strip(); counts[label] += 1
            frames = s.get('frames', [])
            if len(frames) != 30 or any(not isinstance(f,list) or len(f)!=126 for f in frames):
                rejected[label] += 1; continue
            digest = hashlib.sha256(json.dumps(frames,separators=(',',':')).encode()).hexdigest()
            if digest in unique:
                if unique[digest]['label'] != label: conflicts.append([unique[digest]['label'],label])
                continue
            unique[digest] = dict(s, fingerprint=digest, source=str(path.relative_to(RAW)))
    return list(unique.values()), counts, rejected, conflicts

if __name__ == '__main__':
    rows, counts, rejected, conflicts = collect()
    unique = collections.Counter(s['label'] for s in rows)
    dates = collections.defaultdict(set)
    for s in rows: dates[s['label']].add(s.get('timestamp','')[:10])
    tracked=collections.defaultdict(collections.Counter)
    for s in rows:
        tracked[s['label']][sum(any(v!=0 for v in f) for f in s['frames'])]+=1
    print(json.dumps({'exported':dict(counts),'unique':dict(unique),'invalidShape':dict(rejected),
        'recordingDates':{k:sorted(v) for k,v in dates.items()},'trackedFramesPerSequence':{k:dict(sorted(v.items())) for k,v in tracked.items()},'labelConflictCount':len(conflicts)},indent=2))
