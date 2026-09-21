# Browser model provenance

`model.json` and `group1-shard1of1.bin` contain the expanded `expanded_transfer_v3` BiLSTM exported from the current training run. It has 39 output classes (A–Z, service words, and No_Gesture). The original transit_v2 GraphModel and its four-class browser repackaging remain archived under `model-training/saved_model/transit_v2`.

Reproduce the packaging from the repository root after `npm ci`:

```powershell
node scripts/export-expanded-model.mjs expanded_transfer_v3
npm test
```

The architecture is BiLSTM(64, sequences) → Dropout(0.3) → BiLSTM(32) → Dropout(0.3) → Dense(32, relu) → Dense(39, softmax). LSTM recurrent gates use sigmoid; input is [batch,30,126]. Python/TF.js probability parity is checked before deployment.

Tests compare deployed inference against an independent scalar LSTM calculation using the archived graph tensors, check tensor disposal and stable/idle emission behavior, and verify normalization. Recorded diagnostic examples come from the existing development dataset; passing them is not an independent accuracy evaluation. The original training metadata and dataset limitations still apply.
