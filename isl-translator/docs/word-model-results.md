# Word-only model: training and evaluation

Active run: **words_v4**. The previous alphabet model is archived under model-training/archive/alphabet-expanded-v3. The source recordings were preserved.

## Results

- 12 words plus No_Gesture, 13 classes total; no alphabet outputs.
- 331 usable unique sequences: 233 train, 49 validation, 49 test.
- Test top-1 accuracy: 79.59% (39/49).
- Macro F1: 74.45%.
- Weighted F1: 79.72%.
- Early stopping completed 25 epochs and restored epoch 7, selected by validation loss. That epoch's validation accuracy: 91.84%.
- Random initialization, seed 42; no archived alphabet or legacy model weights were used.
- Batch size 32, Adam 0.001, sparse categorical cross-entropy, inverse-frequency class weights, early stopping patience 18 and learning-rate reduction patience 6.
- Training-only augmentation: three noisy/rotated copies per original. Augmented examples are not independent recordings.
- Hello excluded: seven usable recordings, below the minimum of 12.

| Label | Usable | Train | Test | Precision | Recall | F1 |
|---|---:|---:|---:|---:|---:|---:|
| Counter | 30 | 22 | 4 | 100.0% | 100.0% | 100.0% |
| Entrance | 23 | 17 | 3 | 100.0% | 100.0% | 100.0% |
| Exit | 30 | 22 | 4 | 100.0% | 100.0% | 100.0% |
| Help | 28 | 20 | 4 | 66.7% | 50.0% | 57.1% |
| Money | 18 | 12 | 3 | 100.0% | 100.0% | 100.0% |
| No_Gesture | 20 | 14 | 3 | 20.0% | 33.3% | 25.0% |
| Police | 24 | 16 | 4 | 100.0% | 75.0% | 85.7% |
| Receipt | 30 | 22 | 4 | 100.0% | 100.0% | 100.0% |
| Security | 17 | 11 | 3 | 50.0% | 33.3% | 40.0% |
| Ticket | 26 | 18 | 4 | 100.0% | 100.0% | 100.0% |
| Train | 46 | 32 | 7 | 100.0% | 100.0% | 100.0% |
| When | 12 | 8 | 2 | 0.0% | 0.0% | 0.0% |
| Where | 27 | 19 | 4 | 50.0% | 75.0% | 60.0% |

## Interpretation

The new model works through the browser/backend integration, but recognition is not uniformly reliable. Help, Security, When and No_Gesture need recollection first. A 100% score on three or four clips does not prove reliable live recognition. Confidence is a softmax score, not a calibrated guarantee.

Splits are chronological within each label after normalized-content deduplication. No signer/session IDs exist. These recordings were inspected in earlier development, so this is a development holdout, not a new blind evaluation. No test records or pretrained weights were used in this run's optimization. A new participant-held-out dataset is required before claiming generalization. The old 92.857% result used 39 classes and a different test composition; it is not directly comparable.

Preprocessing rejects fewer than 15 tracked frames, trims blank leading/trailing frames, interpolates observed coordinates to 30 frames, and normalizes each hand around its wrist and middle MCP. It cannot reconstruct missed motion. The 126-feature representation omits body/face and absolute wrist movement.

The diagnostic fixture uses one curated **training** example per class. It verifies software wiring and is not the test-accuracy dataset. Cross-runtime parity and the split manifest are stored with this run. Live camera, microphone and unseen-signing accuracy require a separate human check.

## Reproduce

From the repository root, use Python 3.12 with model-training/requirements-expanded.txt in an isolated environment. Existing runs are never overwritten:

```powershell
.\.cache\train-env\Scripts\python.exe scripts/train-expanded-model.py --run words_v5
node scripts/export-expanded-model.mjs words_v5 --check-only
# Inspect per-class training-report.json before deployment.
node scripts/export-expanded-model.mjs words_v5
npm run assets
```

The training tool excludes single-letter labels by default even if alphabet folders are added again. Recordings belong in model-training/dataset/raw/<canonical-word>/*.json; the label inside each sequence is authoritative.
