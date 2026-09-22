# Dataset Creation Pipeline

> Historical preparation pipeline below. The active words_v5 model uses the repository-root `scripts/train-expanded-model.py` and `scripts/export-expanded-model.mjs`, discovers word labels from exports, and does not use the legacy three-label restriction below. See `../docs/word-model-results.md` and `../docs/prototype-deployment.md` for current data, evaluation and collection priorities. Do not rerun into an existing saved run; choose a new version.

This folder contains the Python-only dataset preparation pipeline for ISL landmark exports.

## Raw Input

Team members should drop one JSON export per recording session anywhere under `dataset/raw/`.
Nested folders such as `HELP SIGN/session1.json` are discovered recursively.
Folder names are for organisation only: every sequence's JSON `label` must still
exactly match an entry in `labels.json`.

Recommended naming:

- `shreya_session1.json`
- `jeneesh_session1.json`
- `shreya_session2.json`

Each file may be the JSON export object produced by the acquisition layer (with a
`sequences` array) or a direct array of sequence objects.

## Transit-Hub MVP Vocabulary

The first model is intentionally limited to: `Help`, `Train_Ticket`, and
`No_Gesture`. Keep labels exactly as written in `labels.json`; do not mix historical
or future labels into this active dataset.

## Run The Pipeline

Example:

```bash
python scripts/build_dataset.py \
  --raw-dir dataset/raw \
  --labels-config labels.json \
  --min-per-label 50 \
  --augment --augment-copies 2 --augment-types jitter,timewarp \
  --split-ratio 70,15,15 \
  --output-version v1
```

Train the resulting version with:

```bash
python scripts/train_bilstm.py \
  --data-dir dataset/processed/v1 \
  --output-dir saved_model/transit_v1
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
- Training also refuses to overwrite an existing `model.h5`; the earlier
  one-class artifact under `data-collection/dataset/processed/v1` / `saved_model/v1`
  is historical and must not be deployed.
- `load_and_merge.py`, `preprocess_and_split.py`, and `run_all.py` are legacy;
  do not use them for new recordings because they bypass the active validation path.
- For one recording of each active label, run `build_dataset.py` with
  `--validation-only --output-version pipeline-check`. It writes a structural
  report and does not create a misleading train/validation/test split.
