# ISL Bridge — Context Pack for Chapters 4 and 5

> Updated for the word-only `words_v4` run. The earlier alphabet experiment is archived. The test data was inspected during prior development, so call this a development holdout, not an independent blind evaluation. Refer to `isl-translator/docs/word-model-results.md` for the current authoritative results.

## How to use this file

Give this file to Claude together with the repository, the Chapter 1–3 report, screenshots, and any approved university formatting rules. Ask Claude to write **Chapter 4: System Design and Experimental Setup** and **Chapter 5: Results and Discussion** from the verified facts below.

Claude must not invent participants, accuracy values, hardware specifications, latency values, screenshots, statistical significance, or literature citations. Where this file says `TO BE FILLED`, use the real value from the student's records or leave a clearly marked placeholder. Keep the distinction between a recorded landmark test and a live-camera test.

The project is an academic prototype called **ISL Bridge**. It supports a counter-based conversation between a signer and an official. The signer camera is processed locally in the browser. A BiLSTM recognizes an individual sign/gloss. The gloss is sent through a Spring Boot WebSocket backend, which produces an English/Hindi response using Gemini when configured or a deterministic offline phrase fallback. Both participants receive the same translated message.

This is an individual-gloss assistance system. It does not claim unrestricted Indian Sign Language sentence parsing, continuous fingerspelling, or general sign-language translation.

## Exact Chapter 4 mapping

### 4.1 System Architecture and Diagrams (DFD/UML/Block Diagram/Physical Layout)

Describe the following layers and include diagrams based on them:

1. **Signer client**
   - `index.html` and `js/signer.js` provide the signer interface.
   - The browser requests camera permission using `getUserMedia`.
   - MediaPipe Hand Landmarker detects up to two hands locally.
   - Each hand contributes 21 landmarks × 3 coordinates. Two hand slots therefore produce 126 values per frame.
   - The system keeps a rolling window of 30 frames.
   - The browser normalizes every hand relative to its wrist and middle-finger MCP scale.
   - TensorFlow.js loads `frontend/model/model.json` and runs the BiLSTM in the browser.

2. **Application backend**
   - Spring Boot serves the frontend as static resources and exposes REST and STOMP-over-WebSocket endpoints.
   - `CounterController` and `CounterService` create, join, reclaim, and end counter sessions.
   - `SessionController` and `SessionService` manage conversation sessions and history.
   - `SessionSocketController` handles join, gloss, and official transcript messages.
   - `HealthController` reports server status, translation mode, and the deployed vocabulary.

3. **Translation layer**
   - `GeminiClient`/translation services receive a source gloss or official reply and recent conversation context.
   - The expected response is structured bilingual text: English plus Hindi.
   - `TemplateFallbackAgent` supplies deterministic offline phrases for supported counter words; legacy letter formatting remains in backend code but letters are not model outputs.
   - Provider failures fall back to the template agent; unsupported text remains explicitly unavailable rather than being presented as a fabricated translation.

4. **Official client**
   - `official.html` and `js/official.js` create or join a counter, display the shared conversation, accept typed or speech replies, and send English/Hindi responses.
   - `speech.js` handles browser speech-recognition lifecycle and `speechToText.js` provides the speech adapter.

5. **Shared messaging**
   - The signer publishes `KEYWORD_DETECTED`/keyword messages only after stable, confident model output.
   - `No_Gesture` is suppressed and never becomes a translation request.
   - The server publishes `SESSION_STATUS` and `TRANSLATED_MESSAGE` to `/topic/session/{SESSION_ID}`.
   - Both clients subscribe to the same topic, so the official and signer see the same conversation event.

Suggested diagrams:

- Block diagram: Signer Camera → MediaPipe → Normalization → 30-frame BiLSTM → Gloss → WebSocket Backend → Gemini/Fallback → Bilingual Message → Signer + Official.
- DFD Level 0: Signer, Official, Counter/Session Backend, BiLSTM, Translation Provider, Shared Conversation.
- DFD Level 1: camera acquisition, landmark extraction, sequence buffering, inference, validation, translation queue, persistence/history, broadcast.
- UML component diagram: browser components, Spring controllers/services, WebSocket broker, translation clients, model assets.
- Deployment diagram: browser on client device, Spring Boot process, optional Gemini HTTPS service, local counter JSON state.
- Sequence diagram: create counter → signer joins → official joins → stable gloss → backend translation → topic broadcast → both screens update.
- Physical layout: two screens/devices at a railway/public-service counter; camera faces the signer; official screen faces staff.

### 4.2 Algorithm and Process Flow Design

Explain this process in numbered form:

1. The user opens the signer screen through the Spring Boot origin.
2. The user connects with a permanent counter code or creates a manual session.
3. The browser obtains camera access and initializes MediaPipe in `VIDEO` mode, preferring GPU and falling back to CPU.
4. For each accepted video frame, hand landmarks are detected and assigned to stable left/right slots.
5. Each hand is wrist-centered and divided by wrist-to-middle-MCP distance. Missing hand slots are zero-filled.
6. Frames are appended to a rolling 30-frame buffer. Inference runs periodically after the buffer is full.
7. The TensorFlow.js model returns softmax scores. The default confidence threshold is 0.60.
8. The same label must remain stable for the required consecutive predictions before emission. Repeated identical signs require an idle/no-gesture interval before re-emission.
9. `No_Gesture` and low-confidence predictions are suppressed.
10. A valid gloss is sent through the signer WebSocket channel.
11. The backend validates sender role, gloss length, session existence, and queue order.
12. The backend translates through Gemini or the explicit offline phrase fallback.
13. The bilingual message is saved in session history and broadcast to both clients.

Include pseudocode similar to:

```text
frame = camera.read()
hands = mediapipe.detect(frame)
vector = two_hand_normalize(hands)       # 126 values
window.push(vector)

if window.length == 30 and inference_tick:
    scores = bilstm(window)
    label, confidence = argmax(scores)
    if label != No_Gesture and confidence >= 0.60:
        if stable(label, required_count) and rearmed_by_idle:
            websocket.send(label, confidence)

backend receives label
translate service word using Gemini or template fallback
publish response to both session clients
```

### 4.3 User Interface and Input Data Design

Describe the current interface rather than the old “trained signs” chip list:

- The signer landing screen presents **Hello**, **नमस्ते**, and **नमस्कार**, a short explanation, counter-code input, manual-session option, and camera privacy note.
- The signer conversation view displays camera preview, camera/recognition/connection status, live prediction, confidence/latency detail, retry controls, and the shared conversation.
- The official view supports counter creation, QR/code sharing, session status, bilingual conversation, typed replies, speech input, language selection, Listen/Stop, and Send.
- The diagnostics view tests backend health, MediaPipe initialization, deployed model labels, recorded samples, WebSocket delivery, and the camera/tracker separately.
- Do not state that a screenshot proves model accuracy. A UI screenshot proves layout and visible state only.

Input contract:

- Raw hand landmarks: two optional hands, 21 landmarks per hand, x/y/z coordinates.
- Normalized frame: 126 floating-point values.
- Sequence: 30 frames × 126 features.
- Model output: 13 softmax classes in the order stored in `frontend/model/model_metadata.json`.
- The deployed classes are Counter, Entrance, Exit, Help, Money, Police, Receipt, Security, Ticket, Train, When, Where, and No_Gesture.
- `Hello` has only seven usable recordings and is intentionally shown as UI greeting text rather than included as a trained output class.

### 4.4 Experimental Setup and Tools (Software and Hardware)

Verified software setup:

- Windows PowerShell environment.
- Java 25 or newer required by Maven Enforcer.
- Maven 3.9.x.
- Node.js/npm used for frontend assets and JavaScript tests.
- Spring Boot 3.5.16.
- TensorFlow.js 4.22.0 in the browser/runtime checks.
- MediaPipe Tasks Vision 0.10.14.
- STOMP.js 7.0.0 and SockJS 1.6.1.
- Training environment: Python 3.12, TensorFlow 2.20.0, Keras 3.15.1, NumPy 2.5.3, scikit-learn 1.9.1.
- Training seed: 42.

Hardware details are not recorded in the repository. Fill these from the actual machine used:

- CPU: `TO BE FILLED`
- GPU/delegate: browser attempts GPU and falls back to CPU; actual delegate observed during the demo: `TO BE FILLED`
- RAM: `TO BE FILLED`
- Camera: `TO BE FILLED`
- Browser and version: `TO BE FILLED`

Training data and preprocessing:

- Raw data is under `isl-translator/model-training/dataset/raw`.
- The audit found 331 unique usable recordings after exact normalized-sequence deduplication, trimming blank lead-in/out, resampling observed poses to 30 frames, and rejecting clips with fewer than 15 tracked frames.
- Duplicate recordings removed: 1,678.
- Conflicting normalized hashes removed: 0.
- 467 exports rejected for fewer than 15 tracked frames.
- The split is chronological within each class: 233 train, 49 validation, 49 test.
- No participant IDs were present, so the evaluation is explicitly **not signer-independent**.
- Training augmentation is applied only to training data: small Gaussian landmark noise, in-plane rotation, and preservation of missing-hand masks.
- The model architecture is BiLSTM(64, return sequences) → Dropout(0.3) → BiLSTM(32) → Dropout(0.3) → Dense(32, ReLU) → Dense(13, softmax).
- The word-only run used random initialization; archived alphabet and legacy weights were not reused.

### 4.5 Implementation, Deployment and Testing

Describe implementation files by responsibility:

- `frontend/js/normalize.js`: feature normalization and fixed dimensions.
- `frontend/js/landmarker.js`: MediaPipe setup, hand-slot assignment, overlay rendering.
- `frontend/js/inference.js`: model loading, warm-up, rolling buffer, confidence/stability gates, disposal.
- `frontend/js/signer.js`: signer camera/session/prediction UI.
- `frontend/js/official.js`: official counter/session/reply UI.
- `backend/.../counter`: counter lifecycle.
- `backend/.../session`: session lifecycle/history.
- `backend/.../ws/SessionSocketController.java`: WebSocket message routing and translation queue.
- `backend/.../translation`: Gemini and deterministic fallback translation.
- `scripts/train-expanded-model.py`: data audit, split, training, evaluation artifacts.
- `scripts/export-expanded-model.mjs`: TF.js export and Python/TF.js parity gate.
- `scripts/integration.mjs`: full model → backend → two-client integration test.

Deployment procedure:

```powershell
cd "C:\BE Project demonstration"
npm ci
npm run assets
.\Start-ISLBridge.ps1 -Port 8083
```

Open `http://localhost:8083/official.html`. For a second device, use a trusted HTTPS deployment; camera access is not reliable from a phone pointed at a laptop's plain `localhost` URL.

Testing evidence:

- Direct model test: passed model parity, diagnostic vocabulary, rolling stable emission, idle suppression, tensor disposal, and normalization checks.
- Direct speech test: passed final-segment accumulation, Hindi selection, permission failure handling, no-speech/audio-capture errors, and bounded stop behavior.
- Backend Maven tests: passed.
- Maven package: passed.
- HTTP health check: returned status `ok` and the 12 non-idle words; the model has 13 total classes including idle.
- Live integration: passed every deployed label through BiLSTM → gloss → backend → both WebSocket clients, including counter busy/reply/end/next-signer/manual-session behavior.
- Python/TF.js parity: passed on 49 held-out sequences; maximum probability difference was approximately `2.38 × 10^-7`.

### 4.6 Performance Evaluation

Use only recorded values. The training report gives classification accuracy; it does not provide a reliable live FPS or hardware benchmark. Include a table with:

| Metric | Verified value |
|---|---:|
| Number of output classes | 13 |
| Input shape | 30 × 126 |
| Usable recordings | 331 |
| Train / validation / test | 233 / 49 / 49 |
| Held-out test accuracy | 79.592% |
| TF.js/Python maximum probability difference | 2.38e-7 |
| Confidence threshold | 0.60 |
| Required stable predictions | 2 |
| Live end-to-end latency | `TO BE MEASURED` |
| Browser FPS | `TO BE MEASURED` |

Explain that the held-out score is a chronological, content-deduplicated, within-class split without signer separation. It is useful for deployment regression, but it should not be described as population-level accuracy.

### 4.7 Summary

Summarize that Chapter 4 established a locally processed camera pipeline, a browser-compatible BiLSTM, a Spring Boot/WebSocket synchronization layer, bilingual translation with fallback behavior, and reproducible tests. State that the implementation translates individual glosses and that the evaluation design limits generalization claims.

## Exact Chapter 5 mapping

### 5.1 Outputs and Outcomes

Report these concrete outcomes:

- A working two-screen counter conversation prototype.
- Local camera and MediaPipe landmark extraction.
- Browser BiLSTM inference with 13 deployed classes.
- Signer gloss delivery through WebSocket.
- Bilingual English/Hindi responses to both clients.
- Offline phrase fallback for supported words (alphabet recognition is archived).
- Counter lifecycle with QR/code-based joining, busy handling, ending, and reuse.
- Speech input/reply lifecycle on the official side.
- A redesigned signer interface with Hello/नमस्ते/नमस्कार and no old trained-sign chip list.

Do not call the greeting text a recognized sign. The greeting is UI content; `Hello` was excluded from the trained model because seven recordings were insufficient.

### 5.2 Analysis of Results and Interpretation of Data

Authoritative metrics from `training-report.json`:

- Test accuracy: `0.7959183673469388` = 79.592% over 49 test sequences.
- Test split is balanced approximately by class, but smaller classes have only 2–4 test examples.
- Counter, Entrance, Exit, Money, Receipt, Ticket and Train had full recall on this small split. Help had 2/4 correct, Police and Where 3/4 each, Security and idle 1/3 each, and When 0/2.
- Weak or unstable classes include No_Gesture, Security, When, and Help/Where word confusions. Report per-class precision/recall from the JSON rather than claiming all labels are equally reliable.
- The model's perfect-looking classes must be interpreted cautiously because no signer IDs exist and the split is chronological rather than participant-held-out.

Recommended interpretation:

1. The large improvement over a broken/unconnected pipeline is operational: the model loads in the browser and its outputs reach both clients.
2. The 79.6% score indicates useful separation on the current recorded set, not universal ISL recognition.
3. Weak idle performance can cause false positives in natural movement; this is why the UI also requires confidence, stability, and idle rearming.
4. Similar signs may remain difficult because the 126 features are hand-relative and omit face, body, and absolute hand position.
5. More independent signers and session metadata are required for a stronger evaluation.

Recommended table columns for Claude:

| Class | Support | Precision | Recall | F1-score | Interpretation |
|---|---:|---:|---:|---:|---|
| Use values from `training-report.json` | | | | | Strong / weak / needs more data |

### 5.3 Discussion of Results and Limitations of the System

Discuss strengths:

- Runs inference locally, reducing camera-data transfer.
- Uses the same deployed model metadata in frontend diagnostics and backend health vocabulary.
- Has explicit fallback behavior instead of silently fabricating translations.
- Uses a stable prediction gate and idle suppression to reduce repeated messages.
- Has a reproducible export parity check before browser deployment.
- Connects the ML output to a realistic counter workflow rather than stopping at a classifier demo.

Discuss limitations:

- Only individual glosses are translated; syntax, grammar, co-reference, and continuous sentence interpretation are not implemented.
- `Hello` is shown in the UI but is not a trained model class due to only seven recordings.
- The test split is not signer-independent.
- The dataset has cumulative exports and duplicate recordings; deduplication was necessary.
- Weak labels need more complete recordings, especially When, Security, and No_Gesture.
- Hand-only, wrist-relative features omit facial expression, body pose, and absolute position.
- Camera permission, lighting, hand occlusion, distance, and browser support affect live recognition.
- Gemini requires a local API key for arbitrary bilingual responses; fallback phrases cover only supported phrases.
- Browser speech recognition depends on browser/device services and may require internet.
- Runtime conversation history is in memory; counter identifiers are persisted separately.
- A plain localhost URL is suitable for one-machine demonstration, not a production multi-device deployment.

Use the following safe conclusion language: “The prototype demonstrates an integrated and testable path from camera landmarks to bilingual counter assistance. The measured result is valid for the collected and split dataset, while broader sign-language coverage and signer-independent generalization require additional data, participant metadata, and a sentence-level language model.”

## Files Claude should cite or inspect

- Root project overview: `README.md`
- Training report: `isl-translator/model-training/saved_model/words_v4/training-report.json`
- Model metadata: `isl-translator/model-training/saved_model/words_v4/model_metadata.json`
- Export parity: `isl-translator/model-training/saved_model/words_v4/verification.json`
- 48-hour dataset plan: `isl-translator/docs/dataset-plan-48-hours.md`
- Model provenance: `isl-translator/frontend/model/README.md`
- Signer UI: `isl-translator/frontend/index.html`, `isl-translator/frontend/js/signer.js`
- Inference: `isl-translator/frontend/js/inference.js`, `normalize.js`, `landmarker.js`
- Official UI: `isl-translator/frontend/official.html`, `isl-translator/frontend/js/official.js`
- Backend WebSocket: `isl-translator/backend/src/main/java/com/isl/backend/ws/SessionSocketController.java`
- Backend fallback translation: `isl-translator/backend/src/main/java/com/isl/backend/translation/TemplateFallbackAgent.java`
- Integration verification: `scripts/integration.mjs`

## Prompt to give Claude

```text
Using the attached CHAPTER_4_5_CLAUDE_CONTEXT.md and the repository, write Chapter 4 and Chapter 5 of my academic project report according to the numbered headings in the context file. Use formal technical prose. Describe the actual implemented ISL Bridge system, not an ideal future system. Use the verified metrics and file names. Do not invent participants, hardware, live latency, screenshots, citations, or statistical significance. Mark missing values as [TO BE FILLED]. Explain that the 79.592% result is a chronological, content-deduplicated, non-signer-independent 49-example test split. Clearly separate recorded-model evaluation from live-camera and end-to-end integration verification. Include suitable DFD/UML/block/sequence diagram descriptions that I can convert into figures, tables for the model metrics and per-class results, pseudocode for the inference/translation pipeline, and an honest limitations discussion. Keep the distinction between a single-gloss prototype and unrestricted ISL sentence translation.
```
