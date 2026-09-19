import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as tf from '@tensorflow/tfjs';
import { loadBrowserInference, recordedSamples } from '../scripts/model-runtime.mjs';
import { normalizeAndFlattenLandmarks } from '../isl-translator/frontend/js/normalize.js';

// Independent scalar LSTM reference against the original archived graph weights.
// This detects wrong direction ordering, gate activation, weight mapping, or class order.
async function referenceModel() {
  const source = new URL('../isl-translator/model-training/saved_model/transit_v2/tfjs_model/model.json', import.meta.url);
  const graph = JSON.parse(await readFile(source, 'utf8'));
  const bytes = await readFile(new URL(graph.weightsManifest[0].paths[0], source));
  const weights = {}; let offset = 0;
  for (const item of graph.weightsManifest[0].weights) {
    const length = item.shape.reduce((a,b) => a*b, 1);
    if (item.dtype === 'float32') weights[item.name] = Array.from({length}, (_,i) => bytes.readFloatLE(offset+i*4));
    offset += length*4;
  }
  const sigmoid = x => 1/(1+Math.exp(-x));
  function lstm(sequence, units, start, backward) {
    const [kernel,recurrent,bias] = [start,start+1,start+2].map(n => weights[`Func/StatefulPartitionedCall/input/_${n}`]);
    let h = Array(units).fill(0), c = Array(units).fill(0); const outputs = [];
    for (const input of backward ? [...sequence].reverse() : sequence) {
      const gates = [...bias];
      for (let i=0;i<input.length;i++) for(let j=0;j<4*units;j++) gates[j] += input[i]*kernel[i*4*units+j];
      for (let i=0;i<units;i++) for(let j=0;j<4*units;j++) gates[j] += h[i]*recurrent[i*4*units+j];
      c = c.map((v,j) => sigmoid(gates[j+units])*v + sigmoid(gates[j])*Math.tanh(gates[j+2*units]));
      h = c.map((v,j) => sigmoid(gates[j+3*units])*Math.tanh(v)); outputs.push(h);
    }
    return outputs;
  }
  function dense(input, name, units) {
    const kernel=weights[`StatefulPartitionedCall/sequential_1/${name}/Cast/ReadVariableOp`];
    const out=[...weights[`StatefulPartitionedCall/sequential_1/${name}/BiasAdd/ReadVariableOp`]];
    for(let i=0;i<input.length;i++) for(let j=0;j<units;j++) out[j] += input[i]*kernel[i*units+j];
    return out;
  }
  return sequence => {
    const forward = lstm(sequence,64,1,false), backward = lstm(sequence,64,4,true).reverse();
    const merged=forward.map((h,i) => h.concat(backward[i]));
    const last=lstm(merged,32,7,false).at(-1).concat(lstm(merged,32,10,true).at(-1));
    const logits=dense(dense(last,'dense_1',32).map(x=>Math.max(0,x)),'dense_1_2',4);
    const scores=logits.map(x=>Math.exp(x-Math.max(...logits))), sum=scores.reduce((a,b)=>a+b,0);
    return scores.map(x=>x/sum);
  };
}
test('deployed BiLSTM matches original trained weights and predicts all four recorded classes', async () => {
  const reference = await referenceModel(), samples = await recordedSamples();
  const model = await loadBrowserInference();
  try {
    for (const label of ['Help','No_Gesture','Ticket','Train']) {
      const sample=samples.find(s=>s.label===label), prediction=await model.predictSequence(sample.frames);
      assert.equal(prediction.label,label); assert.ok(prediction.confidence>=.7);
      reference(sample.frames).forEach((score,i) => assert.ok(Math.abs(score-prediction.scores[i])<1e-5, `${label}: probability mismatch`));
    }
    const before=tf.memory().numTensors;
    for(let i=0;i<8;i++) await model.predictSequence(samples[0].frames);
    assert.equal(tf.memory().numTensors,before,'prediction tensors must be disposed');
    await assert.rejects(model.predictSequence([[0]]),/30 frames/);
  } finally {model.dispose();}
});
test('rolling camera inference emits stable gloss once and suppresses idle', async () => {
  const emitted=[], samples=await recordedSamples();
  const model=await loadBrowserInference({onPrediction:p=>emitted.push(p.label)});
  try {
    for(const label of ['Help','No_Gesture','Help']) {
      const frames=samples.find(s=>s.label===label).frames;
      model.reset();
      for(const frame of [...frames,...frames.slice(-12)]) await model.pushFrame(frame);
    }
    assert.deepEqual(emitted,['Help','Help']);
  } finally {model.dispose();}
});
test('browser normalization is invariant to translation and positive scale', () => {
  const hand=Array.from({length:21},(_,i)=>({x:i*.01,y:i*.02,z:i*.003}));
  const transformed=hand.map(p=>({x:p.x*3+.4,y:p.y*3-.2,z:p.z*3+.1}));
  normalizeAndFlattenLandmarks(hand).forEach((v,i)=>assert.ok(Math.abs(v-normalizeAndFlattenLandmarks(transformed)[i])<1e-10));
});
