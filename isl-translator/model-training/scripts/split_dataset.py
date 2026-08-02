from __future__ import annotations

from dataclasses import dataclass
import json
import logging
from pathlib import Path
from typing import Any

import numpy as np
from sklearn.model_selection import StratifiedShuffleSplit
from sklearn.preprocessing import LabelEncoder


@dataclass(frozen=True)
class SplitResult:
    train: list[dict[str, Any]]
    val: list[dict[str, Any]]
    test: list[dict[str, Any]]
    label_encoder: dict[str, Any]


def split_sequences(
    sequences: list[dict[str, Any]],
    split_ratio: tuple[float, float, float] = (0.7, 0.15, 0.15),
    random_state: int = 42,
) -> SplitResult:
    if not np.isclose(sum(split_ratio), 1.0):
        raise ValueError("Split ratios must sum to 1.0.")

    if not sequences:
        raise ValueError("No sequences available for splitting.")

    groups = build_groups(sequences)
    group_labels = [group["label"] for group in groups]
    group_members = [group["source_member"] for group in groups]

    train_groups, val_groups, test_groups = stratified_group_split(
        groups,
        group_labels,
        split_ratio,
        random_state,
    )

    maybe_warn_on_member_balance("train", train_groups, group_members)
    maybe_warn_on_member_balance("val", val_groups, group_members)
    maybe_warn_on_member_balance("test", test_groups, group_members)

    label_encoder = LabelEncoder()
    label_encoder.fit([sequence["label"] for sequence in sequences])
    encoder_payload = build_label_encoder_payload(label_encoder)

    return SplitResult(
        train=expand_groups(train_groups),
        val=expand_groups(val_groups),
        test=expand_groups(test_groups),
        label_encoder=encoder_payload,
    )


def build_groups(sequences: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[str, dict[str, Any]] = {}

    for sequence in sequences:
        origin_id = sequence.get("origin_id") or sequence.get("sequence_id")
        if origin_id is None:
            raise ValueError("Each sequence must have an origin_id or sequence_id.")

        grouped.setdefault(
            origin_id,
            {
                "origin_id": origin_id,
                "label": sequence["label"],
                "source_member": sequence.get("source_member", ""),
                "sequences": [],
            },
        )["sequences"].append(sequence)

    return list(grouped.values())


def stratified_group_split(
    groups: list[dict[str, Any]],
    group_labels: list[str],
    split_ratio: tuple[float, float, float],
    random_state: int,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    train_ratio, val_ratio, test_ratio = split_ratio
    group_indices = np.arange(len(groups))

    train_indices, temp_indices = next(
        StratifiedShuffleSplit(
            n_splits=1,
            test_size=val_ratio + test_ratio,
            random_state=random_state,
        ).split(group_indices, group_labels)
    )

    temp_labels = [group_labels[index] for index in temp_indices]
    temp_ratio = val_ratio + test_ratio
    if temp_ratio <= 0:
        raise ValueError("Validation and test ratios must sum to more than zero.")

    relative_test_ratio = test_ratio / temp_ratio
    val_indices, test_indices = next(
        StratifiedShuffleSplit(
            n_splits=1,
            test_size=relative_test_ratio,
            random_state=random_state,
        ).split(np.arange(len(temp_indices)), temp_labels)
    )

    train_groups = [groups[index] for index in train_indices]
    val_groups = [groups[temp_indices[index]] for index in val_indices]
    test_groups = [groups[temp_indices[index]] for index in test_indices]
    return train_groups, val_groups, test_groups


def maybe_warn_on_member_balance(split_name: str, groups: list[dict[str, Any]], all_members: list[str]) -> None:
    if not groups:
        return

    split_members = [group["source_member"] for group in groups]
    counts = {member: split_members.count(member) for member in set(all_members)}
    if not counts:
        return

    dominant_share = max(counts.values()) / max(1, len(split_members))
    if dominant_share > 0.8:
        logging.warning(
            "%s split is dominated by one member (%.0f%%); stratification by person may not be feasible.",
            split_name,
            dominant_share * 100,
        )


def expand_groups(groups: list[dict[str, Any]]) -> list[dict[str, Any]]:
    expanded: list[dict[str, Any]] = []
    for group in groups:
        expanded.extend(group["sequences"])
    return expanded


def sequences_to_numpy(
    sequences: list[dict[str, Any]],
    label_encoder: LabelEncoder,
) -> tuple[np.ndarray, np.ndarray]:
    if not sequences:
        return np.empty((0, 30, 126), dtype=np.float32), np.empty((0,), dtype=np.int64)

    frames = np.asarray([sequence["frames"] for sequence in sequences], dtype=np.float32)
    labels = label_encoder.transform([sequence["label"] for sequence in sequences]).astype(np.int64)
    return frames.astype(np.float32), labels


def build_label_encoder_payload(label_encoder: LabelEncoder) -> dict[str, Any]:
    index_to_label = {str(index): label for index, label in enumerate(label_encoder.classes_.tolist())}
    label_to_index = {label: index for index, label in enumerate(label_encoder.classes_.tolist())}
    return {
        "classes": label_encoder.classes_.tolist(),
        "index_to_label": index_to_label,
        "label_to_index": label_to_index,
    }


def save_label_encoder(label_encoder_payload: dict[str, Any], output_path: str | Path) -> None:
    with Path(output_path).open("w", encoding="utf-8") as handle:
        json.dump(label_encoder_payload, handle, indent=2)
