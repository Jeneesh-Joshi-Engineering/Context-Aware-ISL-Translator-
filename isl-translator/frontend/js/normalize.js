export const LANDMARKS_PER_HAND = 21;
export const COORDS_PER_LANDMARK = 3;
export const HAND_VECTOR_LENGTH = LANDMARKS_PER_HAND * COORDS_PER_LANDMARK;
export const HAND_SLOT_COUNT = 2;
export const FRAME_VECTOR_LENGTH = HAND_VECTOR_LENGTH * HAND_SLOT_COUNT;
export const FIXED_SEQUENCE_LENGTH = 30;

/*
  MediaPipe hand landmark indices:
  0 = wrist
  1-4 = thumb
  5-8 = index finger
  9-12 = middle finger
  13-16 = ring finger
  17-20 = pinky
*/

export function normalizeLandmarks(landmarks) {
  if (!Array.isArray(landmarks) || landmarks.length !== LANDMARKS_PER_HAND) {
    throw new Error(`Expected ${LANDMARKS_PER_HAND} hand landmarks.`);
  }

  const wrist = landmarks[0];
  const middleMcp = landmarks[9];
  const referenceDistance = Math.max(distance3D(wrist, middleMcp), 1e-6);

  return landmarks.map((landmark) => ({
    x: (landmark.x - wrist.x) / referenceDistance,
    y: (landmark.y - wrist.y) / referenceDistance,
    z: (landmark.z - wrist.z) / referenceDistance,
  }));
}

export function flattenLandmarks(landmarks) {
  const flat = new Array(HAND_VECTOR_LENGTH);
  let index = 0;

  for (const landmark of landmarks) {
    flat[index++] = landmark.x;
    flat[index++] = landmark.y;
    flat[index++] = landmark.z;
  }

  return flat;
}

export function normalizeAndFlattenLandmarks(landmarks) {
  return flattenLandmarks(normalizeLandmarks(landmarks));
}

export function createZeroHandVector() {
  return new Array(HAND_VECTOR_LENGTH).fill(0);
}

function distance3D(pointA, pointB) {
  const dx = pointA.x - pointB.x;
  const dy = pointA.y - pointB.y;
  const dz = pointA.z - pointB.z;
  return Math.hypot(dx, dy, dz);
}
