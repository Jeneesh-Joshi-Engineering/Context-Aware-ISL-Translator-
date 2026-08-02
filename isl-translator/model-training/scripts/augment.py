from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np

EXPECTED_SEQUENCE_LENGTH = 30
EXPECTED_VECTOR_LENGTH = 126
HAND_VECTOR_LENGTH = 63


@dataclass(frozen=True)
class AugmentationResult:
    frames: np.ndarray
    handedness: list[str] | None = None


def augment_jitter(
    frames: Any,
    std_dev: float = 0.01,
    rng: np.random.Generator | None = None,
) -> np.ndarray:
    rng = rng or np.random.default_rng()
    array = ensure_frame_array(frames)
    noisy = array + rng.normal(0.0, std_dev, size=array.shape).astype(np.float32)
    return sanitize_frame_array(noisy)


def augment_timewarp(
    frames: Any,
    warp_factor: float | None = None,
    rng: np.random.Generator | None = None,
) -> np.ndarray:
    rng = rng or np.random.default_rng()
    array = ensure_frame_array(frames)
    factor = warp_factor if warp_factor is not None else float(rng.uniform(0.9, 1.1))
    positions = np.linspace(0.0, EXPECTED_SEQUENCE_LENGTH - 1, EXPECTED_SEQUENCE_LENGTH, dtype=np.float32)
    midpoint = (EXPECTED_SEQUENCE_LENGTH - 1) / 2.0
    warped_positions = midpoint + (positions - midpoint) * factor
    warped_positions = np.clip(warped_positions, 0.0, EXPECTED_SEQUENCE_LENGTH - 1)
    warped = interpolate_sequence(array, warped_positions)
    return sanitize_frame_array(warped)


def augment_mirror(sequence: dict[str, Any]) -> dict[str, Any]:
    frames = ensure_frame_array(sequence["frames"])
    reshaped = frames.reshape(EXPECTED_SEQUENCE_LENGTH, 2, 21, 3)
    mirrored = reshaped.copy()
    mirrored[..., 0] = -mirrored[..., 0]
    mirrored = mirrored[:, ::-1, :, :]

    handedness = list(sequence.get("handedness", []))
    mirrored_handedness = [swap_handedness(value) for value in handedness[::-1]]
    if len(mirrored_handedness) == 1:
        mirrored_handedness = mirrored_handedness[:1]

    mirrored_sequence = dict(sequence)
    mirrored_sequence["frames"] = sanitize_frame_array(mirrored.reshape(EXPECTED_SEQUENCE_LENGTH, EXPECTED_VECTOR_LENGTH))
    mirrored_sequence["handedness"] = mirrored_handedness
    mirrored_sequence["synthetic"] = True
    mirrored_sequence["augmentation"] = "mirror"
    mirrored_sequence["augmentation_origin_id"] = sequence.get("origin_id") or sequence.get("sequence_id")
    return mirrored_sequence


def apply_augmentations(
    sequence: dict[str, Any],
    augment_types: list[str],
    copies_per_sequence: int,
    rng: np.random.Generator | None = None,
) -> list[dict[str, Any]]:
    if copies_per_sequence <= 0 or not augment_types:
        return []

    rng = rng or np.random.default_rng()
    augmented_sequences: list[dict[str, Any]] = []

    for copy_index in range(copies_per_sequence):
        current_frames = ensure_frame_array(sequence["frames"])
        current_sequence = dict(sequence)
        current_sequence["synthetic"] = True
        current_sequence["augmentation_origin_id"] = sequence.get("origin_id") or sequence.get("sequence_id")
        augmentation_steps: list[str] = []

        for augmentation_name in augment_types:
            if augmentation_name == "jitter":
                current_frames = augment_jitter(current_frames, rng=rng)
                augmentation_steps.append("jitter")
            elif augmentation_name == "timewarp":
                current_frames = augment_timewarp(current_frames, rng=rng)
                augmentation_steps.append("timewarp")
            elif augmentation_name == "mirror":
                mirrored_sequence = augment_mirror({**current_sequence, "frames": current_frames})
                current_frames = ensure_frame_array(mirrored_sequence["frames"])
                current_sequence["handedness"] = mirrored_sequence["handedness"]
                augmentation_steps.append("mirror")
            else:
                raise ValueError(f"Unsupported augmentation type: {augmentation_name}")

        current_sequence["frames"] = sanitize_frame_array(current_frames)
        current_sequence["synthetic"] = True
        current_sequence["augmentation"] = "+".join(augmentation_steps)
        current_sequence["augmentation_copy_index"] = copy_index
        current_sequence["sequence_id"] = build_augmented_sequence_id(sequence, copy_index, augmentation_steps)
        current_sequence["origin_id"] = sequence.get("origin_id") or sequence.get("sequence_id")
        augmented_sequences.append(current_sequence)

    return augmented_sequences


def ensure_frame_array(frames: Any) -> np.ndarray:
    array = np.asarray(frames, dtype=np.float32)
    if array.shape != (EXPECTED_SEQUENCE_LENGTH, EXPECTED_VECTOR_LENGTH):
        raise ValueError("Frames must have shape (30, 126).")
    return array


def sanitize_frame_array(array: np.ndarray) -> np.ndarray:
    sanitized = np.nan_to_num(array.astype(np.float32), nan=0.0, posinf=0.0, neginf=0.0)
    return sanitized.reshape(EXPECTED_SEQUENCE_LENGTH, EXPECTED_VECTOR_LENGTH)


def interpolate_sequence(array: np.ndarray, warped_positions: np.ndarray) -> np.ndarray:
    original_positions = np.arange(EXPECTED_SEQUENCE_LENGTH, dtype=np.float32)
    output = np.empty((EXPECTED_SEQUENCE_LENGTH, EXPECTED_VECTOR_LENGTH), dtype=np.float32)

    for column_index in range(EXPECTED_VECTOR_LENGTH):
        column = array[:, column_index]
        output[:, column_index] = np.interp(warped_positions, original_positions, column)

    return output


def swap_handedness(value: str) -> str:
    if value == "Left":
        return "Right"
    if value == "Right":
        return "Left"
    return value


def build_augmented_sequence_id(
    sequence: dict[str, Any],
    copy_index: int,
    augmentation_steps: list[str],
) -> str:
    import hashlib
    import json

    digest = hashlib.sha1()
    digest.update(str(sequence.get("sequence_id", "")).encode("utf-8"))
    digest.update(str(copy_index).encode("utf-8"))
    digest.update(json.dumps(augmentation_steps, sort_keys=True).encode("utf-8"))
    return digest.hexdigest()

