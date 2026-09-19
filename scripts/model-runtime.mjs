import * as tf from '@tensorflow/tfjs';
import { readFile } from 'node:fs/promises';
// Same inference.js used by the signer; only file transport is adapted for Node.
export async function loadBrowserInference(callbacks = {}) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => String(url).startsWith('file:')
    ? new Response(await readFile(new URL(url)), { status: 200 }) : originalFetch(url, options);
  globalThis.localStorage ||= { getItem: () => null, setItem: () => {} };
  globalThis.tf = { ...tf, loadLayersModel: async url => {
    const model = JSON.parse(await readFile(new URL(url), 'utf8'));
    const buffers = [];
    for (const group of model.weightsManifest) for (const shard of group.paths) buffers.push(await readFile(new URL(shard, url)));
    const bytes = Buffer.concat(buffers);
    return tf.loadLayersModel(tf.io.fromMemory({modelTopology:model.modelTopology,
      weightSpecs:model.weightsManifest.flatMap(g => g.weights),
      weightData:bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset+bytes.byteLength), signature:model.signature}));
  }};
  const { createInference } = await import('../isl-translator/frontend/js/inference.js');
  return createInference(callbacks);
}
export async function recordedSamples() {
  return JSON.parse(await readFile(new URL('../isl-translator/frontend/fixtures/recorded-landmarks.json', import.meta.url), 'utf8'));
}
