# Context-Aware ISL Translator

This repo is organized around the working system layers:

- `frontend/`: browser capture and TensorFlow.js inference
- `backend/`: Spring Boot WebSocket + Gemini integration
- `model-training/`: dataset pipeline plus training artifacts
- `data-collection/`: raw landmark exports from the browser capture layer
- `docs/`: notes, KPIs, and design documents
- `prototype/extra/`: archived legacy scripts, prompts, and generated artifacts

The old monolithic BiLSTM training scripts now live in `prototype/extra/legacy-model/`.
The old backend source is still nested under `final yr backend/backend/` until the
Spring Boot project is fully migrated into `backend/`.
