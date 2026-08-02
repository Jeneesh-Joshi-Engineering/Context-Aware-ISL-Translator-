from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

SCRIPT_DIR = Path(__file__).resolve().parents[1] / "scripts"
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from schema_validator import EXPECTED_SEQUENCE_LENGTH, EXPECTED_VECTOR_LENGTH, validate_raw_export_file, validate_sequence


ALLOWED_LABELS = {"Hello", "Help", "Emergency", "No_Gesture"}


def build_valid_sequence() -> dict:
    frames = np.zeros((EXPECTED_SEQUENCE_LENGTH, EXPECTED_VECTOR_LENGTH), dtype=float).tolist()
    return {
        "label": "Help",
        "timestamp": "2026-08-01T10:15:00Z",
        "handedness": ["Right"],
        "frames": frames,
    }


def test_validate_sequence_accepts_valid_record():
    sequence, reason = validate_sequence(build_valid_sequence(), ALLOWED_LABELS)
    assert reason is None
    assert sequence is not None
    assert sequence["label"] == "Help"
    assert len(sequence["frames"]) == EXPECTED_SEQUENCE_LENGTH


def test_validate_sequence_rejects_invalid_label():
    sequence = build_valid_sequence()
    sequence["label"] = "Hlep"

    normalized, reason = validate_sequence(sequence, ALLOWED_LABELS)
    assert normalized is None
    assert "allowed label list" in reason


def test_validate_sequence_rejects_wrong_frame_count():
    sequence = build_valid_sequence()
    sequence["frames"] = sequence["frames"][:-1]

    normalized, reason = validate_sequence(sequence, ALLOWED_LABELS)
    assert normalized is None
    assert "exactly 30 frames" in reason


def test_validate_sequence_rejects_wrong_vector_length():
    sequence = build_valid_sequence()
    sequence["frames"][0] = sequence["frames"][0][:-1]

    normalized, reason = validate_sequence(sequence, ALLOWED_LABELS)
    assert normalized is None
    assert "exactly 126 numeric values" in reason


def test_validate_sequence_rejects_non_numeric_values():
    sequence = build_valid_sequence()
    sequence["frames"][0][0] = "oops"

    normalized, reason = validate_sequence(sequence, ALLOWED_LABELS)
    assert normalized is None
    assert "non-numeric" in reason


def test_validate_raw_export_file_rejects_non_array_payload(tmp_path):
    file_path = tmp_path / "bad.json"
    file_path.write_text(json.dumps({"label": "Help"}), encoding="utf-8")

    result = validate_raw_export_file(file_path, ALLOWED_LABELS)
    assert result.valid_count == 0
    assert result.rejected_count == 1
    assert "Top-level JSON payload must be a list" in result.rejected_sequences[0]["reason"]

