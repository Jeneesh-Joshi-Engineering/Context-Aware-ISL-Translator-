"""Legacy data-loading helpers.

Keep this file only as an archive reference; the organized pipeline lives under
`model-training/`.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable

import numpy as np
from sklearn.model_selection import train_test_split

from config import PipelineConfig


def _load_sequence(path: Path) -> np.ndarray:
    """Read a 2-D [frames, features] .npy or JSON sequence."""
    if path.suffix.lower() == ".npy":
        array = np.load(path)
    elif path.suffix.lower() == ".json":
        array = np.asarray(json.loads(path.read_text(encoding="utf-8")), dtype=np.float32)
    else:
        raise ValueError(f"Unsupported sample format: {path}")
    if array.ndim != 2:
        raise ValueError(f"{path} must be a [frames, features] array, got {array.shape}")
    return array.astype(np.float32)


def load_dataset(source: str | Path, sequence_column: str = "sequence_path", label_column: str = "label") -> tuple[list[np.ndarray], np.ndarray]:
    """Load a dataset from either supported layout.

    Folder layout: ``root/<class_name>/<sample>.npy`` (or ``.json``).  Index layout:
    a CSV/Parquet file with ``label`` and ``sequence_path`` columns; relative paths are
    resolved from the index file's directory. Each sequence is a [frames, features] array.
    """
    source = Path(source)
    sequences: list[np.ndarray] = []
    labels: list[str] = []
    if source.is_dir():
        for class_dir in sorted(p for p in source.iterdir() if p.is_dir()):
            for sample in sorted(list(class_dir.glob("*.npy")) + list(class_dir.glob("*.json"))):
                sequences.append(_load_sequence(sample))
                labels.append(class_dir.name)
    elif source.suffix.lower() in {".csv", ".parquet", ".pq"}:
        import pandas as pd
        table = pd.read_csv(source) if source.suffix.lower() == ".csv" else pd.read_parquet(source)
        missing = {sequence_column, label_column} - set(table.columns)
        if missing:
            raise ValueError(f"Index is missing columns: {sorted(missing)}")
        for _, row in table.iterrows():
            path = Path(row[sequence_column])
            sequences.append(_load_sequence(path if path.is_absolute() else source.parent / path))
            labels.append(str(row[label_column]))
    else:
        raise ValueError("source must be a folder or a .csv/.parquet index")
    if not sequences:
        raise ValueError(f"No supported landmark sequences found in {source}")
    return sequences, np.asarray(labels, dtype=str)


def normalize_landmarks(sequence: np.ndarray, config: PipelineConfig) -> np.ndarray:
    """Make each frame wrist-relative, which makes recognition translation-invariant.

    The wrist is subtracted independently for every frame (not once per recording), so
    changes in signer/camera position do not become a gesture feature. Optional scale
    normalization improves size invariance but can amplify noise when the reference joint
    is occluded. For multiple hands, each configured hand is normalized to its own wrist.
    """
    sequence = np.asarray(sequence, dtype=np.float32)
    if sequence.ndim != 2 or sequence.shape[1] != config.num_features:
        raise ValueError(f"Expected [frames, {config.num_features}], got {sequence.shape}")
    if config.num_features % 3:
        raise ValueError("num_features must be divisible by 3 for xyz landmark normalization")
    points = sequence.reshape(sequence.shape[0], -1, 3).copy()
    total_landmarks = points.shape[1]
    if config.hands * config.landmarks_per_hand > total_landmarks:
        raise ValueError("hands * landmarks_per_hand exceeds available landmarks")
    for hand in range(config.hands):
        start = hand * config.landmarks_per_hand
        stop = start + config.landmarks_per_hand
        wrist = start + config.wrist_index
        reference = start + config.scale_reference_index
        if not (start <= wrist < stop and start <= reference < stop):
            raise ValueError("wrist/reference index must be within each hand")
        origin = points[:, wrist:wrist + 1, :].copy()
        points[:, start:stop, :] -= origin
        if config.normalize_scale:
            distance = np.linalg.norm(points[:, reference, :], axis=1)
            scale = np.maximum(distance, config.scale_epsilon)[:, None, None]
            points[:, start:stop, :] /= scale
    return points.reshape(sequence.shape)


def preprocess_sequence(sequence: np.ndarray, config: PipelineConfig) -> np.ndarray:
    """Apply wrist-relative normalization then deterministic zero padding/truncation."""
    normalized = normalize_landmarks(sequence, config)
    if normalized.shape[0] > config.max_frames:
        normalized = normalized[:config.max_frames] if config.truncating == "post" else normalized[-config.max_frames:]
    result = np.zeros((config.max_frames, config.num_features), dtype=np.float32)
    if config.padding == "post":
        result[: len(normalized)] = normalized
    elif config.padding == "pre":
        result[-len(normalized):] = normalized
    else:
        raise ValueError("padding must be 'pre' or 'post'")
    return result


def preprocess_dataset(sequences: Iterable[np.ndarray], config: PipelineConfig) -> np.ndarray:
    return np.stack([preprocess_sequence(s, config) for s in sequences])


def encode_labels(labels: np.ndarray) -> tuple[np.ndarray, dict[str, int]]:
    classes = sorted(set(labels.tolist()))
    mapping = {label: i for i, label in enumerate(classes)}
    indices = np.asarray([mapping[label] for label in labels])
    return np.eye(len(classes), dtype=np.float32)[indices], mapping


def split_dataset(X: np.ndarray, labels: np.ndarray, config: PipelineConfig):
    """Return stratified 70/15/15 splits, refusing datasets too small to stratify."""
    counts = {name: int((labels == name).sum()) for name in sorted(set(labels.tolist()))}
    insufficient = {k: v for k, v in counts.items() if v < 3}
    if insufficient:
        raise ValueError(f"At least 3 samples per class are needed for stratified splits: {insufficient}")
    indices = np.arange(len(labels))
    train_val, test = train_test_split(indices, test_size=0.15, stratify=labels, random_state=config.random_seed)
    train, val = train_test_split(train_val, test_size=0.15 / 0.85, stratify=labels[train_val], random_state=config.random_seed)
    return train, val, test


def split_distribution(labels: np.ndarray, indices: np.ndarray) -> dict[str, int]:
    return {label: int((labels[indices] == label).sum()) for label in sorted(set(labels.tolist()))}


def generate_synthetic_dataset(output_dir: str | Path, config: PipelineConfig, samples_per_class: int = 30) -> Path:
    """Create an intentionally learnable variable-length folder dataset for smoke testing."""
    root = Path(output_dir)
    rng = np.random.default_rng(config.random_seed)
    classes = ["hello", "thanks", "yes"]
    for class_index, label in enumerate(classes):
        folder = root / label
        folder.mkdir(parents=True, exist_ok=True)
        for sample_id in range(samples_per_class):
            frames = int(rng.integers(16, config.max_frames + 12))
            seq = rng.normal(0, 0.025, (frames, config.num_features)).astype(np.float32)
            # Give each class a different smooth relative landmark trajectory.
            t = np.linspace(0, 1, frames, dtype=np.float32)
            points = seq.reshape(frames, -1, 3)
            points[:, :, 0] += (class_index - 1) * 0.45 + np.sin(t[:, None] * np.pi * (class_index + 1)) * 0.08
            points[:, :, 1] += class_index * 0.20 + t[:, None] * (class_index - 1) * 0.25
            points[:, 0, :] += rng.uniform(-1, 1, (frames, 3))  # translation to be removed
            np.save(folder / f"{label}_{sample_id:03d}.npy", seq)
    return root
