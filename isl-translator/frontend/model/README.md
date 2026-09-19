# Browser model provenance

`model.json` and `group1-shard1of1.bin` contain the original transit_v2 trained weights repackaged as a TensorFlow.js Layers model. The original GraphModel export is archived under `model-training/saved_model/transit_v2/tfjs_model`. Its dynamic control-flow graph could not execute correctly in the browser runtime.

Reproduce the packaging from the repository root after `npm ci`:

```powershell
node scripts/convert-browser-model.mjs
npm test
```

No retraining or synthetic replacement weights are involved. The architecture is BiLSTM(64, sequences) → Dropout(0.3) → BiLSTM(32) → Dropout(0.3) → Dense(32, relu) → Dense(4, softmax). LSTM recurrent gates use sigmoid; using TensorFlow.js's default hard-sigmoid would change predictions. Input is [batch,30,126]; class order is Help, No_Gesture, Ticket, Train.

Tests compare deployed inference against an independent scalar LSTM calculation using the archived graph tensors, check tensor disposal and stable/idle emission behavior, and verify normalization. Recorded diagnostic examples come from the existing development dataset; passing them is not an independent accuracy evaluation. The original training metadata and dataset limitations still apply.
