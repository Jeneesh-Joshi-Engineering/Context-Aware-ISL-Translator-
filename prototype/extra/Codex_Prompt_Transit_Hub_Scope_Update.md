# Codex Prompt — Complete Remaining Work (Transit-Hub Scope, Updated Vocabulary)

Copy everything below the line into Codex as a single prompt. **This supersedes the earlier "Phases 3–8" prompt** — the architecture is unchanged, but the domain has narrowed to transit hubs only, and the vocabulary/rollout plan is now specific and tiered. If you already ran parts of the old prompt, that code doesn't need to be rebuilt — only the domain-specific pieces called out explicitly below (labels, Gemini prompt wording, rollout batches) need to change.

**Sequencing reminder:** work through the sections below in order. Section 1 (training) only produces a real model once Tier 1 data is actually recorded by the team — this prompt does not generate synthetic data.

---

## Project Context (give Codex this exact framing)

I am building a real-time Indian Sign Language (ISL) translation system **scoped specifically to public transit hubs** — railway stations, bus terminals, and airports. This is a change from an earlier, broader banking-and-transit scope: **remove or rewrite any existing banking-context wording anywhere in the codebase (prompts, comments, UI copy, docs)** — the system now assumes the hearing person on the other end is transit staff: a ticket counter clerk, platform staff, security personnel, or police, not a bank teller.

The following architecture already exists and works — **do not rebuild or restructure it**, only extend it per the sections below:

```
frontend/
├── index.html, style.css
└── js/ (camera.js, landmarker.js, normalize.js, recorder.js, exporter.js, main.js)

model-training/
├── scripts/ (schema_validator.py, merge_sessions.py, deduplicate.py, augment.py,
│             balance_report.py, split_dataset.py, build_dataset.py)
├── labels.json       # MUST BE REPLACED — see Section 0 below
└── dataset/raw/, dataset/processed/vN/

backend/
├── pom.xml
├── src/main/java/com/isl/backend/ (IslBackendApplication.java, config/WebSocketConfig.java,
│    websocket/SessionManager.java, websocket/ConversationWebSocketHandler.java, model/*.java)
└── test-client/test-client.html
```

Existing WebSocket message contract (reuse exactly, do not change):
```json
{"type":"KEYWORD_DETECTED","sessionId":"abc123","role":"deaf_user","keyword":"Help","confidence":0.91,"timestamp":"..."}
{"type":"SENTENCE_GENERATED","sessionId":"abc123","originalKeywords":["Help"],"generatedSentence":"...","generationTimeMs":812,"timestamp":"..."}
{"type":"OFFICIAL_RESPONSE","sessionId":"abc123","role":"official","transcribedText":"...","timestamp":"..."}
{"type":"ERROR","sessionId":"abc123","errorMessage":"...","timestamp":"..."}
```

---

## SECTION 0 — Replace `labels.json` with the Transit Vocabulary (do this first)

Replace `model-training/labels.json` with the following content exactly:

```json
{
  "domain": "transit_hub",
  "tier_1_baseline": ["Help", "Train", "Ticket", "No_Gesture"],
  "tier_2_expansion": {
    "batch_A_urgent_situational": ["Lost", "Problem", "Police", "Security", "Medical_Help_Emergency"],
    "batch_B_navigation_wayfinding": ["Where", "Platform", "Counter", "Washroom", "Exit", "Entrance", "Left", "Right", "Straight"],
    "batch_C_transactional": ["Money_Pay", "Luggage_Bag", "Reservation", "Receipt", "Change_Exchange", "Cancel", "Schedule"],
    "batch_D_transit_modes_and_info": ["Bus", "Flight", "Seat", "Information", "Late_Delay", "When", "Now", "Next"],
    "batch_E_social_communication": ["Yes", "No", "Please", "Thank_You", "Deaf", "Understand", "Not_Understand", "Wait"]
  },
  "all_labels_flat": ["Help","Train","Ticket","No_Gesture","Lost","Where","When","Problem","Police","Security","Medical_Help_Emergency","Money_Pay","Luggage_Bag","Bus","Flight","Platform","Counter","Washroom","Exit","Entrance","Seat","Reservation","Receipt","Change_Exchange","Information","Late_Delay","Now","Next","Left","Right","Straight","Cancel","Schedule","Yes","No","Please","Thank_You","Deaf","Understand","Not_Understand","Wait"]
}
```

Update **every place in the existing pipeline that reads label lists** (`schema_validator.py`'s allowed-label check, `build_dataset.py`'s config loading, any frontend label-mapping file) to read from `all_labels_flat` when validating/training against the full vocabulary, and from `tier_1_baseline` specifically when building the initial baseline dataset version (`v1`). Do not hardcode the label list a second time anywhere else — always read it from this file so there is a single source of truth.

**Note on label naming:** slashes and spaces from the original wordlist (e.g., "Medical Help / Emergency", "Money / Pay") have been normalized to underscore-joined identifiers (`Medical_Help_Emergency`, `Money_Pay`) for safe use as code identifiers, filenames, and JSON keys — use these exact normalized names everywhere in code; display-friendly versions with spaces/slashes can be generated for UI display only, via a simple string-replace, not stored as a separate mapping.

---

## SECTION 1 — Baseline Training Pipeline (Tier 1 only: Help, Train, Ticket, No_Gesture)

Same technical requirements as before, scoped to the 4-word baseline first:

1. `model-training/scripts/train_model.py`:
   - Loads `X_train.npy`/`y_train.npy`/etc. from a specified `dataset/processed/vN/` folder (CLI arg).
   - BiLSTM architecture: `Bidirectional(LSTM(64, return_sequences=True))` → `Dropout(0.3)` → `Bidirectional(LSTM(32))` → `Dropout(0.3)` → `Dense(32, relu)` → `Dense(num_classes, softmax)`, where `num_classes` is derived from `label_encoder.json`, never hardcoded.
   - Adam optimizer, categorical cross-entropy, EarlyStopping (patience=10, monitor `val_loss`, restore best weights), ModelCheckpoint.
   - Saves `model-training/saved_model/model.h5` and a SavedModel directory.
   - Outputs a training-history accuracy/loss plot.
2. `model-training/scripts/evaluate.py`:
   - Test-set accuracy, confusion matrix PNG, per-class precision/recall/F1 in `evaluation_report.md`.
   - Confidence-threshold analysis: % of test predictions falling below 70% confidence (this is the fallback-trigger rate KPI).
3. Both must run standalone via CLI, e.g. `python scripts/train_model.py --dataset-version v1`, CPU-only compatible (this is a small prototype dataset, not big-data scale).

---

## SECTION 2 — TensorFlow.js Conversion & In-Browser Inference

Unchanged technical approach from before:

1. `model-training/scripts/convert_to_tfjs.sh`: converts `saved_model/model.h5` into `frontend/model/model.json` + weights via `tensorflowjs_converter`.
2. `frontend/js/inference.js`:
   - Loads the converted model, maintains a rolling 30-frame buffer using the existing `normalize.js` logic (don't reimplement it).
   - Predicts every few frames, applies the **70% confidence threshold**, maps predicted index → label string using the same `label_encoder.json`/`labels.json` mapping used in training (copy the relevant mapping file into `frontend/model/` so training and frontend never drift apart).
   - Exposes an `onLowConfidence(callback)` hook for the fallback state machine (Section 5).
   - Displays the live predicted word and a rolling-average latency number (target ≤50ms) on screen; logs a console warning if latency consistently exceeds target.
3. Wire into `main.js` as a distinct mode alongside the existing recording mode, without breaking recording functionality.

---

## SECTION 3 — Backend Gemini Integration & Frontend WebSocket Client (Transit-Specific Prompt)

### Part A — Backend
1. Create/update `backend/src/main/java/com/isl/backend/gemini/GeminiService.java` with method `generateContextualSentence(List<String> keywords)`.
2. **Use this exact transit-specific system prompt** (this replaces any earlier banking-inclusive wording):
   > "You are converting isolated Indian Sign Language keywords into a single, natural, polite, grammatically correct sentence, spoken by a Deaf or Hard-of-Hearing passenger to transit staff at a railway station, bus terminal, or airport (e.g., ticket counter staff, platform staff, security personnel, or police). The sentence should sound like something a passenger would realistically say in that setting. Keywords, in the order signed: {keywords}. Respond with ONLY the sentence — no explanation, no quotation marks, no preamble."
3. Read `GEMINI_API_KEY` from environment, fail fast at startup if missing. 5s timeout, 1 retry on transient failure only.
4. Wire into the existing `ConversationWebSocketHandler`'s `KEYWORD_DETECTED` handling: call Gemini, time it, broadcast `SENTENCE_GENERATED` to the session, or `ERROR` on failure. Log `generationTimeMs` via the existing `KpiLogger`.

### Part B — Frontend
1. `frontend/js/wsClient.js`: connects with `sessionId`/`role` from URL query params, exposes `sendKeyword(keyword, confidence)` and callbacks for incoming message types, handles reconnection with backoff.
2. Wire `inference.js`'s high-confidence predictions into `sendKeyword()`.
3. Display incoming `generatedSentence` prominently; log end-to-end latency from "keyword sent" to "sentence displayed."

### Sanity-check examples to validate the transit-specific prompt against (don't hardcode these as test assertions with exact string matches, since LLM output isn't deterministic — just manually confirm Gemini's tone/content is sensible for each):
- `["Ticket", "Lost"]` → should produce something like a passenger saying they've lost their ticket and need help.
- `["Train", "When"]` → should produce something like asking when the train arrives/departs.
- `["Washroom", "Where"]` → should produce something like asking for washroom directions.
- `["Police", "Help"]` → should produce something like urgently requesting police assistance.

---

## SECTION 4 — Bidirectional Feedback (Speech-to-Text)

Unchanged from before:
1. `frontend/js/speechToText.js`: Web Speech API on the official's screen, `startListening()`/`stopListening()`, sends finalized transcriptions as `OFFICIAL_RESPONSE` via the existing `wsClient.js`.
2. Deaf user's screen displays incoming `OFFICIAL_RESPONSE` text.
3. Log latency from "official finished speaking" to "text displayed."
4. Detect and gracefully handle browsers without `SpeechRecognition` support.

---

## SECTION 5 — Fallback State Machine, KPI Logging, Stress Testing

Unchanged from before:
1. `frontend/js/fallback.js`: `TRACKING` ↔ `FALLBACK_SPELLING` state machine, triggered after 3 consecutive low-confidence prediction cycles, with a manual finger-spelling/letter-entry UI, returning to tracking once resolved. Log every trigger via the KPI logger.
2. `frontend/js/kpiLogger.js`: shared event logger (`capture`, `prediction`, `ws_send`, `sentence_received`, `speech_transcribed`, `fallback_triggered`, `fallback_resolved`), persisted to `localStorage`, exportable as CSV.
3. `frontend/test-scenarios.html`: manual QA checklist — WebSocket drop mid-conversation, poor lighting/confidence degradation, out-of-vocabulary gesture handling, official disconnect handling.
4. Confirm two-client demo works via `?role=` and `?sessionId=` query params on `index.html`.
5. `docs/demo-guide.md`: how to start backend + frontend, open both role URLs, and walk through a **transit-specific example conversation** (e.g., deaf passenger signs "Ticket" → "Lost" → "Help", official responds by voice, response appears on deaf user's screen).

---

## SECTION 6 — Tiered Vocabulary Rollout & Results Tooling

This replaces the earlier generic "scale to 40+ signs" instruction with the specific tiered plan:

1. **Tier 1 first** (already covered in Section 1): `Help, Train, Ticket, No_Gesture`. Get the full pipeline — recording → training → TF.js → WebSocket → Gemini → display — proven end-to-end on just these 4 before touching Tier 2.
2. **Tier 2 rollout in batches**, recorded and integrated one batch at a time rather than all 37 at once, so the team can catch dataset-quality or model-confusion issues early rather than after recording everything:
   - Batch A (urgent/situational): `Lost, Problem, Police, Security, Medical_Help_Emergency`
   - Batch B (navigation/wayfinding): `Where, Platform, Counter, Washroom, Exit, Entrance, Left, Right, Straight`
   - Batch C (transactional): `Money_Pay, Luggage_Bag, Reservation, Receipt, Change_Exchange, Cancel, Schedule`
   - Batch D (transit modes & info): `Bus, Flight, Seat, Information, Late_Delay, When, Now, Next`
   - Batch E (social/communication): `Yes, No, Please, Thank_You, Deaf, Understand, Not_Understand, Wait`
3. After each batch is recorded and merged in, re-run `build_dataset.py` (creating a new versioned dataset, e.g. `v2`, `v3`...) and re-run `train_model.py`/`evaluate.py` — confirm `model-training/scripts/compare_results.py` (create this if it doesn't exist) can generate a simple before/after comparison table (overall accuracy, per-class F1, fallback-trigger rate) between consecutive versions, saved to `model-training/saved_model/comparison_report.md`. This becomes the evidence trail showing accuracy/robustness as vocabulary scales.
4. `frontend/demo-baseline.html`: standalone stopwatch + text-input page for timing the manual-typing baseline, used for the side-by-side comparison against the AI system's measured latency.
5. `docs/RESULTS.md`: template (placeholders only, no fabricated numbers) covering KPIs (Recognition Accuracy per tier, Translation Latency, Context Generation Time, WebSocket Reliability, Bidirectional Response Time) mapped against hypotheses H1–H5, structured so results can be filled in tier-by-tier as vocabulary scales.

---

## General Requirements

- Reuse all existing files/conventions exactly; only change what's explicitly called out above (labels, Gemini prompt wording, rollout plan, domain-specific docs/UI copy).
- Search the existing codebase for any leftover banking-related wording (comments, prompts, UI text, doc files) and update it to transit-hub language for consistency.
- Every new script/module needs a short header comment explaining its role.
- No fabricated performance numbers anywhere — templates use clear placeholders until real measurements exist.
- Do not attempt to generate synthetic training data for any label — real data collection is a human task outside this prompt's scope.

## Deliverable

A fully working transit-hub-scoped ISL translation system: webcam → landmark detection → BiLSTM prediction (trained first on the 4-word Tier 1 baseline, then incrementally on Tier 2 batches) with confidence-gated fallback → WebSocket → Gemini-generated, transit-context-appropriate sentence → official's screen, and official's spoken response transcribed back to the deaf user — with tiered rollout tooling, KPI logging, and a stress-test checklist, all vocabulary-driven by the single `labels.json` source of truth.
