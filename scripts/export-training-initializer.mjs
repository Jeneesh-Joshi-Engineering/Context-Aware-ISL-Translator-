// Export legacy trained parameters for a reproducible transfer-learning run.
import * as tf from '@tensorflow/tfjs';
import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
const source=new URL('../isl-translator/frontend/model/model.json',import.meta.url);
const config=JSON.parse(await readFile(source,'utf8'));
const bytes=Buffer.concat(await Promise.all(config.weightsManifest.flatMap(g=>g.paths).map(p=>readFile(new URL(p,source)))));
const model=await tf.loadLayersModel(tf.io.fromMemory({modelTopology:config.modelTopology,weightSpecs:config.weightsManifest.flatMap(g=>g.weights),weightData:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)}));
if(model.outputs[0].shape.at(-1)!==4)throw new Error('Initializer must be the original four-class model');
const output=new URL('../.cache/legacy-initializer.json',import.meta.url);
await mkdir(new URL('../.cache/',import.meta.url),{recursive:true});
await writeFile(output,JSON.stringify(model.getWeights().map(t=>({shape:t.shape,values:Array.from(t.dataSync())}))));
await cp(new URL('../isl-translator/frontend/fixtures/recorded-landmarks.json',import.meta.url),new URL('../.cache/legacy-diagnostic-samples.json',import.meta.url));
model.dispose();console.log('Saved original trained initializer');
