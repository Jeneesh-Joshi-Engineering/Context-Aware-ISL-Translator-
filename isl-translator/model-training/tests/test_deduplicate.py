from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

SCRIPT_DIR = Path(__file__).resolve().parents[1] / "scripts"
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from deduplicate import are_near_duplicates, deduplicate_sequences


def build_sequence(label: str, frames: np.ndarray, sequence_id: str) -> dict:
    return {
        "label": label,
        "timestamp": "2026-08-01T10:15:00Z",
        "handedness": ["Right"],
        "frames": frames.tolist(),
        "sequence_id": sequence_id,
        "origin_id": sequence_id,
        "source_file": "tester_session1.json",
    }


def test_deduplicate_removes_near_duplicate_pair():
    base = np.zeros((30, 126), dtype=np.float32)
    near_duplicate = base + 0.001
    sequences = [
        build_sequence("Help", base, "a"),
        build_sequence("Help", near_duplicate, "b"),
    ]

    result = deduplicate_sequences(sequences, similarity_threshold=0.01, quantize_decimals=3)
    assert len(result.kept_sequences) == 1
    assert len(result.removed_sequences) == 1
    assert result.removed_sequences[0]["kept_sequence_id"] == "a"


def test_deduplicate_keeps_distinct_sequences():
    first = np.zeros((30, 126), dtype=np.float32)
    second = np.ones((30, 126), dtype=np.float32)

    assert are_near_duplicates(first, second, similarity_threshold=0.01, quantize_decimals=3) is False

    sequences = [
        build_sequence("Help", first, "a"),
        build_sequence("Help", second, "b"),
    ]
    result = deduplicate_sequences(sequences, similarity_threshold=0.01, quantize_decimals=3)
    assert len(result.kept_sequences) == 2
    assert len(result.removed_sequences) == 0

