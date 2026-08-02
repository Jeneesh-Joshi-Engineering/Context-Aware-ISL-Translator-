import { FIXED_SEQUENCE_LENGTH, FRAME_VECTOR_LENGTH } from "./normalize.js";

export const DEFAULT_RECORDING_DURATION_MS = 2000;

export function createRecorder({
  targetFrameCount = FIXED_SEQUENCE_LENGTH,
  durationMs = DEFAULT_RECORDING_DURATION_MS,
  onStateChange = () => {},
} = {}) {
  const sequences = [];
  let isRecording = false;
  let recordingLabel = "";
  let recordingStartedAt = 0;
  let stopTimerId = null;
  let activeFrames = [];
  let activeHandedness = new Set();

  function notify() {
    onStateChange(getState());
  }

  function getState() {
    return {
      isRecording,
      recordingLabel,
      recordingStartedAt,
      durationMs,
      frameCount: activeFrames.length,
      sequences,
      targetFrameCount,
    };
  }

  function setDuration(nextDurationMs) {
    durationMs = nextDurationMs;
    notify();
  }

  function start(label, requestedDurationMs = durationMs) {
    const cleanLabel = String(label || "").trim();
    if (!cleanLabel || isRecording) {
      return false;
    }

    clearTimeout(stopTimerId);
    isRecording = true;
    recordingLabel = cleanLabel;
    recordingStartedAt = performance.now();
    activeFrames = [];
    activeHandedness = new Set();
    durationMs = requestedDurationMs;
    stopTimerId = setTimeout(() => {
      stop("timeout");
    }, durationMs);
    notify();
    return true;
  }

  function stop(reason = "manual") {
    if (!isRecording) {
      return null;
    }

    clearTimeout(stopTimerId);
    stopTimerId = null;
    isRecording = false;

    const finalizedFrames = finalizeFrames(activeFrames, targetFrameCount);
    const sequence = finalizedFrames.length
      ? {
          label: recordingLabel,
          timestamp: new Date().toISOString(),
          handedness: canonicalHandednessOrder.filter((handedness) => activeHandedness.has(handedness)),
          frames: finalizedFrames,
        }
      : null;

    if (sequence) {
      sequences.push(sequence);
    }

    recordingLabel = "";
    recordingStartedAt = 0;
    activeFrames = [];
    activeHandedness = new Set();
    notify();
    return sequence;
  }

  function toggle(label, requestedDurationMs = durationMs) {
    if (isRecording) {
      return stop("manual");
    }

    return start(label, requestedDurationMs);
  }

  function recordFrame(frameVector, handednessSlots) {
    if (!isRecording) {
      return;
    }

    const frame = Array.isArray(frameVector) && frameVector.length === FRAME_VECTOR_LENGTH
      ? frameVector.slice()
      : createEmptyFrame();
    activeFrames.push(frame);
    if (Array.isArray(handednessSlots)) {
      for (const handedness of handednessSlots) {
        activeHandedness.add(handedness);
      }
    }
    notify();
  }

  function discardLastSequence() {
    const removed = sequences.pop() ?? null;
    notify();
    return removed;
  }

  function clearAll() {
    sequences.length = 0;
    notify();
  }

  function getSequenceCountForLabel(label) {
    const cleanLabel = String(label || "").trim();
    return sequences.filter((sequence) => sequence.label === cleanLabel).length;
  }

  function getElapsedMs(now = performance.now()) {
    if (!isRecording) {
      return 0;
    }
    return now - recordingStartedAt;
  }

  function getRemainingMs(now = performance.now()) {
    if (!isRecording) {
      return 0;
    }
    return Math.max(0, durationMs - getElapsedMs(now));
  }

  function getSequences() {
    return sequences.slice();
  }

  function createEmptyFrame() {
    return new Array(FRAME_VECTOR_LENGTH).fill(0);
  }

  return {
    start,
    stop,
    toggle,
    recordFrame,
    discardLastSequence,
    clearAll,
    setDuration,
    getSequences,
    getSequenceCountForLabel,
    getElapsedMs,
    getRemainingMs,
    getState,
  };
}

function finalizeFrames(frames, targetFrameCount) {
  if (!frames.length) {
    return [];
  }

  if (frames.length === targetFrameCount) {
    return frames.map((frame) => frame.slice());
  }

  if (frames.length < targetFrameCount) {
    const padded = frames.map((frame) => frame.slice());
    const lastFrame = padded[padded.length - 1];
    while (padded.length < targetFrameCount) {
      padded.push(lastFrame.slice());
    }
    return padded;
  }

  if (targetFrameCount === 1) {
    return [frames[0].slice()];
  }

  const sampled = [];
  const lastIndex = frames.length - 1;
  const step = lastIndex / (targetFrameCount - 1);

  for (let i = 0; i < targetFrameCount; i += 1) {
    const sourceIndex = Math.round(i * step);
    sampled.push(frames[sourceIndex].slice());
  }

  return sampled;
}

const canonicalHandednessOrder = ["Left", "Right"];
