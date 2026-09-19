import { loadBrowserInference, recordedSamples } from './model-runtime.mjs';
const model = await loadBrowserInference();
const samples = await recordedSamples();
const selected = {};
for (const sample of samples) {
  if (selected[sample.label]?.verified) continue;
  const p = await model.predictSequence(sample.frames);
  if (!selected[sample.label]) selected[sample.label] = { source: sample.source, ...p };
  if (p.label === sample.label && p.confidence >= model.confidenceThreshold) {
    console.log(JSON.stringify({ source:sample.source, expected:sample.label, ...p }));
    selected[sample.label] = { verified:true, ...p };
  }
  if (['Help','Ticket','Train','No_Gesture'].every(k => selected[k]?.verified)) break;
}
console.log('First usable samples / results:',selected);
model.dispose();
