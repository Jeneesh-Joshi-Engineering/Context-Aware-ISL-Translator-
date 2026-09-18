from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
from pathlib import Path
from typing import Any

from schema_validator import ValidationResult, validate_raw_export_file


@dataclass(frozen=True)
class MergeResult:
    valid_sequences: list[dict[str, Any]]
    rejected_sequences: list[dict[str, Any]]
    source_files: list[str]

    @property
    def total_files_processed(self) -> int:
        return len(self.source_files)

    @property
    def total_sequences_found(self) -> int:
        return len(self.valid_sequences) + len(self.rejected_sequences)


def merge_raw_sessions(raw_dir: str | Path, allowed_labels: set[str]) -> MergeResult:
    raw_path = Path(raw_dir)
    if not raw_path.is_dir():
        raise FileNotFoundError(f"Raw dataset directory does not exist: {raw_path}")

    # Recursive discovery permits organisation by sign/person/session. Labels are
    # never inferred from folders; they remain validated from each JSON sequence.
    file_paths = sorted(
        (path for path in raw_path.rglob("*.json") if path.is_file()),
        key=lambda path: path.relative_to(raw_path).as_posix().casefold(),
    )
    source_files = [path.relative_to(raw_path).as_posix() for path in file_paths]
    valid_sequences: list[dict[str, Any]] = []
    rejected_sequences: list[dict[str, Any]] = []

    for file_path, source_ref in zip(file_paths, source_files):
        validation_result: ValidationResult = validate_raw_export_file(file_path, allowed_labels)

        valid_sequences.extend(
            attach_provenance(sequence, source_ref)
            for sequence in validation_result.valid_sequences
        )
        rejected_sequences.extend(
            {**rejection, "source_file": source_ref}
            for rejection in validation_result.rejected_sequences
        )

    return MergeResult(
        valid_sequences=valid_sequences,
        rejected_sequences=rejected_sequences,
        source_files=source_files,
    )


def attach_provenance(sequence: dict[str, Any], source_ref: str) -> dict[str, Any]:
    enriched = dict(sequence)
    sequence_id = build_sequence_id(source_ref, enriched)
    enriched["source_file"] = source_ref
    enriched["source_member"] = infer_member_from_filename(source_ref)
    enriched["sequence_id"] = sequence_id
    enriched["origin_id"] = sequence_id
    enriched["synthetic"] = bool(enriched.get("synthetic", False))
    return enriched


def build_sequence_id(source_ref: str, sequence: dict[str, Any]) -> str:
    digest = hashlib.sha1()
    digest.update(source_ref.encode("utf-8"))
    digest.update(sequence["timestamp"].encode("utf-8"))
    digest.update(sequence["label"].encode("utf-8"))
    digest.update(json.dumps(sequence["frames"], sort_keys=True).encode("utf-8"))
    return digest.hexdigest()


def infer_member_from_filename(source_name: str) -> str:
    stem = Path(source_name).stem
    for separator in ("_", "-"):
        if separator in stem:
            return stem.split(separator, 1)[0]
    return stem
