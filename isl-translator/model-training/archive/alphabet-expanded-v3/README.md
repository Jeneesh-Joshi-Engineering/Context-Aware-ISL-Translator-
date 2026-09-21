# Archived alphabet experiment

Archived before the word-only replacement was trained. Nothing was deleted from the original recording folders.

- `browser-model/`: exact previously deployed 39-class model, metadata and documentation. SHA-256 of the weight shard: `2B437F19D5391E6C87E1DC87D4492B1BE44ED4A7891ADF4A713D595D40F79A99`.
- `completed-transfer-run/`: the expanded alphabet-and-word training artifacts from `expanded_transfer_v3`.
- `incomplete-initial-run/`: the first expanded run, interrupted during Keras serialization; its partial `.keras` file must not be used.

Historical saved-model directories are retained for provenance. This archive is outside the frontend and is not served as the active model. The active model is identified by `frontend/model/model_metadata.json`.

The historical 92.857% result belongs to the 39-class experiment only. Its test data was revisited during development and its transfer initializer may have seen old recordings. Do not report it as an independent generalization estimate for the replacement model.
