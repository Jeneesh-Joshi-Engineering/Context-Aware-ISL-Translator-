import {
  COORDS_PER_LANDMARK,
  FIXED_SEQUENCE_LENGTH,
  FRAME_VECTOR_LENGTH,
  HAND_SLOT_COUNT,
  LANDMARKS_PER_HAND,
} from "./normalize.js";

export function exportDatasetAsJson(sequences) {
  const payload = {
    schema: "isl.data-acquisition.v1",
    exportedAt: new Date().toISOString(),
    sequenceCount: sequences.length,
    targetFrameCount: FIXED_SEQUENCE_LENGTH,
    frameVectorLength: FRAME_VECTOR_LENGTH,
    sequences,
  };

  downloadTextFile(
    `isl_dataset_${timestampForFilename()}.json`,
    JSON.stringify(payload, null, 2),
    "application/json"
  );
}

export function exportDatasetAsCsv(sequences) {
  const headers = [
    "sequence_id",
    "label",
    "frame_index",
    ...buildCoordinateHeaders(),
    "handedness1",
    "handedness2",
  ];

  const lines = [headers.join(",")];

  sequences.forEach((sequence, sequenceIndex) => {
    sequence.frames.forEach((frame, frameIndex) => {
      const row = [
        sequenceIndex,
        csvEscape(sequence.label),
        frameIndex,
        ...frame.map((value) => formatNumber(value)),
        csvEscape(sequence.handedness?.[0] ?? ""),
        csvEscape(sequence.handedness?.[1] ?? ""),
      ];

      lines.push(row.join(","));
    });
  });

  downloadTextFile(
    `isl_dataset_${timestampForFilename()}.csv`,
    lines.join("\n"),
    "text/csv"
  );
}

function buildCoordinateHeaders() {
  const headers = [];

  for (let handIndex = 1; handIndex <= HAND_SLOT_COUNT; handIndex += 1) {
    for (let landmarkIndex = 0; landmarkIndex < LANDMARKS_PER_HAND; landmarkIndex += 1) {
      for (const coord of ["x", "y", "z"].slice(0, COORDS_PER_LANDMARK)) {
        headers.push(`hand${handIndex}_${coord}${landmarkIndex}`);
      }
    }
  }

  return headers;
}

function downloadTextFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvEscape(value) {
  const stringValue = String(value ?? "");
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }
  return stringValue;
}

function formatNumber(value) {
  return Number.isFinite(value) ? Number(value).toFixed(6) : "0";
}

function timestampForFilename() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}
