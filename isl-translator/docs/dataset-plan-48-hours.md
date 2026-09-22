# Dataset collection plan for words_v5

Current run: 23 words plus idle; 582 usable unique clips; 408 train / 87 validation / 87 test. Accuracy: 68/87 (78.16%). No signer-independent evaluation. See [full per-class results](word-model-results.md).

## Next 48 hours of dataset work

Strengthen existing labels before adding many more. Record 20–30 additional independent clips per priority word, across several people and two sessions, varying lighting and distance. Record signer/session IDs separately to hold out an untouched participant.

1. Flight, Pay, When: zero recall on small test subsets (2, 4, 2 clips). Check labels and sign distinctiveness first.
2. No_Gesture, Security, Help, What_Time: collect neutral transitions and confusing signs; validate Time / What_Time / When with a competent signer.
3. Problem has only 10 usable clips and Hello only 7; both were excluded below the minimum 12. Aim for 25–30 usable clips each, not merely two/five more.
4. Lost has 12 usable clips and Flight 15. Large cumulative exports do not equal independent clips; duplicates are removed.
5. After that, useful transit additions are Platform, Gate, Toilet, Water, Yes, No, Thank_You. Confirm signs and labels first, and include only words for which 25–30 independent clips can be collected.

Suggested allocation: 4 hours review labels/tracking; 24 hours collect priority classes; 8 hours capture separate participants; 12 hours audit, train, evaluate and rehearse. This is a proposed schedule, not completed work. Keep at least 15 tracked frames per clip and all relevant hands visible. Duplicates and augmentation are not new recordings.
