# Word-only model: training and evaluation

Reported run: **words_v5**. The previous alphabet model is archived under model-training/archive/alphabet-expanded-v3. The words_v4 browser model is archived under model-training/archive/words-v4/browser-model. The source recordings were preserved.

## Results

- 23 words plus No_Gesture, 24 classes total; no alphabet outputs. Confidence gate remains 60%.
- 582 usable unique sequences: 408 train, 87 validation, 87 test.
- Test top-1 accuracy: 78.16% (68/87).
- Macro F1: 72.76%.
- Weighted F1: 76.06%.
- Early stopping completed 22 epochs and restored epoch 4, selected by validation loss. That epoch's validation accuracy: 88.51%.
- Random initialization, seed 42; no archived alphabet or legacy model weights were used.
- Batch size 32, Adam 0.001, sparse categorical cross-entropy, inverse-frequency class weights, early stopping patience 18 and learning-rate reduction patience 6.
- Training-only augmentation: three noisy/rotated copies per original. Augmented examples are not independent recordings.
- Excluded below minimum 12 usable recordings: Hello: 7; Problem: 10.

| Label | Usable | Train | Test | Precision | Recall | F1 |
|---|---:|---:|---:|---:|---:|---:|
| Bus | 25 | 17 | 4 | 100.0% | 100.0% | 100.0% |
| Cancel | 22 | 16 | 3 | 100.0% | 100.0% | 100.0% |
| Counter | 30 | 22 | 4 | 100.0% | 100.0% | 100.0% |
| Entrance | 23 | 17 | 3 | 100.0% | 100.0% | 100.0% |
| Exit | 30 | 22 | 4 | 100.0% | 100.0% | 100.0% |
| Flight | 15 | 11 | 2 | 0.0% | 0.0% | 0.0% |
| Help | 28 | 20 | 4 | 66.7% | 50.0% | 57.1% |
| Late | 30 | 22 | 4 | 100.0% | 100.0% | 100.0% |
| Lost | 12 | 8 | 2 | 100.0% | 100.0% | 100.0% |
| Luggage | 25 | 17 | 4 | 100.0% | 100.0% | 100.0% |
| Medical_Help | 22 | 16 | 3 | 75.0% | 100.0% | 85.7% |
| Money | 18 | 12 | 3 | 42.9% | 100.0% | 60.0% |
| No_Gesture | 20 | 14 | 3 | 25.0% | 33.3% | 28.6% |
| Pay | 25 | 17 | 4 | 0.0% | 0.0% | 0.0% |
| Police | 24 | 16 | 4 | 100.0% | 75.0% | 85.7% |
| Receipt | 30 | 22 | 4 | 100.0% | 100.0% | 100.0% |
| Seat | 18 | 12 | 3 | 100.0% | 100.0% | 100.0% |
| Security | 17 | 11 | 3 | 33.3% | 33.3% | 33.3% |
| Ticket | 26 | 18 | 4 | 100.0% | 100.0% | 100.0% |
| Time | 32 | 22 | 5 | 71.4% | 100.0% | 83.3% |
| Train | 46 | 32 | 7 | 85.7% | 85.7% | 85.7% |
| What_Time | 25 | 17 | 4 | 100.0% | 50.0% | 66.7% |
| When | 12 | 8 | 2 | 0.0% | 0.0% | 0.0% |
| Where | 27 | 19 | 4 | 50.0% | 75.0% | 60.0% |

## Interpretation

Recognition is not uniformly reliable. Prioritize recollecting classes with low recall in the table above. A 100% score on three or four clips does not prove reliable live recognition. Confidence is a softmax score, not a calibrated guarantee. Do not compare the old 13-class accuracy directly with this expanded vocabulary.

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
