"""Legacy training config.

The active data pipeline now lives under `model-training/`, and the browser
application uses the files under `frontend/`.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
from pathlib import Path
import json


@dataclass
class PipelineConfig:
    max_frames: int = 30
    num_features: int = 63
    wrist_index: int = 0
    landmarks_per_hand: int = 21
    hands: int = 1
    padding: str = "post"
    truncating: str = "post"
    normalize_scale: bool = True
    scale_reference_index: int = 9  # middle-finger MCP for MediaPipe Hands
    scale_epsilon: float = 1e-6
    random_seed: int = 42
    confidence_threshold: float = 0.60
    epochs: int = 100
    batch_size: int = 8
    early_stopping_patience: int = 10

    def save(self, path: str | Path, class_to_index: dict[str, int]) -> None:
        payload = asdict(self) | {"class_to_index": class_to_index}
        Path(path).write_text(json.dumps(payload, indent=2), encoding="utf-8")

    @classmethod
    def load(cls, path: str | Path) -> tuple["PipelineConfig", dict[str, int]]:
        payload = json.loads(Path(path).read_text(encoding="utf-8"))
        mapping = payload.pop("class_to_index")
        return cls(**payload), {str(k): int(v) for k, v in mapping.items()}


# Named defaults keep the requested base architecture easy to tune later.
LSTM_UNITS_1 = 64
LSTM_UNITS_2 = 32
DENSE_UNITS = 32
DROPOUT_RATE = 0.3
