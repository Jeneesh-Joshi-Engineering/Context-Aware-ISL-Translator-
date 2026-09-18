"""Legacy inference helper archived from the monolithic training app."""
from __future__ import annotations
from typing import Any
import numpy as np
from config import PipelineConfig
from data import preprocess_sequence


def predict_with_confidence(model: Any, sequence: np.ndarray, class_to_index: dict[str, int], config: PipelineConfig, threshold: float | None = None) -> dict[str, Any]:
    """Predict a sign or explicitly request the finger-spelling fallback below threshold."""
    prepared = preprocess_sequence(sequence, config)[None, ...]
    probabilities = model.predict(prepared, verbose=0)[0]
    index = int(np.argmax(probabilities))
    confidence = float(probabilities[index])
    threshold = config.confidence_threshold if threshold is None else threshold
    if confidence >= threshold:
        inverse = {v: k for k, v in class_to_index.items()}
        return {"status": "confident", "predicted_label": inverse[index], "confidence": confidence}
    return {"status": "low_confidence", "predicted_label": None, "confidence": confidence, "fallback": "finger_spelling"}
