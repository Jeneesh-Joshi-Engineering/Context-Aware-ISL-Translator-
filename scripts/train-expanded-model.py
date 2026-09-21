"""Train a fresh browser-compatible BiLSTM; never modify source recordings."""
import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
import argparse, collections, hashlib, json
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT/'isl-translator/model-training/dataset/raw'

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--epochs',type=int,default=120);parser.add_argument('--run',default='words_v4');parser.add_argument('--audit-only',action='store_true');parser.add_argument('--warm-start',action='store_true');parser.add_argument('--include-alphabets',action='store_true');args=parser.parse_args()
    import re
    if not re.fullmatch(r'[a-zA-Z0-9_-]+',args.run):raise ValueError('Invalid run name')
    out=ROOT/'isl-translator/model-training/saved_model'/args.run
    if (out/'training-report.json').exists(): raise RuntimeError('Choose a fresh --run; existing results are preserved.')
    out.mkdir(parents=True,exist_ok=True)
    rng=np.random.default_rng(42); unique={}; rejected=collections.Counter(); exports=collections.Counter(); duplicates=0; conflicts=set(); resampled=collections.Counter()
    for path in sorted(RAW.rglob('*.json')):
        data=json.loads(path.read_text(encoding='utf-8-sig'))
        for s in data.get('sequences',[]):
            label=str(s.get('label','')).strip().replace(' ','_').title()
            if label.lower()=='no_gesture':label='No_Gesture'
            if len(label)==1 and label.isalpha() and not args.include_alphabets:continue
            exports[label]+=1
            x=np.asarray(s.get('frames',[]),dtype=np.float32)
            if x.shape!=(30,126) or not np.isfinite(x).all():rejected['invalid_shape_or_values']+=1;continue
            # Capture exports include blank lead-in/out frames. Live inference only
            # consumes tracked hands: trim blanks and resample observed poses to 30.
            # Reject clips with fewer than 15 tracked frames instead of inventing a sign.
            visible=np.flatnonzero(np.any(x!=0,axis=1))
            if len(visible)<15:rejected['fewer_than_15_tracked_frames']+=1;continue
            if len(visible)<30:
                sample=np.linspace(visible[0],visible[-1],30)
                x=np.stack([np.interp(sample,visible,x[visible,j]) for j in range(126)],axis=1).astype(np.float32)
                resampled[label]+=1
            for hand in range(2):
                a=x[:,hand*63:(hand+1)*63].reshape(30,21,3)
                a-=a[:,:1,:].copy();scale=np.linalg.norm(a[:,9,:],axis=1)
                a/=np.maximum(scale,1e-6)[:,None,None]
            digest=hashlib.sha256(np.round(x,6).tobytes()).hexdigest()
            if digest in unique:
                duplicates+=1
                if unique[digest]['label']!=label:conflicts.add(digest)
                continue
            unique[digest]={'label':label,'frames':x,'timestamp':s.get('timestamp',''),'source':str(path.relative_to(RAW)),'fingerprint':digest}
    rows=[s for h,s in unique.items() if h not in conflicts]
    counts=collections.Counter(s['label'] for s in rows)
    excluded={k:v for k,v in counts.items() if v<12}
    labels=sorted(k for k,v in counts.items() if v>=12)
    splits={'train':[],'validation':[],'test':[]}
    # Chronological per-class split; exports and augmented siblings cannot cross it.
    # No signer IDs exist, so this is NOT signer-independent evaluation.
    for label in labels:
        items=sorted((s for s in rows if s['label']==label),key=lambda s:(s['timestamp'],s['fingerprint']))
        n=len(items); hold=max(2,int(round(n*.15)))
        splits['train']+=items[:-2*hold];splits['validation']+=items[-2*hold:-hold];splits['test']+=items[-hold:]
    def arrays(items):return np.stack([s['frames'] for s in items]),np.array([labels.index(s['label']) for s in items])
    xtr,ytr=arrays(splits['train']);xv,yv=arrays(splits['validation']);xt,yt=arrays(splits['test'])
    audit={'classes':labels,'unique_counts':dict(counts),'excluded_insufficient':excluded,'duplicates_removed':duplicates,'rejected':dict(rejected),'resampled_export_counts':dict(resampled),'conflicting_unique_removed':len(conflicts),'splits':{k:len(v) for k,v in splits.items()}}
    (out/'data-audit.json').write_text(json.dumps(audit,indent=2))
    print(json.dumps(audit,indent=2),flush=True)
    if args.audit_only:return
    import tensorflow as tf
    from sklearn.metrics import classification_report, confusion_matrix
    tf.keras.utils.set_random_seed(42)
    tf.config.threading.set_intra_op_parallelism_threads(4);tf.config.threading.set_inter_op_parallelism_threads(2)
    original=xtr.copy();augmented=[]
    for _ in range(3):
        a=original.copy().reshape(-1,30,2,21,3);present=np.any(a!=0,axis=(3,4),keepdims=True)
        noise=rng.normal(0,.012,a.shape).astype(np.float32);noise[:,:,:,0,:]=0
        a=(a+noise)*present
        angle=rng.uniform(-.12,.12,(len(a),1,1,1));c=np.cos(angle);s=np.sin(angle)
        oldx=a[...,0].copy();oldy=a[...,1].copy();a[...,0]=c*oldx-s*oldy;a[...,1]=s*oldx+c*oldy
        augmented.append(a.reshape(-1,30,126))
    xtr=np.concatenate([original,*augmented]);ytr=np.tile(ytr,4)
    model=tf.keras.Sequential([tf.keras.layers.Input((30,126)),
        tf.keras.layers.Bidirectional(tf.keras.layers.LSTM(64,return_sequences=True,activation='tanh',recurrent_activation='sigmoid')),
        tf.keras.layers.Dropout(.3),tf.keras.layers.Bidirectional(tf.keras.layers.LSTM(32,activation='tanh',recurrent_activation='sigmoid')),
        tf.keras.layers.Dropout(.3),tf.keras.layers.Dense(32,activation='relu'),tf.keras.layers.Dense(len(labels),activation='softmax')])
    if args.warm_start:
        initial=json.loads((ROOT/'.cache/legacy-initializer.json').read_text())
        weights=model.get_weights()
        for i in range(len(weights)-2):weights[i]=np.asarray(initial[i]['values'],dtype=np.float32).reshape(initial[i]['shape'])
        model.set_weights(weights)
    model.compile(optimizer=tf.keras.optimizers.Adam(.0003 if args.warm_start else .001),loss='sparse_categorical_crossentropy',metrics=['accuracy'])
    weight={i:len(ytr)/(len(labels)*max(1,sum(ytr==i))) for i in range(len(labels))}
    callbacks=[tf.keras.callbacks.EarlyStopping(monitor='val_loss',patience=18,restore_best_weights=True),
        tf.keras.callbacks.ReduceLROnPlateau(monitor='val_loss',patience=6,factor=.5,min_lr=1e-5)]
    if args.warm_start:
        for layer in model.layers[:-1]:layer.trainable=False
        model.compile(optimizer=tf.keras.optimizers.Adam(.003),loss='sparse_categorical_crossentropy',metrics=['accuracy'])
        model.fit(xtr,ytr,validation_data=(xv,yv),epochs=10,batch_size=32,class_weight=weight,verbose=2)
        for layer in model.layers:layer.trainable=True
        model.compile(optimizer=tf.keras.optimizers.Adam(.0003),loss='sparse_categorical_crossentropy',metrics=['accuracy'])
    history=model.fit(xtr,ytr,validation_data=(xv,yv),epochs=args.epochs,batch_size=32,class_weight=weight,callbacks=callbacks,verbose=2)
    probs=model.predict(xt,verbose=0);pred=probs.argmax(1)
    import importlib.metadata
    report={'version':args.run,'seed':42,'initialization':'legacy transfer' if args.warm_start else 'random; no pretrained data exposure','vocabulary_scope':'words and idle' if not args.include_alphabets else 'words, alphabet and idle','runtime_versions':{name:importlib.metadata.version(name) for name in ['tensorflow','keras','numpy','scikit-learn']},'classes':labels,'unique_counts':dict(counts),'excluded_insufficient':excluded,
        'duplicates_removed':duplicates,'rejected':dict(rejected),'conflicting_unique_removed':len(conflicts),
        'split_strategy':'chronological within each class after content deduplication; no signer IDs available; NOT signer-independent',
        'preprocessing':'reject fewer than 15 tracked frames; interpolate observed poses across trimmed time span to 30 frames; wrist/MCP normalization',
        'split_counts':{k:dict(collections.Counter(s['label'] for s in v)) for k,v in splits.items()},
        'test_accuracy':float(np.mean(pred==yt)), 'classification_report':classification_report(yt,pred,labels=list(range(len(labels))),target_names=labels,output_dict=True,zero_division=0),
        'confusion_matrix':confusion_matrix(yt,pred,labels=list(range(len(labels)))).tolist(),'history':history.history}
    (out/'training-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    # Raw tensors plus the explicit architecture are sufficient to reproduce the
    # deployable model; avoid optional HDF5 serialization in this Windows runtime.
    weights=model.get_weights();specs=[];offset=0
    with (out/'trained-weights.bin').open('wb') as f:
        for i,w in enumerate(weights):
            b=w.astype('<f4').tobytes();f.write(b);specs.append({'index':i,'shape':list(w.shape),'byteOffset':offset,'byteLength':len(b)});offset+=len(b)
    (out/'weights-spec.json').write_text(json.dumps(specs,indent=2))
    metadata={'model_type':'BiLSTM','version':args.run,'num_classes':len(labels),'num_frames':30,'num_features':126,
        'input_shape':[30,126],'label_mapping':{k:i for i,k in enumerate(labels)},'output_classes':labels,
        'confidence_threshold':.6,'test_accuracy':report['test_accuracy'],'training_epochs':len(history.history['loss']),
        'evaluation_scope':report['split_strategy']}
    (out/'model_metadata.json').write_text(json.dumps(metadata,indent=2))
    vp=model.predict(xv,verbose=0).argmax(1)
    (out/'validation-report.json').write_text(json.dumps(classification_report(yv,vp,labels=list(range(len(labels))),target_names=labels,output_dict=True,zero_division=0),indent=2))
    # Save held-out inputs with Python probabilities for cross-runtime numerical parity.
    parity=[dict(label=labels[int(yt[i])],frames=xt[i].tolist(),scores=probs[i].tolist(),fingerprint=splits['test'][i]['fingerprint']) for i in range(len(xt))]
    (out/'heldout-predictions.json').write_text(json.dumps(parity,separators=(',',':')))
    (out/'split-manifest.json').write_text(json.dumps({k:[{f:s[f] for f in ['label','timestamp','source','fingerprint']} for s in v] for k,v in splits.items()},indent=2))
    # Curated diagnostic examples are development inputs, not an accuracy estimate.
    allrows=splits['train']; allx,ally=arrays(allrows); allp=model.predict(allx,verbose=0); demos=[]
    for index,label in enumerate(labels):
        candidates=np.flatnonzero(ally==index);best=max(candidates,key=lambda i:allp[i,index])
        demos.append({'label':label,'frames':allx[best].tolist(),'source':allrows[best]['source'],'confidence':float(allp[best,index]),'purpose':'curated development integration example; not held-out evaluation'})
    (out/'demo-samples.json').write_text(json.dumps(demos,separators=(',',':')))
    print('TRAINING COMPLETE '+json.dumps({'test_accuracy':report['test_accuracy'],'epochs':len(history.history['loss']),'output':str(out)}),flush=True)

if __name__=='__main__':main()
