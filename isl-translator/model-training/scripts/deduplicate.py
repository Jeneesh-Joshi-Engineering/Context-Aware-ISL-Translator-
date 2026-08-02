from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
from typing import Any

import numpy as np


@dataclass(frozen=True)
class DeduplicationResult:
    kept_sequences: list[dict[str, Any]]
    removed_sequences: list[dict[str, Any]]


def deduplicate_sequences(
    sequences: list[dict[str, Any]],
    similarity_threshold: float = 0.015,
    quantize_decimals: int = 2,
) -> DeduplicationResult:
    kept_sequences: list[dict[str, Any]] = []
    removed_sequences: list[dict[str, Any]] = []
    representatives_by_label: dict[str, list[dict[str, Any]]] = {}

    for sequence in sequences:
        label = sequence["label"]
        label_representatives = representatives_by_label.setdefault(label, [])
        duplicate_of = None

        for representative in label_representatives:
            if are_near_duplicates(
                sequence["frames"],
                representative["frames"],
                similarity_threshold=similarity_threshold,
                quantize_decimals=quantize_decimals,
            ):
                duplicate_of = representative
                break

        if duplicate_of is None:
            kept_sequences.append(sequence)
            label_representatives.append(sequence)
            continue

        removed_sequences.append(
            {
                "label": label,
                "reason": "near-duplicate sequence removed",
                "removed_sequence_id": sequence.get("sequence_id"),
                "removed_source_file": sequence.get("source_file"),
                "removed_timestamp": sequence.get("timestamp"),
                "kept_sequence_id": duplicate_of.get("sequence_id"),
                "kept_source_file": duplicate_of.get("source_file"),
                "kept_timestamp": duplicate_of.get("timestamp"),
            }
        )

    return DeduplicationResult(
        kept_sequences=kept_sequences,
        removed_sequences=removed_sequences,
    )


def are_near_duplicates(
    frames_a: Any,
    frames_b: Any,
    similarity_threshold: float = 0.015,
    quantize_decimals: int = 2,
) -> bool:
    array_a = np.asarray(frames_a, dtype=np.float32)
    array_b = np.asarray(frames_b, dtype=np.float32)
    if array_a.shape != array_b.shape:
        return False

    signature_a = quantized_signature(array_a, quantize_decimals)
    signature_b = quantized_signature(array_b, quantize_decimals)
    if signature_a == signature_b:
        return True

    mean_absolute_difference = float(np.mean(np.abs(array_a - array_b)))
    return mean_absolute_difference <= similarity_threshold


def quantized_signature(array: np.ndarray, quantize_decimals: int) -> str:
    quantized = np.round(array, decimals=quantize_decimals)
    payload = quantized.astype(np.float32).tobytes()
    return hashlib.sha1(payload).hexdigest()

