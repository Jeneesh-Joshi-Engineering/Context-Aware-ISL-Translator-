import {
  FilesetResolver,
  HandLandmarker,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs";
import {
  FRAME_VECTOR_LENGTH,
  HAND_VECTOR_LENGTH,
  normalizeAndFlattenLandmarks,
} from "./normalize.js";

export const HAND_CONNECTIONS = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [0, 17],
];

export const HAND_COLORS = {
  Left: "#6ce5ff",
  Right: "#ff8fd3",
};

const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";

export async function createHandLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(WASM_URL);

  try {
    return {
      instance: await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_URL,
          delegate: "GPU",
        },
        runningMode: "video",
        numHands: 2,
      }),
      delegate: "GPU",
    };
  } catch (gpuError) {
    return {
      instance: await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_URL,
          delegate: "CPU",
        },
        runningMode: "video",
        numHands: 2,
      }),
      delegate: "CPU",
      gpuError,
    };
  }
}

export function interpretHandLandmarkerResult(result) {
  const frameVector = new Array(FRAME_VECTOR_LENGTH).fill(0);
  const slots = [null, null];
  const visibleHands = [];

  const landmarksList = result?.landmarks ?? [];
  const handednessList = result?.handedness ?? [];

  for (let detectionIndex = 0; detectionIndex < landmarksList.length; detectionIndex += 1) {
    const rawLandmarks = landmarksList[detectionIndex];
    if (!Array.isArray(rawLandmarks) || rawLandmarks.length !== 21) {
      continue;
    }

    const handedness = normalizeHandednessLabel(handednessList[detectionIndex]?.[0]?.categoryName);
    const slotIndex = pickSlotIndex(handedness, slots);
    if (slotIndex === -1) {
      continue;
    }

    slots[slotIndex] = handedness;
    const normalizedVector = normalizeAndFlattenLandmarks(rawLandmarks);
    const baseIndex = slotIndex * HAND_VECTOR_LENGTH;

    for (let i = 0; i < HAND_VECTOR_LENGTH; i += 1) {
      frameVector[baseIndex + i] = normalizedVector[i];
    }

    visibleHands.push({
      handedness,
      slotIndex,
      landmarks: rawLandmarks,
    });
  }

  return {
    frameVector,
    handednessSlots: slots.filter(Boolean),
    visibleHands,
  };
}

export function isHandLandmarksResult(result) {
  return Boolean(result && Array.isArray(result.landmarks));
}

function pickSlotIndex(handedness, slots) {
  if (handedness === "Left" && slots[0] == null) {
    return 0;
  }

  if (handedness === "Right" && slots[1] == null) {
    return 1;
  }

  if (slots[0] == null) {
    return 0;
  }

  if (slots[1] == null) {
    return 1;
  }

  return -1;
}

function normalizeHandednessLabel(label) {
  const normalized = String(label || "").toLowerCase();
  if (normalized.includes("left")) {
    return "Left";
  }
  if (normalized.includes("right")) {
    return "Right";
  }
  return "Unknown";
}

export function drawHandOverlay(ctx, visibleHands, canvasWidth, canvasHeight) {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  for (const hand of visibleHands) {
    const color = HAND_COLORS[hand.handedness] || "#ffffff";
    drawHand(ctx, hand.landmarks, color, canvasWidth, canvasHeight);
  }
}

function drawHand(ctx, landmarks, color, canvasWidth, canvasHeight) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const [start, end] of HAND_CONNECTIONS) {
    const startPoint = landmarks[start];
    const endPoint = landmarks[end];
    ctx.beginPath();
    ctx.moveTo(startPoint.x * canvasWidth, startPoint.y * canvasHeight);
    ctx.lineTo(endPoint.x * canvasWidth, endPoint.y * canvasHeight);
    ctx.stroke();
  }

  for (let landmarkIndex = 0; landmarkIndex < landmarks.length; landmarkIndex += 1) {
    const point = landmarks[landmarkIndex];
    const x = point.x * canvasWidth;
    const y = point.y * canvasHeight;
    ctx.beginPath();
    ctx.arc(x, y, landmarkIndex === 0 ? 5.5 : 4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
