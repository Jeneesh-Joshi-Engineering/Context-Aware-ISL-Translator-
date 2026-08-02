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
    source_files = sorted(path.name for path in raw_path.glob("*.json"))
    valid_sequences: list[dict[str, Any]] = []
    rejected_sequences: list[dict[str, Any]] = []

    for source_name in source_files:
        file_path = raw_path / source_name
        validation_result: ValidationResult = validate_raw_export_file(file_path, allowed_labels)

        valid_sequences.extend(
            attach_provenance(sequence, source_name)
            for sequence in validation_result.valid_sequences
        )
        rejected_sequences.extend(validation_result.rejected_sequences)

    return MergeResult(
        valid_sequences=valid_sequences,
        rejected_sequences=rejected_sequences,
        source_files=source_files,
    )


def attach_provenance(sequence: dict[str, Any], source_name: str) -> dict[str, Any]:
    enriched = dict(sequence)
    sequence_id = build_sequence_id(source_name, enriched)
    enriched["source_file"] = source_name
    enriched["source_member"] = infer_member_from_filename(source_name)
    enriched["sequence_id"] = sequence_id
    enriched["origin_id"] = sequence_id
    enriched["synthetic"] = bool(enriched.get("synthetic", False))
    return enriched


def build_sequence_id(source_name: str, sequence: dict[str, Any]) -> str:
    digest = hashlib.sha1()
    digest.update(source_name.encode("utf-8"))
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
