# Active browser model: words_v5

Word-only BiLSTM trained from scratch on 582 usable unique recordings (408 train / 87 validation / 87 test). Input [batch,30,126], output 23 words plus No_Gesture in model_metadata.json order. Confidence gate: 60%.

Test accuracy: 68/87 (78.16%). Chronological development holdout without signer IDs, not signer-independent or live-camera evaluation. Flight, Pay and When had zero recall on their small test subsets. See ../../docs/word-model-results.md for complete metrics.

Python/TF.js parity passed all 87 held-out sequences (max probability difference 2.98e-7). The previous browser model is archived under model-training/archive/words-v4/browser-model. Diagnostic fixtures are selected training recordings, not test-accuracy evidence.

Verify: node scripts/export-expanded-model.mjs words_v5 --check-only
Export: node scripts/export-expanded-model.mjs words_v5
Assets: npm run assets
