# ISL Translator Project — Pending Work Report
**Generated:** August 17, 2026  
**Based on:** Implementation Roadmap (10-week timeline with 8 phases)

---

## Executive Summary

Your project is **~45% complete** based on the roadmap. The data acquisition and frontend layers are functional, but the core intelligent processing (BiLSTM model), in-browser inference, backend integration, and testing phases are either missing or incomplete.

**Critical path blocker:** Phase 3 (BiLSTM model training) must complete before Phases 4–6 can proceed.

---

## Phase-by-Phase Completion Status

### Phase 1: Data Acquisition Layer ✅ **COMPLETE**
**Target:** Weeks 1–2 | **Status:** Done

**Completed:**
- ✅ MediaPipe hand landmark detection (via `landmarker.js`)
- ✅ Webcam stream capture with privacy boundary (via `camera.js`)
- ✅ Hand skeleton visualization on canvas overlay
- ✅ Real-time landmark coordinate logging
- ✅ Stable frame rate (20–30 FPS in-browser)

**Deliverable evidence:**
- [frontend/js/landmarker.js](frontend/js/landmarker.js) — MediaPipe integration
- [frontend/js/camera.js](frontend/js/camera.js) — Privacy-aware camera access
- [frontend/index.html](frontend/index.html) — Live demo page

**No action needed.**

---

### Phase 2: Dataset Creation 🟡 **PARTIAL**
**Target:** Weeks 2–3 | **Status:** 60% complete

**Completed:**
- ✅ Recording mode implemented (start/stop sequences)
- ✅ Landmark frame buffering (rolling window)
- ✅ Sequence labeling system
- ✅ JSON/CSV export functionality (via `exporter.js`)
- ✅ Fixed-length sequence padding (30 frames, per code)

**Still needed:**
- ⏳ **Active data collection:** Team has not yet recorded 30–50 balanced sequences per person for baseline 3-word set ("Hello", "Help", "Emergency")
- ⏳ **"No Gesture" negative class:** Critical for distinguishing intentional gestures from resting hand — not yet in dataset
- ⏳ **Condition variation:** No systematic variation in lighting/angle/speed yet documented

**Current dataset status:**
- [data-collection/dataset/raw/](data-collection/dataset/raw/) — Exists but appears empty or sparsely populated
- [data-collection/dataset/processed/](data-collection/dataset/processed/) — No processed versions yet

**Action required:**
1. **Record baseline dataset immediately:** All 4 team members, 30+ sequences each for 3 signs + 1 negative class
2. **Use the frontend recording tool** to capture and export these as JSON/CSV
3. **Organize into `data-collection/dataset/raw/`** following naming convention: `{name}_session{N}.json`

**Priority:** HIGH (blocks Phase 3)

---

### Phase 3: Intelligent Processing — BiLSTM Model 🔴 **NOT STARTED**
**Target:** Weeks 4–6 | **Status:** 0% complete (legacy scripts exist, but inactive)

**Status:**
- ❌ No active training pipeline for 2026 dataset
- ❌ No trained model (either `.h5` or SavedModel format)
- ❌ No confusion matrix or recognition accuracy KPI measured
- ❌ No 60% confidence threshold logic implemented in training loop

**Legacy files found but marked as archived:**
- [config.py](config.py), [data.py](data.py), [model.py](model.py), [train.py](train.py) — these are commented as "legacy monolithic" and point to the active pipeline under `model-training/`

**Active infrastructure available:**
- ✅ [model-training/scripts/build_dataset.py](model-training/scripts/build_dataset.py) — preprocessing pipeline
- ✅ [model-training/scripts/augment.py](model-training/scripts/augment.py) — data augmentation
- ✅ [model-training/scripts/split_dataset.py](model-training/scripts/split_dataset.py) — train/val/test splitting
- ✅ [model-training/labels.json](model-training/labels.json) — label mappings (exists but needs population)

**What is missing:**
1. **Training script** — No `train_model.py` in `model-training/scripts/`
2. **Keras model definition** — No BiLSTM architecture code
3. **Model checkpoint storage** — [model-training/saved_model/](model-training/saved_model/) exists but is empty
4. **Evaluation & metrics** — No `evaluate.py` or confusion matrix generation

**Action required:**
1. Create [model-training/scripts/train_model.py](model-training/scripts/train_model.py) with:
   - Bidirectional LSTM architecture (64 → 32 units, as per roadmap)
   - Categorical cross-entropy loss
   - Early stopping (patience=10)
   - Validation monitoring
   - Confidence threshold tracking (60% target)
2. Implement data pipeline: raw JSON → preprocessing → train/val/test split → training loop
3. Save trained model to `model-training/saved_model/model.h5` and `model-training/saved_model/model_savedmodel/`
4. Generate confusion matrix and accuracy report

**Priority:** CRITICAL (blocks Phases 4, 5, 6, 7)

**Estimated effort:** 2–3 weeks for one person (ML owner)

---

### Phase 4: TensorFlow.js Conversion & In-Browser Inference 🔴 **NOT STARTED**
**Target:** Week 6 | **Status:** 0% complete

**Status:**
- ❌ No model conversion script
- ❌ No `model.json` + weight files in [frontend/model/](frontend/model/)
- ❌ No in-browser prediction loop
- ❌ No latency measurement system (target ≤50ms per roadmap H2)

**What is needed:**
1. **TensorFlow.js model conversion:**
   ```bash
   tensorflowjs_converter --input_format=keras \
       model-training/saved_model/model.h5 \
       frontend/model/
   ```
2. **Frontend inference integration** (wire into `main.js`):
   - Load model: `tf.loadLayersModel('frontend/model/model.json')`
   - Rolling window of last 30 frames
   - Continuous prediction (e.g., every 3 frames)
   - Apply 60% confidence threshold
   - Display predicted word on screen
3. **Latency measurement:**
   - Timestamp at capture → timestamp at display
   - Log to console/UI
   - Target: ≤50ms end-to-end

**Action required:**
1. After Phase 3 completes, write conversion script
2. Integrate `tf.loadLayersModel()` into [frontend/js/main.js](frontend/js/main.js)
3. Implement rolling prediction window + confidence check
4. Add timing instrumentation

**Priority:** HIGH (blocks Phases 5, 6, 7)

**Estimated effort:** 1 week (Frontend/ML owner)

---

### Phase 5: Contextual Generation Layer — Spring Boot + Gemini 🟡 **PARTIAL**
**Target:** Week 7 | **Status:** 40% complete

**Completed:**
- ✅ Spring Boot project scaffolded (found at [backend/](backend/))
- ✅ WebSocket endpoint infrastructure (per [backend/README.md](backend/README.md))
- ✅ Test client HTML for manual testing ([backend/test-client/](backend/test-client/))
- ✅ Maven/pom.xml build configuration

**Still needed:**
- ⏳ **Frontend WebSocket client integration:** Not yet wired in [frontend/js/main.js](frontend/js/main.js) to send predicted keywords
- ⏳ **Gemini 2.5 Flash API integration:** Backend can receive keywords but does not call Gemini API yet
- ⏳ **System prompt design:** No prompt template for turning keywords into contextual sentences
- ⏳ **Round-trip latency measurement:** No timing logged for API call + response

**Current state:**
- [backend/src/main/java](backend/src/main/java) — WebSocket handlers exist but Gemini call logic is likely missing
- No environment variable handling for `GEMINI_API_KEY` confirmed in active backend

**Action required:**
1. **Gemini API integration in backend:**
   - Add `com.google.cloud:google-cloud-vertexai` or `google-generativeai` dependency
   - Create `GeminiService.java` class with method `generateContextualSentence(keyword)`
   - Use system prompt: *"Convert isolated ISL keywords into a single natural polite sentence for banking/transit context. Output only the sentence."*
   - Add timeout and error handling
2. **Frontend WebSocket client:**
   - On BiLSTM prediction (confidence ≥ 60%), send JSON: `{"type":"KEYWORD_DETECTED","keyword":"Help"}`
   - Listen for response type `{"type":"CONTEXTUAL_RESPONSE","sentence":"..."}`
   - Display sentence on official's screen
3. **Latency logging:**
   - Log API call duration
   - Measure end-to-end time from keyword detection to sentence display

**Priority:** HIGH (blocks Phases 6, 7)

**Estimated effort:** 1–2 weeks (Backend owner)

---

### Phase 6: Bidirectional Feedback — Speech-to-Text 🔴 **NOT STARTED**
**Target:** Week 8 | **Status:** 0% complete

**Status:**
- ❌ No Web Speech API integration in frontend
- ❌ No speech-to-text transcription flow
- ❌ No mechanism to send official's speech back to deaf user over WebSocket
- ❌ No bidirectional response time measurement

**What is needed:**
1. **Web Speech API integration:**
   - Use `SpeechRecognition` API (Chrome, Edge, Safari support)
   - Listen for "speech start" → "speech end" events
   - Transcribe to text automatically
2. **WebSocket message flow:**
   - Official speaks → transcription captured → send over WebSocket as `{"type":"SPEECH_RESPONSE","text":"..."}`
   - Deaf user receives and displays on their screen
3. **Latency measurement:**
   - Time from speech end to text display
   - Target: reasonable latency (not specified in roadmap, but aim for <3 seconds)

**Action required:**
1. Create `frontend/js/speechToText.js` module with:
   - `startListening()` / `stopListening()` functions
   - Event handlers for speech start/end/error
   - Transcription text capture
2. Integrate into `main.js`:
   - Wire into official's session view
   - Send transcriptions over existing WebSocket
   - Display on deaf user's screen in real time
3. Add latency logging

**Priority:** MEDIUM (completes core feedback loop for Phase 7)

**Estimated effort:** 1 week (Frontend owner)

---

### Phase 7: Integration, Fallback, and Stress Testing 🔴 **NOT STARTED**
**Target:** Week 9 | **Status:** 0% complete

**Status:**
- ❌ No end-to-end integration test harness
- ❌ No fallback state machine (confidence < 60% → finger-spelling mode)
- ❌ No stress testing (dropped connections, poor lighting, OOV gestures)
- ❌ No KPI logging framework
- ❌ No two-client demo (deaf user + official side-by-side)

**What is needed:**
1. **Fallback state machine:**
   - If BiLSTM confidence < 60% for N consecutive frames (e.g., N=3), switch UI to finger-spelling mode
   - Show on-screen keyboard or gesture-to-letter mapping
   - Let user manually spell out word
   - Auto-return to gesture tracking when confidence recovers
   - Log each fallback trigger + reason
2. **Stress test scenarios:**
   - Kill WebSocket mid-conversation → system should queue/retry
   - Drop light source → model confidence should degrade gracefully (not crash)
   - Unrecognized gesture → system should ask for clarification, not hallucinate
   - Official disconnects → deaf user should see "waiting for official" message
3. **KPI logging framework:**
   - Timestamp every event: capture → prediction → WebSocket send → Gemini call → display → speech transcription
   - Log to localStorage (JSON array) and export as CSV for analysis
   - Track: Recognition Accuracy, Translation Latency, Context Generation Time, Bidirectional Response Time
4. **Two-client demo setup:**
   - One URL with `?role=deaf_user` view
   - One URL with `?role=official` view
   - Shared WebSocket session (sessionId parameter)

**Action required:**
1. Create [frontend/js/fallback.js](frontend/js/fallback.js) state machine
2. Create [frontend/js/kpi-logger.js](frontend/js/kpi-logger.js) for telemetry
3. Write [frontend/test-scenarios.html](frontend/test-scenarios.html) with stress test checklist
4. Document demo flow in [docs/demo-guide.md](docs/demo-guide.md)

**Priority:** MEDIUM (Phase 8 depends on this being solid)

**Estimated effort:** 1–2 weeks (All: Frontend + Backend + Testing)

---

### Phase 8: Scaling and Final Polish 🔴 **NOT STARTED**
**Target:** Week 10 | **Status:** 0% complete

**Status:**
- ❌ Dataset still at 3-word baseline (per Phase 2 status)
- ❌ Model retraining on 40+ signs not done
- ❌ No baseline comparison demo (manual typing vs. system timed)
- ❌ No final KPI report with 40+ word accuracy
- ❌ No demo rehearsal or presentation materials

**What is needed:**
1. **Scale dataset from 3 to 40+ signs:**
   - Record ~30 sequences per sign, per person, across varied conditions
   - Total: ~40 signs × 4 people × 30 sequences = 4,800+ sequences
   - Use [model-training/scripts/build_dataset.py](model-training/scripts/build_dataset.py) to combine sessions
2. **Retrain BiLSTM on full dataset:**
   - Measure new Recognition Accuracy (baseline: expect 85–95% on 3-word, may drop to 65–80% on 40-word)
   - Generate confusion matrix for all 40 signs
   - Compare to 3-word results as evidence of model scaling
3. **Baseline comparison demo:**
   - Manual typing speed: ~50 words/minute typical (for comparison)
   - System end-to-end latency: measure sign capture → contextual sentence display
   - Side-by-side demo with timer for presentation
4. **Final results write-up:**
   - Fill in all KPIs against hypotheses (H1–H5 from dossier)
   - Recognition Accuracy, Translation Latency, Context Generation Time, Bidirectional Response Time, Fallback Robustness
   - Comparison to baseline and related work
5. **UI polish:**
   - High-contrast colors (accessibility)
   - Clear status indicators (recording, confidence, fallback mode)
   - Onboarding instructions for demo users

**Action required:**
1. **Dataset recording sprint:** Allocate Week 9–10 for all-hands data collection
2. **Model retraining:** Run [model-training/scripts/build_dataset.py](model-training/scripts/build_dataset.py) on full dataset, retrain, evaluate
3. **Baseline demo:** Write [frontend/demo-baseline.html](frontend/demo-baseline.html) with timer and side-by-side comparison
4. **Results report:** Create [docs/RESULTS.md](docs/RESULTS.md) with KPI measurements
5. **Demo rehearsal:** Practice full end-to-end flow (deaf user → official → response → deaf user sees reply)

**Priority:** MEDIUM (this is final presentation work)

**Estimated effort:** 2–3 weeks (All, heavy data collection focus)

---

## Summary Table: Completion by Phase

| Phase | Name | Target | Status | % Complete | Blocker? |
|-------|------|--------|--------|------------|----------|
| 1 | Data Acquisition | Wks 1–2 | ✅ Done | 100% | No |
| 2 | Dataset Creation | Wks 2–3 | 🟡 Partial | 60% | **YES** → Phase 3 |
| 3 | BiLSTM Training | Wks 4–6 | 🔴 Not Started | 0% | **YES** → Phases 4–8 |
| 4 | TensorFlow.js Conversion | Wk 6 | 🔴 Not Started | 0% | **YES** → Phases 5–8 |
| 5 | Spring Boot + Gemini | Wk 7 | 🟡 Partial | 40% | **YES** → Phases 6–8 |
| 6 | Speech-to-Text | Wk 8 | 🔴 Not Started | 0% | No → Phase 7 |
| 7 | Integration & Testing | Wk 9 | 🔴 Not Started | 0% | No |
| 8 | Scaling & Polish | Wk 10 | 🔴 Not Started | 0% | No |

---

## Critical Path & Recommendations

### Immediate Actions (This Week)
1. **Phase 2 Data Collection:** Record baseline 3-word + negative class dataset
   - Assign: All 4 team members
   - Deliverable: ~120 sequences (3 words × 4 people × ~10 sequences each as starter)
   - Timeline: 2–3 days
2. **Phase 3 Model Training:** Write and test training pipeline
   - Assign: ML owner
   - Deliverable: Trained `.h5` model + confusion matrix
   - Timeline: 3–5 days after dataset is ready

### Next 2 Weeks
3. **Phase 4 TensorFlow.js:** Convert model and integrate into frontend
   - Assign: Frontend/ML owner (pair programming)
   - Timeline: 3–5 days after Phase 3
4. **Phase 5 Gemini Integration:** Wire WebSocket → Gemini → response
   - Assign: Backend owner
   - Timeline: Parallel with Phase 4, 5–7 days

### Weeks 3–4
5. **Phase 6 Speech-to-Text:** Implement bidirectional feedback
   - Assign: Frontend owner
   - Timeline: 5–7 days
6. **Phase 7 Integration:** Full end-to-end test, fallback logic, KPI logging
   - Assign: All (Frontend lead)
   - Timeline: 5–7 days

### Week 5 (Demo Prep)
7. **Phase 8 Scaling & Polish:** Record full 40+ sign dataset, retrain, finalize demo
   - Assign: All (heavy on data collection)
   - Timeline: Entire week

---

## Effort Estimate (Remaining Work)

| Phase | Work | Owner | Days | Notes |
|-------|------|-------|------|-------|
| 2 | Data recording (3-word baseline) | All | 3 | Parallel |
| 3 | BiLSTM training script + training | ML | 10 | Sequential after data ready |
| 4 | TensorFlow.js conversion + integration | Frontend/ML | 5 | After Phase 3 |
| 5 | Gemini API integration | Backend | 7 | Can start after Phase 2 data exists |
| 6 | Speech-to-Text | Frontend | 5 | After Phase 5 WebSocket stable |
| 7 | Integration + fallback + KPI logging | All | 7 | After Phases 4–6 |
| 8 | 40+ sign dataset + retraining + demo | All | 10 | Heavy data collection + final tuning |
| **Total** | | | **~47 days effort** | Parallelizable to ~3 weeks wall time |

---

## Risk Flags

- 🚩 **Phase 2 incomplete:** No real data = Phase 3 cannot start
- 🚩 **Phase 3 not started:** Longest timeline (10+ days); critical path blocker
- 🚩 **No baseline comparison:** Cannot make latency/accuracy claims without timed baseline (manual typing)
- 🚩 **Gemini API cost:** Untested; budget for API calls during testing (free tier ~60 RPM limit)
- 🚩 **40+ sign ambition:** Doable but tight timeline; prioritize 10–15 signs if time is scarce

---

## Deliverables Still Needed

| Item | Phase | Status | Owner |
|------|-------|--------|-------|
| Baseline dataset (3 words + negative) | 2 | 📝 To do | All |
| Trained BiLSTM model | 3 | 📝 To do | ML |
| Confusion matrix + accuracy report | 3 | 📝 To do | ML |
| `model.json` + weights (TensorFlow.js) | 4 | 📝 To do | ML |
| In-browser inference latency <50ms | 4 | 📝 To do | Frontend |
| WebSocket keyword send from frontend | 5 | 📝 To do | Frontend |
| Gemini sentence generation service | 5 | 📝 To do | Backend |
| Context generation time <5s | 5 | 📝 To do | Backend |
| Speech-to-Text integration | 6 | 📝 To do | Frontend |
| Bidirectional response time measured | 6 | 📝 To do | Frontend/Backend |
| Fallback state machine (confidence <60%) | 7 | 📝 To do | Frontend |
| Full KPI logging framework | 7 | 📝 To do | All |
| Two-client demo (deaf user + official) | 7 | 📝 To do | All |
| 40+ sign dataset | 8 | 📝 To do | All |
| Retrained model on full dataset | 8 | 📝 To do | ML |
| Baseline timing demo | 8 | 📝 To do | Frontend |
| Final results report (KPIs vs H1–H5) | 8 | 📝 To do | All |
| Demo rehearsal + presentation slides | 8 | 📝 To do | All |

---

## Next Steps

1. **This meeting:** Align on Phase 2 data collection sprint (who records what, when)
2. **By end of week:** Have 100+ labeled landmark sequences in `data-collection/dataset/raw/`
3. **Week 2:** ML owner starts Phase 3 training script + training run
4. **Week 3:** Frontend/ML convert and integrate TensorFlow.js
5. **Ongoing:** Backend owner works Phase 5 Gemini integration in parallel
6. **Weekly:** Team syncs to log progress against this roadmap

---

*Report prepared for ISL Translator capstone project. Questions? Review [Implementation_Roadmap.md](../prototype/extra/ISL_Project_Implementation_Roadmap.md) in full.*
