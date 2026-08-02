# Codex Prompt — Dataset Creation Pipeline (ISL Translation System)

Copy everything below the line into Codex as a single prompt.

---

## Project Context

I already have a browser-based **Data Acquisition Layer** (MediaPipe hand-landmark capture tool) that team members use independently to record labeled ISL sign sequences. Each recording session produces a JSON export file with this schema:

```json
{
  "label": "Help",
  "timestamp": "2026-08-01T10:15:00Z",
  "handedness": ["Right"],
  "frames": [ [126 numbers], [126 numbers], ... ]   // exactly 30 arrays of 126 numbers per sequence
}
```

A single export file contains an **array** of many such sequence objects (all recorded in one session, potentially mixed labels).

Your job now is to build the **Dataset Creation Pipeline**: a Python tool that takes multiple raw export files from multiple team members and turns them into one clean, validated, balanced, versioned dataset ready to feed into BiLSTM model training. **Do not build the model or training loop — that is a separate, later phase.** This prompt covers dataset preparation only.

## Tech Stack (use exactly this)

- Python 3.10+
- `numpy`, `pandas` for data handling
- `scikit-learn` for stratified splitting
- `matplotlib` for the dataset report charts
- `argparse` for CLI
- Standard library `json`, `hashlib`, `logging`, `pathlib`
- No deep learning libraries needed at all in this phase (no TensorFlow/Keras/PyTorch) — keep this pipeline framework-agnostic since the training phase is separate.

## Folder Structure to Create

```
model-training/
├── dataset/
│   ├── raw/                     # team members drop their raw JSON exports here, one file per session
│   │   └── (e.g., shreya_session1.json, jeneesh_session1.json, ...)
│   └── processed/
│       ├── v1/
│       │   ├── X_train.npy
│       │   ├── y_train.npy
│       │   ├── X_val.npy
│       │   ├── y_val.npy
│       │   ├── X_test.npy
│       │   ├── y_test.npy
│       │   ├── label_encoder.json
│       │   ├── dataset_manifest.json
│       │   └── dataset_report.md
├── scripts/
│   ├── schema_validator.py
│   ├── merge_sessions.py
│   ├── deduplicate.py
│   ├── augment.py
│   ├── balance_report.py
│   ├── split_dataset.py
│   └── build_dataset.py         # main CLI entry point, orchestrates all steps above
└── tests/
    ├── test_schema_validator.py
    ├── test_deduplicate.py
    └── test_augment.py
```

## Functional Requirements

### 1. Schema Validation (`schema_validator.py`)
- For every sequence object loaded from any raw file, validate:
  - `label` is a non-empty string and belongs to an **allowed label list** passed in via a config file (`labels.json`, e.g. `["Hello", "Help", "Emergency", "No_Gesture"]`) — reject and log (don't silently skip) any sequence with a label outside this list, since a typo like "Hlep" should be caught, not treated as a real class.
  - `frames` is a list of **exactly 30** elements (the fixed sequence length from the Data Acquisition Layer).
  - Each frame is a list of **exactly 126** numeric values (no `null`, no strings, no `NaN`).
  - `handedness` is present and is a list of strings from `{"Left", "Right"}`.
  - `timestamp` parses as valid ISO 8601.
- Invalid sequences must be **quarantined**, not silently dropped: write them to `dataset/processed/vN/rejected_sequences.json` along with a human-readable reason string for each rejection, and print a summary count of rejections by reason at the end of the run.

### 2. Merging Multiple Sessions (`merge_sessions.py`)
- Scan every `.json` file in `dataset/raw/`, load and validate each (using the validator above), and merge all valid sequences into a single in-memory list.
- Tag every sequence with its **source filename** (e.g., `"source_file": "shreya_session1.json"`) so provenance is traceable — this matters later for debugging model errors back to a specific recording session or person.
- Produce a merge summary: total files processed, total sequences found, total valid vs. rejected.

### 3. Deduplication (`deduplicate.py`)
- Detect and remove **near-duplicate sequences** — these happen when a team member accidentally double-records the same gesture or the "Start Recording" key is pressed twice in a row.
- Implement this by computing a similarity measure between sequences of the same label (e.g., mean absolute difference between corresponding frames, or a hash of a rounded/quantized version of the landmark values) and flagging pairs above a configurable similarity threshold as duplicates.
- Keep only one instance of each near-duplicate group; log which sequences were removed and why (include source file + timestamp of both the kept and removed copy in the log for traceability).
- This must be a pure, testable function — don't couple it to file I/O.

### 4. Class Balance Reporting (`balance_report.py`)
- After merge + dedup, compute and report:
  - Count of sequences per label.
  - Count of sequences per label **per contributing team member** (inferred from source filename, e.g. `shreya_session1.json` → "shreya") — this reveals if one person's data is dominating a class, which hurts generalization.
  - A bar chart (saved as PNG into the versioned processed folder) showing sequence count per label.
- **Enforce a minimum viable dataset check**: fail loudly (raise an error with a clear message, don't just warn) if any label has fewer than a configurable minimum count (default: 20 sequences), and explicitly confirm the `"No_Gesture"` negative class is present and meets the same minimum — the pipeline must not silently proceed to train/val/test splitting with an unusable class.

### 5. Data Augmentation (`augment.py`)
Implement these augmentation functions, each operating on a single sequence (`frames`: 30×126 array) and returning a new augmented sequence — all must preserve the (30, 126) shape:
- **Gaussian jitter**: add small random noise (configurable std dev, default small enough not to distort the gesture) to every coordinate.
- **Time-warping**: slightly stretch or compress the sequence in time (e.g., resample 30 frames from a virtually stretched/compressed version of the original) to simulate signing the gesture slightly faster/slower.
- **Horizontal mirroring**: flip the x-coordinates (and swap left/right hand landmark blocks + update the `handedness` field accordingly) to simulate a left-handed signer from right-handed data, or vice versa — this is a legitimate and valuable augmentation for this dataset given hand symmetry in ISL.
- Make augmentation **optional and configurable via CLI flags** (how many augmented copies to generate per original sequence, which augmentations to apply) — the pipeline must also support running with augmentation fully disabled, since you'll want to compare model performance with vs. without augmentation as part of your evaluation later.
- Track augmented sequences with a `"synthetic": true` metadata flag distinct from real recordings, and make sure augmented copies are **never split across train and validation/test sets** relative to their original source sequence (i.e., an original and all its augmented variants must stay together in the same split) — otherwise you leak information between splits and get an artificially inflated validation score.

### 6. Train/Validation/Test Split (`split_dataset.py`)
- Split at the **original-sequence level** (before augmentation is applied, or grouped by original-sequence ID after augmentation per the leakage rule above), stratified by label, using a configurable ratio (default 70/15/15).
- Also stratify awareness by **contributing team member** where feasible, so the validation/test sets aren't dominated by a single person's signing style — log a warning (not a hard failure) if this isn't achievable given the data distribution.
- Convert the final splits into numpy arrays:
  - `X_train`, `X_val`, `X_test`: shape `(num_sequences, 30, 126)`, dtype `float32`.
  - `y_train`, `y_val`, `y_test`: shape `(num_sequences,)`, integer-encoded labels.
- Save a `label_encoder.json` mapping integer indices to label strings (and back), so the training phase and inference phase both reference the exact same mapping — this file must be the single source of truth and both phases should load it rather than hardcoding indices.

### 7. Dataset Manifest & Report (`build_dataset.py` orchestration output)
- Write `dataset_manifest.json` recording: dataset version, creation timestamp, list of all raw source files included, total sequence counts (pre/post dedup, pre/post augmentation), per-label counts, per-person counts, augmentation settings used, and the split ratios used. This is your reproducibility record — anyone should be able to look at this file and know exactly how this dataset version was built.
- Write `dataset_report.md`: a human-readable Markdown summary (tables + embedded chart image reference) suitable for pasting straight into your project documentation/evaluation section.
- Version the output folder automatically (`v1`, `v2`, ...) — never overwrite a previous processed dataset version; each pipeline run that changes the raw data or config should produce a new version folder, and the manifest should note which version supersedes which.

### 8. CLI Entry Point (`build_dataset.py`)
Provide a single command that runs the full pipeline end-to-end with sensible flags, e.g.:
```bash
python scripts/build_dataset.py \
  --raw-dir dataset/raw \
  --labels-config labels.json \
  --min-per-label 20 \
  --augment --augment-copies 3 --augment-types jitter,timewarp,mirror \
  --split-ratio 70,15,15 \
  --output-version v1
```
Print a clear step-by-step progress log to the console as it runs (validate → merge → dedup → balance-check → augment → split → save → report), and exit with a non-zero code and clear error message if any hard-failure condition above is hit (invalid schema beyond a tolerable threshold, class below minimum count, etc.) rather than producing a silently broken dataset.

### 9. Tests
Write unit tests (using `pytest`) for:
- Schema validator correctly accepting valid sequences and rejecting each category of malformed input (wrong frame count, wrong vector length, invalid label, non-numeric values).
- Deduplication correctly identifying a synthetic near-duplicate pair while not flagging two genuinely different sequences of the same label.
- Each augmentation function preserving output shape `(30, 126)` and not producing `NaN`/`inf` values.

## Non-Functional Requirements

- Every step must be **idempotent and re-runnable**: running `build_dataset.py` again with the same inputs and config should either produce an identical new version or clearly no-op — no partial/corrupted state left behind on failure.
- No raw video/image data is ever expected as input to this pipeline (only landmark JSON) — add a validation check that immediately rejects any file that doesn't match the expected landmark-only schema, as a safety net enforcing the project's privacy constraint from the layer before this one.
- Code must be modular per the file structure above — `build_dataset.py` should only orchestrate, with all real logic living in the importable, independently-testable modules.
- Add a top-level `README.md` in `model-training/` explaining: how team members should name/drop their raw export files, how to run the pipeline, what each output file in a versioned processed folder means, and how to interpret `dataset_report.md`.

## Deliverable

All files listed above, fully working end-to-end: given a `dataset/raw/` folder containing several team members' raw JSON exports and a `labels.json` config, running `build_dataset.py` with the example command above should produce a new versioned `dataset/processed/vN/` folder containing ready-to-train numpy arrays, a label encoder, a full manifest, and a readable Markdown report — with all validation, deduplication, balance-checking, and leakage-safe augmentation/splitting rules enforced as specified.

Do not implement model training, TensorFlow.js conversion, or any downstream layer — this prompt covers Dataset Creation only.
