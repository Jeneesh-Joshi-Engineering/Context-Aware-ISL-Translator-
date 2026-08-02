from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import matplotlib.pyplot as plt
import pandas as pd


@dataclass(frozen=True)
class BalanceReportResult:
    label_counts: dict[str, int]
    person_label_counts: dict[str, dict[str, int]]
    chart_path: str
    markdown: str


def create_balance_report(
    sequences: list[dict[str, Any]],
    processed_dir: str | Path,
    min_per_label: int = 20,
) -> BalanceReportResult:
    if not sequences:
        raise ValueError("No sequences available after merge and deduplication.")

    processed_path = Path(processed_dir)
    processed_path.mkdir(parents=True, exist_ok=True)

    df = pd.DataFrame(
        {
            "label": [sequence["label"] for sequence in sequences],
            "source_member": [infer_member_from_filename(sequence.get("source_file", "")) for sequence in sequences],
        }
    )

    label_counts = df["label"].value_counts().sort_index().to_dict()
    person_label_counts_df = pd.crosstab(df["source_member"], df["label"]).sort_index()
    person_label_counts = {
        person: {label: int(count) for label, count in row.items()}
        for person, row in person_label_counts_df.iterrows()
    }

    validate_label_balance(label_counts, min_per_label)
    chart_path = processed_path / "label_distribution.png"
    save_label_chart(label_counts, chart_path)

    markdown = build_markdown(label_counts, person_label_counts, chart_path.name, min_per_label)
    return BalanceReportResult(
        label_counts=label_counts,
        person_label_counts=person_label_counts,
        chart_path=str(chart_path),
        markdown=markdown,
    )


def validate_label_balance(label_counts: dict[str, int], min_per_label: int) -> None:
    if "No_Gesture" not in label_counts:
        raise ValueError("The No_Gesture class is missing from the dataset.")

    for label, count in label_counts.items():
        if count < min_per_label:
            raise ValueError(f"Label '{label}' has only {count} sequences; minimum required is {min_per_label}.")


def save_label_chart(label_counts: dict[str, int], chart_path: Path) -> None:
    labels = list(label_counts.keys())
    counts = [label_counts[label] for label in labels]

    plt.figure(figsize=(10, 5))
    plt.bar(labels, counts, color="#55d6be")
    plt.title("Sequence Count per Label")
    plt.ylabel("Sequences")
    plt.xlabel("Label")
    plt.tight_layout()
    plt.savefig(chart_path, dpi=180)
    plt.close()


def build_markdown(
    label_counts: dict[str, int],
    person_label_counts: dict[str, dict[str, int]],
    chart_filename: str,
    min_per_label: int,
) -> str:
    lines = [
        "# Dataset Report",
        "",
        "## Label Counts",
        "",
        "| Label | Count |",
        "| --- | ---: |",
    ]

    for label, count in label_counts.items():
        lines.append(f"| {label} | {count} |")

    lines.extend(
        [
            "",
            "## Per-Person Counts",
            "",
            "| Person | Label | Count |",
            "| --- | --- | ---: |",
        ]
    )

    for person, label_counts_for_person in person_label_counts.items():
        for label, count in label_counts_for_person.items():
            lines.append(f"| {person} | {label} | {count} |")

    lines.extend(
        [
            "",
            f"## Minimum Count Check",
            "",
            f"Minimum required per label: **{min_per_label}**",
            "",
            f"![Label distribution]({chart_filename})",
            "",
        ]
    )
    return "\n".join(lines)


def infer_member_from_filename(source_name: str) -> str:
    stem = Path(source_name).stem
    for separator in ("_", "-"):
        if separator in stem:
            return stem.split(separator, 1)[0]
    return stem

