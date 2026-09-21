// TensorFlow.js rolling-window classifier for normalized landmark frames.
import { FIXED_SEQUENCE_LENGTH, FRAME_VECTOR_LENGTH } from "./normalize.js";
import { logKpi } from "./kpiLogger.js";

const MODEL_URL = new URL("../model/model.json", import.meta.url).href;
const METADATA_URL = new URL("../model/model_metadata.json", import.meta.url).href;
const LABEL_ENCODER_URL = new URL("../model/label_encoder.json", import.meta.url).href;
const DEFAULT_CONFIDENCE_THRESHOLD = 0.6;
const INFERENCE_EVERY_NTH_FRAME = 3;
const REQUIRED_STABLE_PREDICTIONS = 2;

export async function createInference({
  onPrediction = () => {},
  onLowConfidence = () => {},
  onNoGesture = () => {},
  onLatency = () => {},
  onScores = () => {},
  onError = () => {},
} = {}) {
  if (!globalThis.tf) throw new Error("TensorFlow.js is missing. Run npm run assets, then restart the server.");
  await tf.ready();
  // Layers format preserves the trained BiLSTM without SavedModel control-flow incompatibilities.
  const [model, encoder] = await Promise.all([
    tf.loadLayersModel(MODEL_URL),
    loadEncoder(),
  ]);

  const labels = labelsFromEncoder(encoder);
  validateModelContract(model, encoder, labels);
  const confidenceThreshold = validThreshold(encoder.confidence_threshold);

  // Compile GPU shaders before announcing readiness, so the first live sign does not stall.
  const warmInput = tf.zeros([1, FIXED_SEQUENCE_LENGTH, FRAME_VECTOR_LENGTH]);
  let warmOutput;
  try { warmOutput = model.predict(warmInput); await singleOutputTensor(warmOutput).data(); }
  catch (error) { model.dispose(); throw error; }
  finally { warmInput.dispose(); disposeResult(warmOutput); }



  const frames = [];
  const latencies = [];
  let ticks = 0;
  let inferenceInFlight = false;
  let candidateLabel = null;
  let candidateCount = 0;
  let lastEmittedLabel = null;
  let disposed = false;
  let disposePending = false;

  return {
    labels,
    confidenceThreshold,
    predictSequence: classify,
    reset() { frames.length = 0; resetCandidate(); lastEmittedLabel = null; },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (inferenceInFlight) disposePending = true;
      else model.dispose();
    },
    pushFrame(frame) {
      if (disposed) return;
      if (!Array.isArray(frame) || frame.length !== FRAME_VECTOR_LENGTH) {
        console.warn("Ignoring an invalid landmark frame for inference.");
        return;
      }

      frames.push(frame);
      if (frames.length > FIXED_SEQUENCE_LENGTH) frames.shift();
      if (
        frames.length < FIXED_SEQUENCE_LENGTH ||
        ++ticks % INFERENCE_EVERY_NTH_FRAME ||
        inferenceInFlight
      ) return;

      inferenceInFlight = true;
      return classify([...frames])
        .then(({ label, confidence, latencyMs }) => {
          if (disposed) return;
          onScores({ label, confidence, latencyMs });
          latencies.push(latencyMs);
          if (latencies.length > 20) latencies.shift();
          const averageLatency = latencies.reduce((sum, value) => sum + value, 0) / latencies.length;
          onLatency(averageLatency);

          if (confidence < confidenceThreshold) {
            resetCandidate();
            onLowConfidence(confidence);
            return;
          }

          // No_Gesture is an intentional idle class, never a backend keyword.
          if (label === "No_Gesture") {
            resetCandidate();
            lastEmittedLabel = null;
            onNoGesture({ label, confidence, latencyMs });
            return;
          }

          if (label === candidateLabel) candidateCount += 1;
          else {
            candidateLabel = label;
            candidateCount = 1;
          }

          // One held sign produces one keyword. A new command must be classified
          // stably before it can be sent; No_Gesture arms the same sign again.
          if (candidateCount < REQUIRED_STABLE_PREDICTIONS || label === lastEmittedLabel) return;

          lastEmittedLabel = label;
          resetCandidate();
          logKpi("prediction", { label, confidence, latencyMs });
          onPrediction({ label, confidence, latencyMs });
        })
        .catch((error) => {
          resetCandidate();
          console.error("ISL model inference failed:", error);
          onError(error);
        })
        .finally(() => {
          inferenceInFlight = false;
          if (disposePending) { model.dispose(); disposePending = false; }
        });
    },
  };

  function resetCandidate() {
    candidateLabel = null;
    candidateCount = 0;
  }

  async function classify(sequence) {
    if (disposed) throw new Error("Model has been disposed");
    if (sequence.length !== FIXED_SEQUENCE_LENGTH || sequence.some(frame => frame.length !== FRAME_VECTOR_LENGTH || frame.some(x => !Number.isFinite(x))))
      throw new Error("Expected 30 frames of 126 finite landmark coordinates.");
    const start = performance.now();
    const input = tf.tensor([sequence], [1, FIXED_SEQUENCE_LENGTH, FRAME_VECTOR_LENGTH], "float32");
    let result;

    try {
      result = model.predict(input);
      const output = singleOutputTensor(result);
      const scores = Array.from(await output.data());
      if (scores.length !== labels.length || scores.some(score => !Number.isFinite(score))) throw new Error("Model output does not match the four-class vocabulary.");
      const index = argmax(scores);
      return { label: labels[index], confidence: scores[index], scores, latencyMs: performance.now() - start };
    } finally {
      input.dispose();
      disposeResult(result);
    }
  }
}

async function loadEncoder() {
  try {
    return await fetchJson(METADATA_URL);
  } catch {
    return fetchJson(LABEL_ENCODER_URL);
  }
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url}: HTTP ${response.status}`);
  return response.json();
}

function labelsFromEncoder(encoder) {
  if (Array.isArray(encoder.output_classes)) return validateLabels([...encoder.output_classes]);
  if (Array.isArray(encoder.classes)) return validateLabels([...encoder.classes]);
  const mapping = encoder.label_mapping || encoder.label_to_index;
  if (!mapping || typeof mapping !== "object") {
    throw new Error("Model metadata must contain output_classes, classes, or label_mapping.");
  }
  const labels = [];
  for (const [label, index] of Object.entries(mapping)) {
    if (!Number.isInteger(index) || index < 0 || labels[index] !== undefined) {
      throw new Error("Model label_mapping is invalid.");
    }
    labels[index] = label;
  }
  if (labels.length === 0 || labels.some((label) => typeof label !== "string")) {
    throw new Error("Model label_mapping must contain contiguous numeric indices.");
  }
  return validateLabels(labels);
}

function validateModelContract(model, encoder, labels) {
  const inputShape = model.inputs?.[0]?.shape;
  if (!inputShape || inputShape.length !== 3 ||
      inputShape[1] !== FIXED_SEQUENCE_LENGTH || inputShape[2] !== FRAME_VECTOR_LENGTH) {
    throw new Error(`Model input must be [batch, ${FIXED_SEQUENCE_LENGTH}, ${FRAME_VECTOR_LENGTH}].`);
  }
  if (Number.isInteger(encoder.num_classes) && encoder.num_classes !== labels.length) {
    throw new Error("Model metadata class count does not match its label mapping.");
  }
  const mapping = encoder.label_mapping || encoder.label_to_index;
  if (mapping && labels.some((label, index) => mapping[label] !== index)) {
    throw new Error("Model metadata class order does not match its label mapping.");
  }
}

function validateLabels(labels) {
  if (labels.length === 0 || labels.some((label) => typeof label !== "string" || !label.trim()) ||
      new Set(labels).size !== labels.length) {
    throw new Error("Model class labels must be unique, non-empty strings.");
  }
  return labels;
}

function validThreshold(value) {
  return Number.isFinite(value) && value > 0 && value <= 1 ? value : DEFAULT_CONFIDENCE_THRESHOLD;
}

function singleOutputTensor(result) {
  if (result instanceof tf.Tensor) return result;
  if (Array.isArray(result) && result.length === 1 && result[0] instanceof tf.Tensor) return result[0];
  if (result && typeof result === "object") {
    const tensors = Object.values(result);
    if (tensors.length === 1 && tensors[0] instanceof tf.Tensor) return tensors[0];
  }
  throw new Error("Expected the graph model to produce exactly one prediction tensor.");
}

function disposeResult(result) {
  const tensors = result instanceof tf.Tensor ? [result] :
    Array.isArray(result) ? result : result && typeof result === "object" ? Object.values(result) : [];
  for (const tensor of new Set(tensors)) {
    if (tensor instanceof tf.Tensor) tensor.dispose();
  }
}

function argmax(values) {
  return values.reduce((bestIndex, value, index) => value > values[bestIndex] ? index : bestIndex, 0);
}
