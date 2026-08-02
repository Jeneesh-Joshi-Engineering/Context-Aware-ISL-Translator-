import { startCamera, describeCameraError } from "./camera.js";
import {
  createHandLandmarker,
  drawHandOverlay,
  interpretHandLandmarkerResult,
  isHandLandmarksResult,
} from "./landmarker.js";
import { createRecorder, DEFAULT_RECORDING_DURATION_MS } from "./recorder.js";
import { exportDatasetAsCsv, exportDatasetAsJson } from "./exporter.js";

const elements = {
  video: document.getElementById("video"),
  overlay: document.getElementById("overlay"),
  cameraStatus: document.getElementById("cameraStatus"),
  modelStatus: document.getElementById("modelStatus"),
  fpsCounter: document.getElementById("fpsCounter"),
  recordDot: document.getElementById("recordDot"),
  recordState: document.getElementById("recordState"),
  recordTimer: document.getElementById("recordTimer"),
  labelInput: document.getElementById("labelInput"),
  durationInput: document.getElementById("durationInput"),
  recordButton: document.getElementById("recordButton"),
  discardButton: document.getElementById("discardButton"),
  exportJsonButton: document.getElementById("exportJsonButton"),
  exportCsvButton: document.getElementById("exportCsvButton"),
  clearButton: document.getElementById("clearButton"),
  sequenceCounter: document.getElementById("sequenceCounter"),
  errorBox: document.getElementById("errorBox"),
  cameraHint: document.getElementById("cameraHint"),
};

const fpsSamples = [];
const fpsWindowSize = 30;

const recorder = createRecorder({
  durationMs: DEFAULT_RECORDING_DURATION_MS,
  onStateChange: syncRecorderState,
});

const appState = {
  stream: null,
  landmarker: null,
  ready: false,
  lastFrameTime: performance.now(),
  currentCanvasWidth: 0,
  currentCanvasHeight: 0,
  overlayContext: null,
};

bindUI();
boot();

function bindUI() {
  elements.recordButton.addEventListener("click", () => toggleRecording());
  elements.discardButton.addEventListener("click", discardLastSequence);
  elements.exportJsonButton.addEventListener("click", () => exportDataset("json"));
  elements.exportCsvButton.addEventListener("click", () => exportDataset("csv"));
  elements.clearButton.addEventListener("click", clearAllSequences);
  elements.durationInput.addEventListener("change", handleDurationChange);
  elements.labelInput.addEventListener("input", syncCounters);
  window.addEventListener("keydown", handleKeyboardShortcut);
  window.addEventListener("beforeunload", cleanup);
  window.addEventListener("resize", syncCanvasSize);
  elements.video.addEventListener("loadedmetadata", syncCanvasSize);
}

async function boot() {
  setStatus(elements.cameraStatus, "Starting camera...");
  setStatus(elements.modelStatus, "Loading model...");
  clearError();

  try {
    appState.stream = await startCamera(elements.video);
    setStatus(elements.cameraStatus, "Camera active");
    elements.cameraHint.hidden = true;
    await syncCanvasSize();
  } catch (error) {
    showError(describeCameraError(error));
    setStatus(elements.cameraStatus, "Camera unavailable");
    return;
  }

  try {
    const { instance, delegate, gpuError } = await createHandLandmarker();
    appState.landmarker = instance;
    setStatus(elements.modelStatus, `Model ready (${delegate})`);
    if (gpuError) {
      console.warn("GPU delegate failed, fell back to CPU.", gpuError);
    }
  } catch (error) {
    showError(`Hand landmark model failed to load: ${error.message || error}`);
    setStatus(elements.modelStatus, "Model unavailable");
    return;
  }

  appState.ready = true;
  appState.overlayContext = elements.overlay.getContext("2d");
  syncCounters();
  requestAnimationFrame(processFrame);
}

async function processFrame(now) {
  if (!appState.ready) {
    return;
  }

  const elapsed = now - appState.lastFrameTime;
  appState.lastFrameTime = now;
  updateFps(elapsed);

  if (elements.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && appState.landmarker) {
    try {
      const result = appState.landmarker.detectForVideo(elements.video, performance.now());
      if (isHandLandmarksResult(result)) {
        const observation = interpretHandLandmarkerResult(result);
        resizeOverlayToVideo();
        drawHandOverlay(
          appState.overlayContext,
          observation.visibleHands,
          elements.overlay.width,
          elements.overlay.height
        );
        if (recorder.getState().isRecording) {
          recorder.recordFrame(observation.frameVector, observation.handednessSlots);
        }
      }
    } catch (error) {
      showError(`Landmark detection failed: ${error.message || error}`);
    }
  }

  syncRecorderHud();
  requestAnimationFrame(processFrame);
}

function toggleRecording() {
  const label = getLabel();
  const durationMs = getDurationMs();
  if (!label) {
    showError("Please enter a label before recording.");
    return;
  }

  clearError();
  recorder.toggle(label, durationMs);
  syncCounters();
  syncRecorderHud();
}

function handleDurationChange() {
  const durationMs = getDurationMs();
  recorder.setDuration(durationMs);
  syncRecorderHud();
}

function handleKeyboardShortcut(event) {
  const isTypingField =
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLTextAreaElement ||
    event.target instanceof HTMLSelectElement ||
    event.target?.isContentEditable;

  if (isTypingField || event.code !== "Space") {
    return;
  }

  event.preventDefault();
  toggleRecording();
}

function discardLastSequence() {
  recorder.discardLastSequence();
  syncCounters();
}

function clearAllSequences() {
  const confirmed = window.confirm("Clear all recorded sequences from this session?");
  if (!confirmed) {
    return;
  }

  recorder.clearAll();
  syncCounters();
}

function exportDataset(format) {
  const sequences = recorder.getSequences();
  if (!sequences.length) {
    showError("No sequences have been recorded yet.");
    return;
  }

  clearError();
  if (format === "csv") {
    exportDatasetAsCsv(sequences);
    return;
  }

  exportDatasetAsJson(sequences);
}

function syncRecorderState() {
  syncCounters();
  syncRecorderHud();
}

function syncCounters() {
  const label = getLabel();
  const count = label ? recorder.getSequenceCountForLabel(label) : 0;
  elements.sequenceCounter.textContent = `Recorded ${count} sequences for label: ${label || "n/a"}`;
}

function syncRecorderHud() {
  const state = recorder.getState();
  elements.overlay.classList.toggle("recording", state.isRecording);
  elements.recordButton.textContent = state.isRecording ? "Stop Recording" : "Start Recording";
  elements.recordState.textContent = state.isRecording
    ? `Recording ${getLabel() || state.recordingLabel}`
    : "Not recording";
  elements.recordTimer.textContent = state.isRecording ? formatRemaining() : "00:00.0";
  elements.recordDot.style.background = state.isRecording ? "var(--danger)" : "rgba(255, 255, 255, 0.3)";
}

function formatRemaining() {
  const totalMs = Math.max(0, recorder.getRemainingMs());
  const seconds = Math.floor(totalMs / 1000);
  const tenths = Math.floor((totalMs % 1000) / 100);
  return `${seconds}.${tenths}s`;
}

function updateFps(deltaMs) {
  if (deltaMs <= 0) {
    return;
  }

  fpsSamples.push(1000 / deltaMs);
  while (fpsSamples.length > fpsWindowSize) {
    fpsSamples.shift();
  }

  const fps = fpsSamples.reduce((sum, value) => sum + value, 0) / fpsSamples.length;
  elements.fpsCounter.textContent = `${fps.toFixed(1)} FPS`;
}

function syncCanvasSize() {
  const width = elements.video.videoWidth || 640;
  const height = elements.video.videoHeight || 480;
  if (width === appState.currentCanvasWidth && height === appState.currentCanvasHeight) {
    return;
  }

  appState.currentCanvasWidth = width;
  appState.currentCanvasHeight = height;
  elements.overlay.width = width;
  elements.overlay.height = height;
}

function resizeOverlayToVideo() {
  if (elements.overlay.width !== elements.video.videoWidth || elements.overlay.height !== elements.video.videoHeight) {
    elements.overlay.width = elements.video.videoWidth || 640;
    elements.overlay.height = elements.video.videoHeight || 480;
  }
}

function getLabel() {
  return elements.labelInput.value.trim();
}

function getDurationMs() {
  const parsed = Number(elements.durationInput.value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_RECORDING_DURATION_MS;
}

function setStatus(element, text) {
  element.textContent = text;
}

function showError(message) {
  elements.errorBox.textContent = message;
  elements.errorBox.hidden = false;
}

function clearError() {
  elements.errorBox.textContent = "";
  elements.errorBox.hidden = true;
}

function cleanup() {
  if (appState.stream) {
    for (const track of appState.stream.getTracks()) {
      track.stop();
    }
  }
}
