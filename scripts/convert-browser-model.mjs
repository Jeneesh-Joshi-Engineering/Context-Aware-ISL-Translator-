// Repackage the existing trained weights as TF.js Layers, avoiding broken SavedModel while-loop exports.
// Architecture and trained values are unchanged; no training or guessed weights occur here.
import * as tf from '@tensorflow/tfjs';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const source = new URL('../isl-translator/model-training/saved_model/transit_v2/tfjs_model/model.json', import.meta.url);
const output = new URL('../isl-translator/frontend/model/', import.meta.url);
const deployed = JSON.parse(await readFile(new URL('model_metadata.json', output), 'utf8'));
if (deployed.version && !process.argv.includes('--restore-original')) {
  throw new Error('An expanded trained model is deployed. Use export-expanded-model.mjs, or explicitly --restore-original to replace it with the legacy model.');
}
const graph = JSON.parse(await readFile(source, 'utf8'));
const bytes = Buffer.concat(await Promise.all(graph.weightsManifest.flatMap(g => g.paths).map(p => readFile(new URL(p, source)))));
const decoded = tf.io.decodeWeights(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), graph.weightsManifest.flatMap(g => g.weights));
const model = tf.sequential();
model.add(tf.layers.bidirectional({ inputShape:[30,126], mergeMode:'concat', layer:tf.layers.lstm({units:64,returnSequences:true,activation:'tanh',recurrentActivation:'sigmoid'}) }));
model.add(tf.layers.dropout({rate:0.3}));
model.add(tf.layers.bidirectional({ mergeMode:'concat', layer:tf.layers.lstm({units:32,returnSequences:false,activation:'tanh',recurrentActivation:'sigmoid'}) }));
model.add(tf.layers.dropout({rate:0.3}));
model.add(tf.layers.dense({units:32,activation:'relu'}));
model.add(tf.layers.dense({units:4,activation:'softmax'}));
const weight = name => { if (!decoded[name]) throw new Error(`Missing original weight ${name}`); return decoded[name]; };
model.layers[0].setWeights([1,2,3,4,5,6].map(n => weight(`Func/StatefulPartitionedCall/input/_${n}`)));
model.layers[2].setWeights([7,8,9,10,11,12].map(n => weight(`Func/StatefulPartitionedCall/input/_${n}`)));
for (const [index, prefix] of [[4,'dense_1'],[5,'dense_1_2']]) model.layers[index].setWeights([
  weight(`StatefulPartitionedCall/sequential_1/${prefix}/Cast/ReadVariableOp`),
  weight(`StatefulPartitionedCall/sequential_1/${prefix}/BiasAdd/ReadVariableOp`),
]);
await model.save(tf.io.withSaveHandler(async artifacts => {
  const manifest = {format:'layers-model',generatedBy:'ISL Bridge: lossless trained-weight repack',convertedBy:'scripts/convert-browser-model.mjs',
    modelTopology:artifacts.modelTopology, weightsManifest:[{paths:['group1-shard1of1.bin'],weights:artifacts.weightSpecs}],
    userDefinedMetadata:{sourceWeightsSha256:createHash('sha256').update(bytes).digest('hex'),source:'transit_v2',classes:['Help','No_Gesture','Ticket','Train']}};
  await writeFile(new URL('model.json',output),JSON.stringify(manifest));
  await writeFile(new URL('group1-shard1of1.bin',output),Buffer.from(artifacts.weightData));
  return {modelArtifactsInfo:{dateSaved:new Date(),modelTopologyType:'JSON'}};
}));
model.dispose(); Object.values(decoded).forEach(t => t.dispose());
console.log('Repacked all 16 trained tensors into a browser-native two-layer BiLSTM.');
