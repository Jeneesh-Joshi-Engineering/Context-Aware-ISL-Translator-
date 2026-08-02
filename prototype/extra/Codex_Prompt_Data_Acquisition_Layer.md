# Codex Prompt — Data Acquisition Layer (ISL Translation System)

Copy everything below the line into Codex as a single prompt.

---

## Project Context

I am building the **Data Acquisition Layer** for a real-time Indian Sign Language (ISL) translation system. This is the *first* of four layers in a larger architecture (Data Acquisition → Intelligent Processing/BiLSTM → Contextual Generation/LLM → Bidirectional Feedback). Your job is ONLY the Data Acquisition Layer — a browser-based module that captures webcam video, extracts hand skeletal landmarks in real time using MediaPipe, visualizes them, and records labeled landmark sequences to build a training dataset. **No other layer should be built or referenced.**

This is a client-side-only, privacy-first system: **raw video frames must never be stored, transmitted, or persisted anywhere.** Only numeric landmark coordinates may leave the capture step. This is a hard architectural constraint, not a preference — treat any violation of it as a bug.

## Tech Stack (use exactly this)

- Plain HTML5, CSS3, vanilla JavaScript (ES modules) — no React/Vue/frontend framework, no build tooling (no Webpack/Vite) for this layer. It must run by simply opening `index.html` or serving the folder with a static server.
- **MediaPipe Tasks Vision API** (`@mediapipe/tasks-vision`), specifically the **HandLandmarker** task, loaded via CDN (jsDelivr or unpkg). Do not use the older deprecated `@mediapipe/hands` package — use the current Tasks API.
- Native browser APIs only otherwise: `navigator.mediaDevices.getUserMedia`, `<canvas>` 2D context, `Blob`/`URL.createObjectURL` for file downloads.

## Folder Structure to Create

```
frontend/
├── index.html
├── style.css
├── js/
│   ├── camera.js          # webcam init + video element wiring
│   ├── landmarker.js       # MediaPipe HandLandmarker setup + inference loop
│   ├── normalize.js        # landmark preprocessing/normalization functions
│   ├── recorder.js         # sequence buffering, recording state machine
│   ├── exporter.js         # dataset export to JSON/CSV + download
│   └── main.js              # wires everything together, app entry point
└── dataset/                 # (empty folder, exported files land here manually after download)
```

Keep each file focused on a single responsibility per the names above — do not put everything in one giant script.

## Functional Requirements

### 1. Camera & Video Feed
- Request webcam access via `getUserMedia({ video: { width: 640, height: 480 } })`.
- Display the live feed in a `<video>` element (muted, autoplay, playsinline).
- Handle and clearly display permission-denial or no-camera-found errors in the UI (not just `console.error`) — this must be user-visible.

### 2. Hand Landmark Detection
- Initialize MediaPipe's `HandLandmarker` in **VIDEO** running mode (not IMAGE mode — this matters for performance) with:
  - `numHands: 2`
  - GPU delegate if available, fall back to CPU delegate gracefully if GPU init fails.
- Run detection on every animation frame using `requestAnimationFrame`, calling `detectForVideo(videoElement, timestamp)`.
- For each detected hand, extract **21 landmarks × (x, y, z)** = 63 numbers per hand. Support up to 2 hands (126 numbers total). If a hand is not present in a frame, its 63 values should be filled with `0` (not omitted) — the output vector length per frame must always be constant (126 numbers) regardless of how many hands are visible, so downstream sequence models get fixed-shape input.
- Also determine and store **handedness** (Left/Right) per detected hand from the model output, since it may matter for later sign disambiguation.

### 3. Visualization (sanity-check layer)
- Overlay a `<canvas>` on top of the video element, same dimensions, positioned absolutely.
- On every frame, draw the detected landmarks as dots and connect them with lines following MediaPipe's standard 21-point hand connection topology (wrist → fingers). Use two distinct colors for left vs. right hand.
- Display a live FPS counter on screen (rolling average over the last ~30 frames) — this is a hard requirement, since Translation Latency is a KPI for the overall project and this layer needs to be independently measurable.

### 4. Landmark Normalization
- Implement a `normalizeLandmarks(landmarks)` function in `normalize.js`:
  - Translate all points so the **wrist landmark (index 0) is the origin** (subtract wrist x/y/z from every point in that hand). This makes the representation invariant to where the hand is positioned in the frame.
  - Scale-normalize by dividing by a consistent reference distance (e.g., wrist-to-middle-finger-MCP distance) so the representation is invariant to how close the hand is to the camera.
  - This function must be pure (no side effects) and unit-testable in isolation from the camera/canvas code.

### 5. Recording Mode (dataset collection UI)
Build a simple control panel in the UI with:
- A text input for the **current sign label** (e.g., "Hello", "Help", "Emergency", "No_Gesture").
- A **"Start Recording"** button/keyboard shortcut (e.g., spacebar) that begins buffering normalized landmark vectors frame-by-frame into an in-memory array.
- Recording must automatically stop after a **configurable fixed duration** (default: 2 seconds) OR when the user presses the same key again — support both.
- After each recording stops, **pad or truncate** the captured sequence to a fixed length of **30 frames** (this must be a configurable constant, not hardcoded in multiple places):
  - If fewer than 30 frames were captured, pad by repeating the last frame.
  - If more than 30 frames were captured, uniformly downsample to 30 (do not just truncate from the end — sample evenly across the sequence so motion isn't lost).
- Show a running counter in the UI: "Recorded X sequences for label: {label}".
- Provide a **"Discard Last Sequence"** button in case a recording was accidental or bad.
- Include a **visible on-screen countdown/indicator** (e.g., a red dot + timer) while actively recording, so the person signing knows exactly when to start/stop the gesture.

### 6. Dataset Export
- Store every completed sequence in memory as an object:
  ```js
  {
    label: "Help",
    timestamp: "<ISO 8601 string>",
    handedness: ["Right"],           // per-hand, in same order as landmark data
    frames: [ [126 numbers], [126 numbers], ... ]  // exactly 30 arrays of 126 numbers
  }
  ```
- Provide an **"Export Dataset"** button that serializes all recorded sequences (across all labels recorded in the current session) into a single JSON file and triggers a browser download (`Blob` + `<a download>`), named `isl_dataset_<timestamp>.json`.
- Also provide a **CSV export option** as an alternative: one row per frame, with columns `sequence_id, label, frame_index, hand1_x0, hand1_y0, hand1_z0, ..., hand2_x20, hand2_y20, hand2_z20, handedness1, handedness2` — flattened, so it can be loaded directly into pandas.
- Do NOT auto-clear recorded sequences after export — allow continued recording and repeated exports in the same session, and provide a separate explicit "Clear All" button with a confirmation prompt.

### 7. Privacy Constraint (must be verifiably enforced)
- Add a code comment block at the top of `camera.js` explicitly stating that raw video frames/pixel data must never be written to disk, sent over network, or stored in any variable that outlives a single animation frame.
- The exported dataset files must contain **only numeric landmark data and metadata** — never image data, canvas snapshots, or base64-encoded frames. Please self-check your implementation against this before finishing.

## Non-Functional Requirements

- Target **≥20 FPS** sustained inference on a mid-range laptop webcam — this is a performance-sensitive layer feeding into a latency-critical system, so avoid unnecessary allocations inside the per-frame loop (e.g., don't create new arrays/objects every frame where reuse is possible).
- Code must run in current versions of Chrome and Edge at minimum (these are the primary dev/demo browsers for this project).
- No external dependencies beyond the MediaPipe Tasks Vision CDN import — keep this layer lightweight and dependency-free otherwise.
- Add clear inline comments explaining the landmark index layout (which of the 21 points is wrist, thumb tip, etc.) since teammates unfamiliar with MediaPipe will read this code.
- Include a short `README.md` inside `frontend/` explaining: how to run it (e.g., `npx serve .` or similar static server, and why `file://` won't work for camera permissions in some browsers), how to record a dataset session, and the exact JSON schema of the exported file.

## Deliverable

Produce all files listed in the folder structure above, fully working end-to-end: opening `index.html` in a browser should show the webcam feed with a live hand-landmark overlay and FPS counter, and using the recording controls should let me capture, label, and export a small landmark-sequence dataset as JSON/CSV — with zero raw video/image data ever leaving the capture step.

Do not implement any model training, classification, or backend communication — this prompt covers the Data Acquisition Layer only.
