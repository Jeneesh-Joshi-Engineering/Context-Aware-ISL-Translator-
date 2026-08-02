from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
import json
import math
from pathlib import Path
from typing import Any

import numpy as np

EXPECTED_SEQUENCE_LENGTH = 30
EXPECTED_VECTOR_LENGTH = 126
ALLOWED_HANDEDNESS = {"Left", "Right"}
RAW_SEQUENCE_KEYS = {"label", "timestamp", "handedness", "frames"}
DISALLOWED_MEDIA_KEYS = {
    "image",
    "images",
    "video",
    "frame_data",
    "raw_frame",
    "raw_frames",
    "pixel_data",
    "canvas",
    "base64",
    "snapshot",
}


@dataclass(frozen=True)
class ValidationResult:
    valid_sequences: list[dict[str, Any]]
    rejected_sequences: list[dict[str, Any]]
    source_file: str

    @property
    def valid_count(self) -> int:
        return len(self.valid_sequences)

    @property
    def rejected_count(self) -> int:
        return len(self.rejected_sequences)


def load_json_file(file_path: str | Path) -> Any:
    with Path(file_path).open("r", encoding="utf-8") as handle:
        return json.load(handle)


def validate_raw_export_file(
    file_path: str | Path,
    allowed_labels: set[str],
) -> ValidationResult:
    source_path = Path(file_path)
    source_name = source_path.name

    try:
        payload = load_json_file(source_path)
    except json.JSONDecodeError as error:
        return ValidationResult(
            valid_sequences=[],
            rejected_sequences=[
                build_rejection_record(
                    raw_sequence=None,
                    reason=f"File is not valid JSON: {error.msg}",
                    source_file=source_name,
                    source_index=None,
                )
            ],
            source_file=source_name,
        )

    if not isinstance(payload, list):
        return ValidationResult(
            valid_sequences=[],
            rejected_sequences=[
                build_rejection_record(
                    raw_sequence=payload,
                    reason="Top-level JSON payload must be a list of sequences.",
                    source_file=source_name,
                    source_index=None,
                )
            ],
            source_file=source_name,
        )

    valid_sequences: list[dict[str, Any]] = []
    rejected_sequences: list[dict[str, Any]] = []

    for sequence_index, raw_sequence in enumerate(payload):
        normalized, rejection_reason = validate_sequence(raw_sequence, allowed_labels)
        if rejection_reason is not None:
            rejected_sequences.append(
                build_rejection_record(
                    raw_sequence=raw_sequence,
                    reason=rejection_reason,
                    source_file=source_name,
                    source_index=sequence_index,
                )
            )
            continue

        normalized["source_file"] = source_name
        normalized["source_index"] = sequence_index
        valid_sequences.append(normalized)

    return ValidationResult(
        valid_sequences=valid_sequences,
        rejected_sequences=rejected_sequences,
        source_file=source_name,
    )


def validate_sequence(
    raw_sequence: Any,
    allowed_labels: set[str],
) -> tuple[dict[str, Any] | None, str | None]:
    if not isinstance(raw_sequence, dict):
        return None, "Sequence must be an object/dictionary."

    unexpected_keys = set(raw_sequence) - RAW_SEQUENCE_KEYS
    if unexpected_keys:
        if unexpected_keys & DISALLOWED_MEDIA_KEYS:
            return None, f"Sequence contains forbidden media field(s): {sorted(unexpected_keys & DISALLOWED_MEDIA_KEYS)}."
        return None, f"Sequence contains unexpected field(s): {sorted(unexpected_keys)}."

    missing_keys = RAW_SEQUENCE_KEYS - set(raw_sequence)
    if missing_keys:
        return None, f"Sequence missing required field(s): {sorted(missing_keys)}."

    label = raw_sequence.get("label")
    if not isinstance(label, str) or not label.strip():
        return None, "Label must be a non-empty string."

    normalized_label = label.strip()
    if normalized_label not in allowed_labels:
        return None, f"Label '{normalized_label}' is not in the allowed label list."

    timestamp = raw_sequence.get("timestamp")
    if not is_valid_iso8601_timestamp(timestamp):
        return None, "Timestamp is not valid ISO 8601."

    handedness = raw_sequence.get("handedness")
    if not isinstance(handedness, list) or not handedness:
        return None, "Handedness must be a non-empty list."

    normalized_handedness: list[str] = []
    for value in handedness:
        if not isinstance(value, str):
            return None, "Handedness entries must be strings."
        cleaned = value.strip()
        if cleaned not in ALLOWED_HANDEDNESS:
            return None, f"Handedness value '{cleaned}' is invalid."
        normalized_handedness.append(cleaned)

    frames = raw_sequence.get("frames")
    if not isinstance(frames, list) or len(frames) != EXPECTED_SEQUENCE_LENGTH:
        return None, f"Frames must contain exactly {EXPECTED_SEQUENCE_LENGTH} frames."

    normalized_frames: list[list[float]] = []
    for frame_index, frame in enumerate(frames):
        if not isinstance(frame, list) or len(frame) != EXPECTED_VECTOR_LENGTH:
            return None, f"Frame {frame_index} must contain exactly {EXPECTED_VECTOR_LENGTH} numeric values."

        normalized_frame: list[float] = []
        for value_index, value in enumerate(frame):
            numeric_value = coerce_numeric(value)
            if numeric_value is None:
                return None, f"Frame {frame_index} contains a non-numeric or invalid value at index {value_index}."
            normalized_frame.append(numeric_value)
        normalized_frames.append(normalized_frame)

    normalized_sequence = {
        "label": normalized_label,
        "timestamp": timestamp,
        "handedness": normalized_handedness,
        "frames": normalized_frames,
    }
    return normalized_sequence, None


def build_rejection_record(
    raw_sequence: Any,
    reason: str,
    source_file: str,
    source_index: int | None,
) -> dict[str, Any]:
    return {
        "source_file": source_file,
        "source_index": source_index,
        "reason": reason,
        "sequence": raw_sequence,
    }


def is_valid_iso8601_timestamp(value: Any) -> bool:
    if not isinstance(value, str) or not value.strip():
        return False

    timestamp_text = value.strip().replace("Z", "+00:00")
    try:
        datetime.fromisoformat(timestamp_text)
    except ValueError:
        return False
    return True


def coerce_numeric(value: Any) -> float | None:
    if isinstance(value, bool):
        return None

    if isinstance(value, (int, float, np.integer, np.floating)):
        numeric_value = float(value)
        if math.isnan(numeric_value) or math.isinf(numeric_value):
            return None
        return numeric_value

    return None

