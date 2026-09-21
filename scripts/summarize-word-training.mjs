import { readFile, writeFile } from 'node:fs/promises';
const root=new URL('../isl-translator/model-training/saved_model/words_v4/',import.meta.url);
const report=JSON.parse(await readFile(new URL('training-report.json',root),'utf8'));
const audit=JSON.parse(await readFile(new URL('data-audit.json',root),'utf8'));
const rows=report.classes.map(label=>{
  const s=report.classification_report[label];
  return `| ${label} | ${report.unique_counts[label]} | ${report.split_counts.train[label]} | ${s.support} | ${(s.precision*100).toFixed(1)}% | ${(s.recall*100).toFixed(1)}% | ${(s['f1-score']*100).toFixed(1)}% |`;
});
const best=report.history.val_loss.indexOf(Math.min(...report.history.val_loss));
const text=`# Word-only model: training and evaluation

Active run: **words_v4**. The previous alphabet model is archived under model-training/archive/alphabet-expanded-v3. The source recordings were preserved.

## Results

- 12 words plus No_Gesture, 13 classes total; no alphabet outputs.
- ${Object.values(audit.splits).reduce((a,b)=>a+b,0)} usable unique sequences: ${audit.splits.train} train, ${audit.splits.validation} validation, ${audit.splits.test} test.
- Test top-1 accuracy: ${(report.test_accuracy*100).toFixed(2)}% (39/49).
- Macro F1: ${(report.classification_report['macro avg']['f1-score']*100).toFixed(2)}%.
- Weighted F1: ${(report.classification_report['weighted avg']['f1-score']*100).toFixed(2)}%.
- Early stopping completed ${report.history.loss.length} epochs and restored epoch ${best+1}, selected by validation loss. That epoch's validation accuracy: ${(report.history.val_accuracy[best]*100).toFixed(2)}%.
- Random initialization, seed 42; no archived alphabet or legacy model weights were used.
- Batch size 32, Adam 0.001, sparse categorical cross-entropy, inverse-frequency class weights, early stopping patience 18 and learning-rate reduction patience 6.
- Training-only augmentation: three noisy/rotated copies per original. Augmented examples are not independent recordings.
- Hello excluded: seven usable recordings, below the minimum of 12.

| Label | Usable | Train | Test | Precision | Recall | F1 |
|---|---:|---:|---:|---:|---:|---:|
${rows.join('\n')}

## Interpretation

The new model works through the browser/backend integration, but recognition is not uniformly reliable. Help, Security, When and No_Gesture need recollection first. A 100% score on three or four clips does not prove reliable live recognition. Confidence is a softmax score, not a calibrated guarantee.

Splits are chronological within each label after normalized-content deduplication. No signer/session IDs exist. These recordings were inspected in earlier development, so this is a development holdout, not a new blind evaluation. No test records or pretrained weights were used in this run's optimization. A new participant-held-out dataset is required before claiming generalization. The old 92.857% result used 39 classes and a different test composition; it is not directly comparable.

Preprocessing rejects fewer than 15 tracked frames, trims blank leading/trailing frames, interpolates observed coordinates to 30 frames, and normalizes each hand around its wrist and middle MCP. It cannot reconstruct missed motion. The 126-feature representation omits body/face and absolute wrist movement.

The diagnostic fixture uses one curated **training** example per class. It verifies software wiring and is not the test-accuracy dataset. Cross-runtime parity and the split manifest are stored with this run. Live camera, microphone and unseen-signing accuracy require a separate human check.

## Reproduce

From the repository root, use Python 3.12 with model-training/requirements-expanded.txt in an isolated environment. Existing runs are never overwritten:

\`\`\`powershell
.\\.cache\\train-env\\Scripts\\python.exe scripts/train-expanded-model.py --run words_v5
node scripts/export-expanded-model.mjs words_v5 --check-only
# Inspect per-class training-report.json before deployment.
node scripts/export-expanded-model.mjs words_v5
npm run assets
\`\`\`

The training tool excludes single-letter labels by default even if alphabet folders are added again. Recordings belong in model-training/dataset/raw/<canonical-word>/*.json; the label inside each sequence is authoritative.
`;
await writeFile(new URL('../isl-translator/docs/word-model-results.md',import.meta.url),text);
console.log('Wrote word-model-results.md');
