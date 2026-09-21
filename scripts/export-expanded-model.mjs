// Build TF.js topology natively and load the exact Keras-trained tensors.
import * as tf from '@tensorflow/tfjs';
import { readFile, writeFile, cp } from 'node:fs/promises';
const version=process.argv[2] || 'words_v4';
if(!/^[a-zA-Z0-9_-]+$/.test(version)) throw new Error('Invalid version');
const source=new URL(`../isl-translator/model-training/saved_model/${version}/`,import.meta.url);
const output=new URL('../isl-translator/frontend/model/',import.meta.url);
const checkOnly=process.argv.includes('--check-only');
const metadata=JSON.parse(await readFile(new URL('model_metadata.json',source),'utf8'));
const specs=JSON.parse(await readFile(new URL('weights-spec.json',source),'utf8'));
const bytes=await readFile(new URL('trained-weights.bin',source));
const model=tf.sequential();
model.add(tf.layers.bidirectional({inputShape:[30,126],mergeMode:'concat',layer:tf.layers.lstm({units:64,returnSequences:true,activation:'tanh',recurrentActivation:'sigmoid'})}));
model.add(tf.layers.dropout({rate:.3}));
model.add(tf.layers.bidirectional({mergeMode:'concat',layer:tf.layers.lstm({units:32,activation:'tanh',recurrentActivation:'sigmoid'})}));
model.add(tf.layers.dropout({rate:.3}));model.add(tf.layers.dense({units:32,activation:'relu'}));model.add(tf.layers.dense({units:metadata.num_classes,activation:'softmax'}));
const tensors=specs.map(s=>tf.tensor(Array.from({length:s.byteLength/4},(_,i)=>bytes.readFloatLE(s.byteOffset+i*4)),s.shape));
model.setWeights(tensors);tensors.forEach(t=>t.dispose());
const heldout=JSON.parse(await readFile(new URL('heldout-predictions.json',source),'utf8'));
let worst=0;
for(const sample of heldout){const x=tf.tensor3d([sample.frames]);const y=model.predict(x);const scores=await y.data();sample.scores.forEach((s,i)=>{if(!Number.isFinite(s)||!Number.isFinite(scores[i]))throw new Error('Non-finite prediction');worst=Math.max(worst,Math.abs(s-scores[i]));});x.dispose();y.dispose();}
if(worst>1e-4)throw new Error(`Cross-runtime mismatch ${worst}; deployment aborted`);
const legacySamples=JSON.parse(await readFile(new URL('demo-samples.json',source),'utf8'));
const regression=[];
for(const sample of legacySamples){
  const x=tf.tensor3d([sample.frames]);const y=model.predict(x);const scores=Array.from(await y.data());
  const index=scores.indexOf(Math.max(...scores));
  regression.push({expected:sample.label,predicted:metadata.output_classes[index],confidence:scores[index]});x.dispose();y.dispose();
}
if(regression.some(r=>r.predicted!==r.expected||r.confidence<metadata.confidence_threshold))throw new Error('Diagnostic vocabulary check failed; deployment aborted');
const verification={heldoutSequences:heldout.length,maxProbabilityDifference:worst,passed:true,trainingExampleDiagnostics:regression};
await writeFile(new URL('verification.json',source),JSON.stringify(verification,null,2));
console.log(JSON.stringify(verification,null,2));
if(checkOnly){model.dispose();process.exit(0);}
await model.save(tf.io.withSaveHandler(async a=>{
  await writeFile(new URL('model.json',output),JSON.stringify({format:'layers-model',generatedBy:`ISL Bridge ${version}`,convertedBy:'scripts/export-expanded-model.mjs',modelTopology:a.modelTopology,weightsManifest:[{paths:['group1-shard1of1.bin'],weights:a.weightSpecs}],userDefinedMetadata:{version,classes:metadata.output_classes}}));
  await writeFile(new URL('group1-shard1of1.bin',output),Buffer.from(a.weightData));return {modelArtifactsInfo:{dateSaved:new Date(),modelTopologyType:'JSON'}};
}));
await cp(new URL('model_metadata.json',source),new URL('model_metadata.json',output));
model.dispose();console.log(`Deployed ${metadata.num_classes} classes; Python/TF.js parity passed on ${heldout.length} held-out sequences (max difference ${worst}).`);
