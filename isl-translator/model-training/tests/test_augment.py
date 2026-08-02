from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

SCRIPT_DIR = Path(__file__).resolve().parents[1] / "scripts"
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from augment import augment_jitter, augment_mirror, augment_timewarp


def build_frames() -> np.ndarray:
    values = np.linspace(-1.0, 1.0, 30 * 126, dtype=np.float32)
    return values.reshape(30, 126)


def test_jitter_preserves_shape_and_finite_values():
    frames = build_frames()
    augmented = augment_jitter(frames, std_dev=0.005, rng=np.random.default_rng(123))
    assert augmented.shape == (30, 126)
    assert np.isfinite(augmented).all()


def test_timewarp_preserves_shape_and_finite_values():
    frames = build_frames()
    augmented = augment_timewarp(frames, warp_factor=1.05, rng=np.random.default_rng(123))
    assert augmented.shape == (30, 126)
    assert np.isfinite(augmented).all()


def test_mirror_preserves_shape_and_swaps_handedness():
    frames = build_frames()
    sequence = {
        "label": "Help",
        "timestamp": "2026-08-01T10:15:00Z",
        "handedness": ["Left", "Right"],
        "frames": frames,
        "origin_id": "abc",
        "sequence_id": "abc",
    }

    mirrored = augment_mirror(sequence)
    assert mirrored["frames"].shape == (30, 126)
    assert np.isfinite(mirrored["frames"]).all()
    assert mirrored["handedness"] == ["Left", "Right"]
    assert mirrored["synthetic"] is True

