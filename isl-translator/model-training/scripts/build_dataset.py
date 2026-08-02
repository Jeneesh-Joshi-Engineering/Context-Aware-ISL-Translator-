from __future__ import annotations

import argparse
import json
import logging
import re
import shutil
import sys
import tempfile
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np

if __package__ in (None, ""):
    SCRIPT_DIR = Path(__file__).resolve().parent
    if str(SCRIPT_DIR) not in sys.path:
        sys.path.insert(0, str(SCRIPT_DIR))

from augment import apply_augmentations
from balance_report import create_balance_report
from deduplicate import deduplicate_sequences
from merge_sessions import merge_raw_sessions
from split_dataset import (
    save_label_encoder,
    sequences_to_numpy,
    split_sequences,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build a versioned ISL landmark dataset.")
    parser.add_argument("--raw-dir", required=True, help="Directory containing raw JSON exports.")
    parser.add_argument("--labels-config", required=True, help="Path to labels.json.")
    parser.add_argument("--min-per-label", type=int, default=20, help="Minimum sequences required per label.")
    parser.add_argument("--augment", action="store_true", help="Enable data augmentation.")
    parser.add_argument("--augment-copies", type=int, default=3, help="Augmented copies to create per original sequence.")
    parser.add_argument(
        "--augment-types",
        default="jitter,timewarp,mirror",
        help="Comma-separated augmentation types: jitter,timewarp,mirror.",
    )
    parser.add_argument("--split-ratio", default="70,15,15", help="Train,val,test ratios as percentages.")
    parser.add_argument("--output-version", default=None, help="Preferred version folder name, e.g. v1.")
    parser.add_argument("--duplicate-threshold", type=float, default=0.015, help="Mean absolute difference threshold.")
    parser.add_argument("--quantize-decimals", type=int, default=2, help="Decimals for duplicate quantization hash.")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for split and augmentation.")
    return parser.parse_args()


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    args = parse_args()
    project_root = Path(__file__).resolve().parents[1]
    raw_dir = resolve_path(project_root, args.raw_dir)
    labels_config_path = resolve_path(project_root, args.labels_config)
    processed_root = project_root / "dataset" / "processed"
    processed_root.mkdir(parents=True, exist_ok=True)

    labels = load_labels_config(labels_config_path)
    split_ratio = parse_split_ratio(args.split_ratio)
    augment_types = parse_augment_types(args.augment_types)
    requested_version = normalize_version_name(args.output_version) if args.output_version else None
    final_version_name, supersedes_version = resolve_version_name(processed_root, requested_version)

    logging.info("validate -> loading raw exports")
    merge_result = merge_raw_sessions(raw_dir, set(labels))
    rejected_sequences = list(merge_result.rejected_sequences)
    valid_sequences = list(merge_result.valid_sequences)

    logging.info("merge -> %d files, %d sequences found, %d valid, %d rejected", len(merge_result.source_files), merge_result.total_sequences_found, len(valid_sequences), len(rejected_sequences))

    logging.info("dedup -> removing near duplicates")
    dedup_result = deduplicate_sequences(
        valid_sequences,
        similarity_threshold=args.duplicate_threshold,
        quantize_decimals=args.quantize_decimals,
    )
    deduped_sequences = dedup_result.kept_sequences
    logging.info("dedup -> kept %d, removed %d", len(deduped_sequences), len(dedup_result.removed_sequences))

    version_path = stage_version_directory(processed_root, final_version_name)
    try:
        logging.info("balance-check -> validating class distribution")
        balance_report = create_balance_report(
            deduped_sequences,
            version_path,
            min_per_label=args.min_per_label,
        )
        logging.info("balance-check -> passed")

        logging.info("split -> train/val/test at original-sequence level")
        split_result = split_sequences(
            deduped_sequences,
            split_ratio=split_ratio,
            random_state=args.seed,
        )

        logging.info("augment -> %s", "enabled" if args.augment else "disabled")
        train_sequences = list(split_result.train)
        if args.augment and args.augment_copies > 0 and augment_types:
            rng = np.random.default_rng(args.seed)
            augmented_train_sequences = []
            for sequence in split_result.train:
                augmented_train_sequences.extend(
                    apply_augmentations(
                        sequence,
                        augment_types=augment_types,
                        copies_per_sequence=args.augment_copies,
                        rng=rng,
                    )
                )
            train_sequences.extend(augmented_train_sequences)

        logging.info("save -> writing numpy arrays and metadata")
        save_versioned_dataset(
            version_path=version_path,
            train_sequences=train_sequences,
            val_sequences=split_result.val,
            test_sequences=split_result.test,
            label_encoder_payload=split_result.label_encoder,
            rejected_sequences=rejected_sequences,
            dedup_removed_sequences=dedup_result.removed_sequences,
            merge_result=merge_result,
            balance_report=balance_report,
            args=args,
            split_ratio=split_ratio,
            supersedes_version=supersedes_version,
        )
        finalize_version_directory(version_path, processed_root / final_version_name)
    except Exception:
        cleanup_staging(version_path)
        raise

    logging.info("report -> dataset_manifest.json and dataset_report.md complete")
    print_rejection_summary(rejected_sequences)
    logging.info("dataset build completed at %s", processed_root / final_version_name)
    return 0


def save_versioned_dataset(
    version_path: Path,
    train_sequences: list[dict[str, Any]],
    val_sequences: list[dict[str, Any]],
    test_sequences: list[dict[str, Any]],
    label_encoder_payload: dict[str, Any],
    rejected_sequences: list[dict[str, Any]],
    dedup_removed_sequences: list[dict[str, Any]],
    merge_result: Any,
    balance_report: Any,
    args: argparse.Namespace,
    split_ratio: tuple[float, float, float],
    supersedes_version: str | None,
) -> None:
    label_encoder_path = version_path / "label_encoder.json"
    save_label_encoder(label_encoder_payload, label_encoder_path)

    x_train, y_train = sequences_to_numpy(train_sequences, build_label_encoder(label_encoder_payload))
    x_val, y_val = sequences_to_numpy(val_sequences, build_label_encoder(label_encoder_payload))
    x_test, y_test = sequences_to_numpy(test_sequences, build_label_encoder(label_encoder_payload))

    np.save(version_path / "X_train.npy", x_train.astype(np.float32))
    np.save(version_path / "y_train.npy", y_train.astype(np.int64))
    np.save(version_path / "X_val.npy", x_val.astype(np.float32))
    np.save(version_path / "y_val.npy", y_val.astype(np.int64))
    np.save(version_path / "X_test.npy", x_test.astype(np.float32))
    np.save(version_path / "y_test.npy", y_test.astype(np.int64))

    rejected_path = version_path / "rejected_sequences.json"
    write_json(
        rejected_path,
        {
            "rejected_count": len(rejected_sequences),
            "rejected_by_reason": dict(Counter(entry["reason"] for entry in rejected_sequences)),
            "rejected_sequences": rejected_sequences,
        },
    )

    manifest = build_manifest(
        version_name=version_path.name,
        supersedes_version=supersedes_version,
        args=args,
        merge_result=merge_result,
        dedup_removed_sequences=dedup_removed_sequences,
        train_sequences=train_sequences,
        val_sequences=val_sequences,
        test_sequences=test_sequences,
        label_encoder_payload=label_encoder_payload,
        balance_report=balance_report,
        split_ratio=split_ratio,
        rejected_sequences=rejected_sequences,
    )
    write_json(version_path / "dataset_manifest.json", manifest)
    write_text(version_path / "dataset_report.md", build_dataset_report(manifest, balance_report.markdown))


def build_manifest(
    version_name: str,
    supersedes_version: str | None,
    args: argparse.Namespace,
    merge_result: Any,
    dedup_removed_sequences: list[dict[str, Any]],
    train_sequences: list[dict[str, Any]],
    val_sequences: list[dict[str, Any]],
    test_sequences: list[dict[str, Any]],
    label_encoder_payload: dict[str, Any],
    balance_report: Any,
    split_ratio: tuple[float, float, float],
    rejected_sequences: list[dict[str, Any]],
) -> dict[str, Any]:
    pre_dedup_count = len(merge_result.valid_sequences)
    post_dedup_count = pre_dedup_count - len(dedup_removed_sequences)
    post_augmentation_count = len(train_sequences) + len(val_sequences) + len(test_sequences)

    base_sequences = [*train_sequences, *val_sequences, *test_sequences]
    per_label_counts = dict(Counter(sequence["label"] for sequence in base_sequences))
    per_person_counts = dict(Counter(sequence.get("source_member", "") for sequence in base_sequences))

    return {
        "schema": "isl.dataset-manifest.v1",
        "dataset_version": version_name,
        "supersedes_version": supersedes_version,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "raw_source_files": merge_result.source_files,
        "counts": {
            "raw_files_processed": merge_result.total_files_processed,
            "sequences_found": merge_result.total_sequences_found,
            "valid_before_dedup": pre_dedup_count,
            "removed_as_duplicates": len(dedup_removed_sequences),
            "valid_after_dedup": post_dedup_count,
            "final_after_augmentation": post_augmentation_count,
            "rejected_invalid_schema": len(rejected_sequences),
        },
        "per_label_counts": per_label_counts,
        "per_person_counts": per_person_counts,
        "label_encoder": label_encoder_payload,
        "augmentation": {
            "enabled": bool(args.augment),
            "copies_per_sequence": int(args.augment_copies),
            "types": parse_augment_types(args.augment_types),
        },
        "duplicate_detection": {
            "similarity_threshold": args.duplicate_threshold,
            "quantize_decimals": args.quantize_decimals,
            "removed_sequences": dedup_removed_sequences,
        },
        "split_ratio": {
            "train": split_ratio[0],
            "val": split_ratio[1],
            "test": split_ratio[2],
        },
        "rejected_reasons": dict(Counter(entry["reason"] for entry in rejected_sequences)),
        "outputs": {
            "label_distribution_chart": "label_distribution.png",
            "dataset_report": "dataset_report.md",
        },
        "minimum_label_count": args.min_per_label,
    }


def build_dataset_report(manifest: dict[str, Any], balance_markdown: str) -> str:
    counts = manifest["counts"]
    lines = [
        "# ISL Dataset Build Report",
        "",
        "## Build Summary",
        "",
        f"- Dataset version: `{manifest['dataset_version']}`",
        f"- Supersedes version: `{manifest['supersedes_version'] or 'none'}`",
        f"- Created at: `{manifest['created_at']}`",
        "",
        "| Metric | Value |",
        "| --- | ---: |",
        f"| Raw files processed | {counts['raw_files_processed']} |",
        f"| Total sequences found | {counts['sequences_found']} |",
        f"| Valid before dedup | {counts['valid_before_dedup']} |",
        f"| Removed as duplicates | {counts['removed_as_duplicates']} |",
        f"| Valid after dedup | {counts['valid_after_dedup']} |",
        f"| Final after augmentation | {counts['final_after_augmentation']} |",
        f"| Invalid schema rejections | {counts['rejected_invalid_schema']} |",
        "",
        "## Raw Sources",
        "",
    ]

    for source_file in manifest["raw_source_files"]:
        lines.append(f"- `{source_file}`")

    lines.extend(
        [
            "",
            "## Augmentation",
            "",
            f"- Enabled: `{manifest['augmentation']['enabled']}`",
            f"- Copies per sequence: `{manifest['augmentation']['copies_per_sequence']}`",
            f"- Types: `{', '.join(manifest['augmentation']['types']) or 'none'}`",
            "",
            "## Split Ratio",
            "",
            f"- Train: `{manifest['split_ratio']['train']}`",
            f"- Val: `{manifest['split_ratio']['val']}`",
            f"- Test: `{manifest['split_ratio']['test']}`",
            "",
            balance_markdown,
            "",
        ]
    )
    return "\n".join(lines)


def parse_split_ratio(raw_value: str) -> tuple[float, float, float]:
    parts = [float(part.strip()) for part in raw_value.split(",")]
    if len(parts) != 3:
        raise ValueError("Split ratio must contain three comma-separated values.")
    total = sum(parts)
    if total <= 0:
        raise ValueError("Split ratio values must be positive.")
    normalized = tuple(part / total for part in parts)
    return normalized  # type: ignore[return-value]


def parse_augment_types(raw_value: str) -> list[str]:
    return [part.strip() for part in raw_value.split(",") if part.strip()]


def load_labels_config(labels_config_path: Path) -> list[str]:
    with labels_config_path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)

    if isinstance(payload, list):
        labels = [str(label).strip() for label in payload if str(label).strip()]
    elif isinstance(payload, dict) and "labels" in payload and isinstance(payload["labels"], list):
        labels = [str(label).strip() for label in payload["labels"] if str(label).strip()]
    else:
        raise ValueError("labels.json must contain a list of labels or an object with a labels list.")

    if not labels:
        raise ValueError("labels.json does not contain any labels.")
    return labels


def resolve_path(project_root: Path, raw_value: str) -> Path:
    candidate = Path(raw_value)
    if candidate.is_absolute():
        return candidate
    return (project_root / candidate).resolve()


def normalize_version_name(version_name: str) -> str:
    cleaned = version_name.strip()
    if not cleaned:
        raise ValueError("Output version cannot be empty.")
    if not cleaned.startswith("v"):
        cleaned = f"v{cleaned}"
    return cleaned


def resolve_version_name(processed_root: Path, requested_version: str | None) -> tuple[str, str | None]:
    version_pattern = re.compile(r"^v(\d+)$")
    existing_versions = []
    for child in processed_root.iterdir():
        if child.is_dir():
            match = version_pattern.match(child.name)
            if match:
                existing_versions.append(int(match.group(1)))

    if requested_version is not None:
        requested_path = processed_root / requested_version
        if not requested_path.exists():
            return requested_version, None
        requested_match = version_pattern.match(requested_version)
        if requested_match:
            next_version = max(existing_versions + [int(requested_match.group(1))]) + 1
            return f"v{next_version}", requested_version
        suffix = 2
        while (processed_root / f"{requested_version}_{suffix}").exists():
            suffix += 1
        return f"{requested_version}_{suffix}", requested_version

    next_version = max(existing_versions or [0]) + 1
    return f"v{next_version}", None


def stage_version_directory(processed_root: Path, version_name: str) -> Path:
    processed_root.mkdir(parents=True, exist_ok=True)
    staging_parent = processed_root / ".staging"
    staging_parent.mkdir(parents=True, exist_ok=True)
    staging_path = Path(tempfile.mkdtemp(prefix=f"{version_name}_", dir=staging_parent))
    return staging_path


def finalize_version_directory(staging_path: Path, final_path: Path) -> None:
    if final_path.exists():
        raise FileExistsError(f"Output version folder already exists: {final_path}")
    staging_path.rename(final_path)


def cleanup_staging(staging_path: Path) -> None:
    if staging_path.exists():
        shutil.rmtree(staging_path, ignore_errors=True)


def write_json(output_path: Path, payload: Any) -> None:
    with output_path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)


def write_text(output_path: Path, text: str) -> None:
    with output_path.open("w", encoding="utf-8") as handle:
        handle.write(text)


def print_rejection_summary(rejected_sequences: list[dict[str, Any]]) -> None:
    if not rejected_sequences:
        logging.info("rejections -> none")
        return

    counts = Counter(entry["reason"] for entry in rejected_sequences)
    logging.info("rejections -> %d total", len(rejected_sequences))
    for reason, count in counts.items():
        logging.info("rejections -> %s: %d", reason, count)


def build_label_encoder(payload: dict[str, Any]):
    class Encoder:
        def __init__(self, payload: dict[str, Any]):
            self.classes_ = np.asarray(payload["classes"], dtype=object)
            self._label_to_index = payload["label_to_index"]

        def transform(self, labels: list[str]) -> np.ndarray:
            return np.asarray([self._label_to_index[label] for label in labels], dtype=np.int64)

    return Encoder(payload)


if __name__ == "__main__":
    raise SystemExit(main())
