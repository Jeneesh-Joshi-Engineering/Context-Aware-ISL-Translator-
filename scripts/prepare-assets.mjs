import { cp, mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vendor = path.join(root, 'isl-translator/frontend/vendor');
await mkdir(vendor, { recursive: true });
for (const [source, dest] of [
  ['@tensorflow/tfjs/dist/tf.min.js', 'tf.min.js'],
  ['@stomp/stompjs/bundles/stomp.umd.min.js', 'stomp.umd.min.js'],
  ['sockjs-client/dist/sockjs.min.js', 'sockjs.min.js'],
  ['qrcodejs/qrcode.min.js', 'qrcode.min.js'],
  ['@mediapipe/tasks-vision/vision_bundle.mjs', 'vision_bundle.mjs'],
  ['@mediapipe/tasks-vision/wasm', 'wasm'],
]) await cp(path.join(root, 'node_modules', source), path.join(vendor, dest), { recursive: true });

const taskFile = path.join(vendor, 'hand_landmarker.task');
try { await access(taskFile); } catch {
  const response = await fetch('https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task');
  if (!response.ok) throw new Error(`MediaPipe download failed: ${response.status}`);
  await writeFile(taskFile, Buffer.from(await response.arrayBuffer()));
}
// Real recorded landmarks for an explicitly labelled, reproducible pipeline check.
// These are development fixtures, not an independent model-accuracy evaluation.
const fixtureDir = path.join(root, 'isl-translator/frontend/fixtures');
await mkdir(fixtureDir, { recursive: true });
const { readdir } = await import('node:fs/promises');
const raw = path.join(root, 'isl-translator/model-training/dataset/raw');
const samples = [];
for (const entry of await readdir(raw, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const folder = entry.name;
  for (const file of (await readdir(path.join(raw, folder))).filter(f => f.endsWith('.json')).sort()) {
    const data = JSON.parse(await readFile(path.join(raw, folder, file), 'utf8'));
    for (const sequence of data.sequences || []) {
      if (sequence.frames?.length === 30 && sequence.frames.every(f => Array.isArray(f) && f.length === 126))
        samples.push({ label: sequence.label, source: `${folder}/${file}`, frames: sequence.frames });
    }
  }
}
await writeFile(path.join(fixtureDir, 'recorded-landmarks.json'), JSON.stringify(samples));
console.log(`Prepared local browser assets and ${samples.length} recorded landmark sequences.`);
