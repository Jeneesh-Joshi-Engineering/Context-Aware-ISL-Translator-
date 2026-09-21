# Active browser model: words_v4

This is a word-only BiLSTM trained from scratch using the current raw-data folders. The deployed input is [batch,30,126]; output is 13 classes: Counter, Entrance, Exit, Help, Money, No_Gesture, Police, Receipt, Security, Ticket, Train, When, Where.

The 39-class alphabet experiment and its earlier incomplete run are archived in `model-training/archive/alphabet-expanded-v3`. Its results do not describe the active model.

Architecture: BiLSTM(64, sequences) → Dropout(0.3) → BiLSTM(32) → Dropout(0.3) → Dense(32, ReLU) → Dense(13, softmax). Recurrent activation is sigmoid. Seed 42; 331 usable unique recordings; 233/49/49 chronological split. Test accuracy is 39/49 (79.59%). This is a development holdout without signer IDs, not a blind participant-independent evaluation.

See `docs/word-model-results.md` for per-class weaknesses and `saved_model/words_v4` for data audit, trained binary weights, tensor specifications, split manifest, Python predictions, and training history.

Reproduce export from the repository root:

```powershell
node scripts/export-expanded-model.mjs words_v4 --check-only
node scripts/export-expanded-model.mjs words_v4
npm run assets
node tests/model.test.mjs
```

The exporter verifies Python/TF.js probabilities on all 49 held-out examples (maximum difference 2.384185791015625e-7) and checks one curated training example per label. Training examples validate wiring only; they are not evidence of generalization. The frontend never loads the archived alphabet model.
