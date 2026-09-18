# Codex Prompt — Complete Remaining Work (Phases 3–8)

Copy everything below the line into Codex as a single prompt.

**Read this note before sending it:** This prompt covers a lot of ground on purpose, because it's meant to walk Codex through the entire remaining pipeline in the correct dependency order, using the codebase that already exists. But in practice, don't run this as one giant blind session — feed it to Codex, then work through the phases **section by section, in order**, checking each phase's output before moving to the next (especially Phase 3, since Phase 4 physically cannot produce a real, non-garbage model until Phase 3 has actually been run against real recorded data — see the callout at the very top of the prompt). Treat this file as your full backlog, not a one-shot magic command.

---

## Project Context (give Codex this exact framing)

I am continuing work on an existing ISL (Indian Sign Language) real-time translation system. The following is **already built and working, do not rebuild or restructure it**:

```
frontend/
├── index.html
├── style.css
└── js/
    ├── camera.js          # webcam + privacy-safe capture
    ├── landmarker.js       # MediaPipe hand landmark detection
    ├── normalize.js        # landmark preprocessing
    ├── recorder.js         # sequence recording state machine
    ├── exporter.js         # JSON/CSV dataset export
    └── main.js              # app entry point, wires layers together

model-training/
├── scripts/
│   ├── schema_validator.py
│   ├── merge_sessions.py
│   ├── deduplicate.py
│   ├── augment.py
│   ├── balance_report.py
│   ├── split_dataset.py
│   └── build_dataset.py     # orchestrates the above, outputs versioned datasets
├── labels.json               # label list, currently needs to be populated with final sign list
└── dataset/
    ├── raw/                   # team's recorded session exports land here
    └── processed/vN/          # build_dataset.py output: X_train.npy, y_train.npy, etc.

backend/
├── pom.xml
├── src/main/java/com/isl/backend/
│   ├── IslBackendApplication.java
│   ├── config/WebSocketConfig.java
│   ├── websocket/SessionManager.java
│   ├── websocket/ConversationWebSocketHandler.java
│   └── model/ (IncomingMessage.java, OutgoingMessage.java, MessageType.java)
└── test-client/test-client.html
```

The established WebSocket message contract (already implemented, reuse it — do not invent a new one):
```json
// frontend -> backend
{"type":"KEYWORD_DETECTED","sessionId":"abc123","role":"deaf_user","keyword":"Help","confidence":0.91,"timestamp":"..."}
// backend -> frontend
{"type":"SENTENCE_GENERATED","sessionId":"abc123","originalKeywords":["Help"],"generatedSentence":"...","generationTimeMs":812,"timestamp":"..."}
// official -> backend -> deaf user
{"type":"OFFICIAL_RESPONSE","sessionId":"abc123","role":"official","transcribedText":"...","timestamp":"..."}
// errors
{"type":"ERROR","sessionId":"abc123","errorMessage":"...","timestamp":"..."}
```

**What is explicitly NOT part of this prompt:** actually recording the training dataset (physically signing gestures on camera) is a human task, not a coding task — do not attempt to generate synthetic landmark data to substitute for real recordings. Assume real recorded sequences will be placed in `model-training/dataset/raw/` by the team separately, following the existing `{name}_session{N}.json` naming convention.

---

## SECTION 1 — Phase 3: BiLSTM Training Pipeline

**Goal:** Build the actual training script that consumes the already-existing preprocessing pipeline's output and produces a trained model.

### Requirements
1. Create `model-training/scripts/train_model.py`:
   - Load `X_train.npy, y_train.npy, X_val.npy, y_val.npy, X_test.npy, y_test.npy` from a specified `model-training/dataset/processed/vN/` folder (pass version as a CLI arg, don't hardcode).
   - Load `label_encoder.json` from the same folder to know class count and names.
   - Build a Keras Sequential model exactly matching the roadmap's architecture:
     ```python
     Bidirectional(LSTM(64, return_sequences=True), input_shape=(30, num_features))
     Dropout(0.3)
     Bidirectional(LSTM(32))
     Dropout(0.3)
     Dense(32, activation='relu')
     Dense(num_classes, activation='softmax')
     ```
   - Compile with Adam optimizer, categorical cross-entropy loss, accuracy metric. One-hot encode labels before training.
   - Add **EarlyStopping** (monitor `val_loss`, patience=10, restore best weights) and **ModelCheckpoint** (save best model during training).
   - Train with a configurable number of epochs (default 100 — early stopping will cut it short) and batch size (default 16, since the dataset is small).
   - Print training/validation accuracy and loss per epoch, and produce a training-history plot (accuracy + loss curves) saved as a PNG.
2. Save the final trained model to **both** `model-training/saved_model/model.h5` **and** as a TensorFlow SavedModel directory at `model-training/saved_model/model_savedmodel/` (needed later for the TF.js conversion step).
3. Create `model-training/scripts/evaluate.py`:
   - Load the trained model and the held-out `X_test.npy`/`y_test.npy`.
   - Compute and print overall test accuracy.
   - Generate a **confusion matrix** (as a PNG heatmap using matplotlib/seaborn) showing per-class performance — this is direct evidence for the project's "Recognition Accuracy" KPI.
   - Compute per-class precision/recall/F1 and save as a table in `model-training/saved_model/evaluation_report.md`.
   - **Confidence threshold analysis:** for the test set, compute what fraction of predictions would fall below the 70% confidence threshold (i.e., would trigger the fallback state machine) — report this explicitly, since it's a direct measurement tied to the project's H4 hypothesis.
4. Both scripts must run via simple CLI commands, e.g.:
   ```bash
   python scripts/train_model.py --dataset-version v1
   python scripts/evaluate.py --dataset-version v1 --model-path saved_model/model.h5
   ```
5. Handle the case where the dataset is small (this is a capstone prototype, not a big-data project) — don't assume large batch sizes or that GPU is available; the script must run correctly on CPU-only.

---

## SECTION 2 — Phase 4: TensorFlow.js Conversion & In-Browser Inference

**Goal:** Get the trained model running live in the existing frontend.

### Requirements
1. Create `model-training/scripts/convert_to_tfjs.sh` (or `.py` using the `tensorflowjs` Python package) that runs:
   ```bash
   tensorflowjs_converter --input_format=keras \
       saved_model/model.h5 \
       ../frontend/model/
   ```
   producing `model.json` + weight shard files directly into the existing `frontend/model/` folder.
2. Create `frontend/js/inference.js` (new file, don't touch `landmarker.js`/`recorder.js` logic):
   - Load the converted model on app startup: `await tf.loadLayersModel('model/model.json')`.
   - Maintain a **rolling buffer of the last 30 normalized landmark frames** (reuse the normalization logic already in `normalize.js` — do not reimplement it).
   - Every few frames (configurable, default every 3 frames), run `model.predict()` on the current 30-frame buffer.
   - Apply the **70% confidence threshold**: only treat a prediction as valid if `max(softmax_output) >= 0.70`; otherwise mark it as "low confidence" and do not emit a keyword (this feeds directly into the Phase 7 fallback logic — expose a clear function/callback here that Phase 7's code can hook into, e.g. `onLowConfidence(callback)`).
   - Map the predicted class index back to a label string using the same `label_encoder.json` mapping used in training (copy this file, or the relevant mapping, into `frontend/model/` so frontend and backend/training all reference the identical mapping — do not hardcode label strings separately in JS).
   - Display the currently predicted word live on screen.
3. **Latency instrumentation:** timestamp at "frame captured" and timestamp at "prediction displayed," compute the delta, and show a rolling average latency number on screen. Target is ≤50ms — if actual measured latency is consistently higher, log a clear console warning (don't silently ignore it; this is a project KPI, H2).
4. Wire `inference.js` into `main.js` as a new step in the existing pipeline, without breaking the existing recording-mode functionality (recording mode and live-inference mode should be clearly separate UI states, not fighting over the same landmark buffer).

---

## SECTION 3 — Phase 5 Completion: Frontend WebSocket Client + Gemini Backend Integration

**Goal:** Finish wiring the two ends of the existing backend so the whole loop (predicted keyword → sentence) actually works.

### Part A — Backend: Gemini API service (add to existing Spring Boot app)
1. Add `com.google.genai:google-genai` (or the current official Google Gen AI Java SDK — verify the correct current artifact name/version before adding it) as a Maven dependency, or alternatively use Spring's `WebClient` to call the Gemini REST endpoint directly if the SDK integration proves awkward — pick whichever is cleaner, but keep the implementation isolated behind a single interface (`SentenceGenerator` or similar) so the calling code doesn't care which approach was used.
2. Create `backend/src/main/java/com/isl/backend/gemini/GeminiService.java`:
   - Method: `generateContextualSentence(List<String> keywords) -> String` (or the async equivalent, e.g. returning a `Mono<String>` if using WebFlux-style, consistent with whatever pattern the existing `ConversationWebSocketHandler` uses).
   - System prompt (use exactly this intent): *"You are converting isolated Indian Sign Language keywords into a single, natural, polite, grammatically correct sentence appropriate for a banking or public-transit customer service context. Keywords, in the order signed: {keywords}. Respond with ONLY the sentence — no explanation, no quotation marks, no preamble."*
   - Read `GEMINI_API_KEY` from environment/`application.properties` (fail fast at startup with a clear message if missing — do not fail silently on first request).
   - Timeout (default 5s) + 1 retry on transient failure, no retry on 4xx.
3. Wire `GeminiService` into the **existing** `ConversationWebSocketHandler`'s handling of `KEYWORD_DETECTED` messages: on receipt, call Gemini, time the call, and broadcast a `SENTENCE_GENERATED` message (matching the contract above exactly) to all clients in that session. On failure, send an `ERROR` message instead of dropping the connection.
4. Log `generationTimeMs` for every successful call via the existing `KpiLogger` (extend it if it doesn't already log this field).

### Part B — Frontend: WebSocket client integration
1. Create `frontend/js/wsClient.js`:
   - Connects to the backend's `/ws/conversation` endpoint with a `sessionId` and `role` (deaf_user or official) — generate/read `sessionId` from a URL query parameter so two browser tabs/windows can join the same session for testing.
   - Exposes `sendKeyword(keyword, confidence)` which sends a properly formatted `KEYWORD_DETECTED` message.
   - Exposes an event/callback system for incoming `SENTENCE_GENERATED`, `OFFICIAL_RESPONSE`, and `ERROR` messages so other modules can react without this file knowing about the UI.
   - Handles reconnection gracefully if the WebSocket drops (retry with backoff, surface connection status to the UI rather than failing silently).
2. Wire `inference.js` (from Section 2) to `wsClient.js`: whenever a high-confidence keyword is predicted, call `sendKeyword()`.
3. Display the incoming `generatedSentence` prominently on screen when a `SENTENCE_GENERATED` message arrives.
4. Add end-to-end latency instrumentation here too: timestamp at "keyword sent" to timestamp at "sentence displayed," and log it (this is the project's Context Generation Time KPI, target reasonable, e.g. under a few seconds).

---

## SECTION 4 — Phase 6: Bidirectional Feedback (Speech-to-Text)

### Requirements
1. Create `frontend/js/speechToText.js`:
   - Use the browser's native `SpeechRecognition` (Web Speech API), configured for continuous listening on the **official's** screen only.
   - Expose `startListening()` / `stopListening()`, and handle `onresult` (transcription available), `onerror`, and `onend` events explicitly — don't let the recognizer silently stop without restarting if it's supposed to still be listening.
   - On a finalized transcription result, send it via the existing `wsClient.js` as an `OFFICIAL_RESPONSE` message (matching the existing contract — reuse `wsClient.js`, do not create a second WebSocket connection).
2. On the **deaf user's** screen, listen for incoming `OFFICIAL_RESPONSE` messages (via `wsClient.js`'s callback system) and display the transcribed text clearly.
3. Add latency logging: time from "official finished speaking" (recognition `onresult` with `isFinal: true`) to "text displayed on deaf user's screen."
4. Handle the realistic failure case where the browser doesn't support `SpeechRecognition` at all (e.g., Firefox) — detect this and show a clear fallback message/UI rather than crashing.

---

## SECTION 5 — Phase 7: Integration, Fallback State Machine, Stress Testing, KPI Logging

### Requirements
1. Create `frontend/js/fallback.js`:
   - A small state machine with states `TRACKING` and `FALLBACK_SPELLING`.
   - Hook into `inference.js`'s low-confidence callback (from Section 2): if confidence stays below 70% for **3 consecutive prediction cycles** (configurable constant), transition to `FALLBACK_SPELLING`.
   - In `FALLBACK_SPELLING` state, show a simple on-screen finger-spelling/manual character entry UI (a basic letter picker or text input is sufficient — this doesn't need its own gesture-to-letter ML model, just a manual way for the user to spell the word).
   - Once the user submits a spelled word (or confidence recovers on its own), transition back to `TRACKING` and send the resulting keyword through the normal `wsClient.js` flow like any other recognized keyword.
   - Log every fallback trigger (timestamp, reason, duration spent in fallback) via the KPI logger below.
2. Create `frontend/js/kpiLogger.js`:
   - A single shared module (not duplicated logic scattered across files) that other modules call into to log timestamped events: `capture`, `prediction`, `ws_send`, `sentence_received`, `speech_transcribed`, `fallback_triggered`, `fallback_resolved`.
   - Store events in-memory as a JSON array, persist to `localStorage` so a session isn't lost on refresh, and provide an "Export KPI Log as CSV" button/function for pulling the data out for analysis later.
3. Create `frontend/test-scenarios.html`: a simple checklist page (not automated tests, just a structured manual QA page) listing stress-test scenarios to run through and check off:
   - Kill the WebSocket connection mid-conversation (e.g., stop the backend) — confirm the frontend shows a clear "disconnected" state and doesn't crash.
   - Simulate poor lighting / cover part of the hand — confirm confidence drops and fallback triggers correctly rather than the system hallucinating a wrong word.
   - Sign a gesture not in the training set — confirm graceful "not recognized" handling, not a false-positive high-confidence misfire.
   - Disconnect the "official" client — confirm the "deaf user" client shows a clear "waiting for official" state.
4. Set up the **two-client demo**: confirm `index.html` supports being opened twice with different `?role=` and `?sessionId=` query parameters (one as `deaf_user`, one as `official`) so the full loop can be demoed on a single laptop with two browser windows side by side.
5. Write `docs/demo-guide.md` documenting exactly how to start the whole system for a demo: start backend, start frontend server, open both role URLs, walk through a full example conversation, and what to do if something breaks live.

---

## SECTION 6 — Phase 8: Scaling & Results Tooling (code only — NOT the actual data recording)

**Note again: recording 40+ signs is a human task for the team, not something to generate here. This section is only about the tooling/scripts needed to make scaling and reporting easy once that real data exists.**

### Requirements
1. Confirm/extend `model-training/scripts/build_dataset.py` and `train_model.py`/`evaluate.py` (from Sections 1) work unchanged when pointed at a larger `labels.json` (40+ signs) and a larger `dataset/raw/` folder — they should already be generic enough given how Section 1 was built; add a note in each script's docstring confirming this, and add any small parameterization fixes needed (e.g., don't hardcode class count anywhere — always derive it from `label_encoder.json`).
2. Create `model-training/scripts/compare_results.py`: given two evaluation reports (e.g., the 3-word baseline `evaluation_report.md`/confusion matrix and a later 40-word one), generate a simple side-by-side comparison table (accuracy, per-class performance summary, fallback-trigger rate) saved as `model-training/saved_model/comparison_report.md` — this becomes direct written evidence for the project's results section.
3. Create `frontend/demo-baseline.html`: a minimal standalone page with a stopwatch/timer and a plain text input, used to time how long it takes to manually type out a sentence — this produces the timed "manual baseline" comparison number referenced in the dossier's Baseline System section, for a fair side-by-side against the AI system's measured end-to-end latency.
4. Create `docs/RESULTS.md` as a template (not filled in with fake numbers — leave clear placeholders) with sections matching the dossier's hypotheses H1–H5 and the KPI table (Recognition Accuracy, Translation Latency, Context Generation Time, WebSocket Reliability, Bidirectional Response Time), so the team can drop in real measured numbers as they come in from testing.

---

## General Requirements Across All Sections

- Reuse existing files, naming conventions, and the established message contract exactly as documented above — do not rename or restructure anything that already exists and works.
- Every new script/module must include a short header comment explaining what it does and how it fits into the pipeline, since multiple team members with different specialties (frontend, ML, backend) will be reading each other's code.
- Prefer clear, explicit error handling and console/log messages over silent failures throughout — this is a live-demo project, and silent failures are the hardest thing to debug on demo day.
- Do not fabricate or hallucinate performance numbers, accuracy figures, or dataset sizes anywhere in code, comments, or generated reports — all report templates should use clearly marked placeholders until real numbers exist.

## Deliverable

Working through Sections 1–6 in order (waiting for real recorded data before Section 1 can produce a real model, and waiting for a real trained model before Section 2 can do a real conversion), produce all the files and integrations described above, resulting in a fully functional end-to-end system: webcam → landmark detection → BiLSTM prediction with confidence-gated fallback → WebSocket → Gemini-generated sentence → official's screen, and official's spoken response → transcribed → back to the deaf user's screen — with KPI logging and a stress-test checklist throughout.
