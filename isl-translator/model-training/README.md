# Dataset Creation Pipeline

This folder contains the Python-only dataset preparation pipeline for ISL landmark exports.

## Raw Input

Team members should drop one JSON export per recording session into `dataset/raw/`.

Recommended naming:

- `shreya_session1.json`
- `jeneesh_session1.json`
- `shreya_session2.json`

Each file must contain an array of sequence objects exported by the acquisition layer.

## Run The Pipeline

Example:

```bash
python scripts/build_dataset.py \
  --raw-dir dataset/raw \
  --labels-config labels.json \
  --min-per-label 20 \
  --augment --augment-copies 3 --augment-types jitter,timewarp,mirror \
  --split-ratio 70,15,15 \
  --output-version v1
```

## Outputs

Each run creates a new versioned folder under `dataset/processed/`, such as `v1/`, `v2/`, and so on.

Files in a processed version folder:

- `X_train.npy`, `X_val.npy`, `X_test.npy`: landmark tensors shaped `(num_sequences, 30, 126)`
- `y_train.npy`, `y_val.npy`, `y_test.npy`: integer-encoded labels
- `label_encoder.json`: the single source of truth for label index mapping
- `dataset_manifest.json`: reproducibility metadata for the run
- `dataset_report.md`: human-readable summary for documentation
- `label_distribution.png`: class balance chart
- `rejected_sequences.json`: quarantined invalid records with reasons

## Notes

- No raw video or image data is expected here.
- Augmentation can be disabled entirely with CLI flags.
- The pipeline never overwrites an existing processed version folder.
