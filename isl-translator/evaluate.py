"""Legacy evaluation helpers archived from the monolithic training app."""
from __future__ import annotations
from pathlib import Path
from datetime import datetime, timezone
import json
import matplotlib.pyplot as plt
import numpy as np
import seaborn as sns
from sklearn.metrics import classification_report, confusion_matrix


def plot_training_curves(history, output_dir: str | Path) -> None:
    output_dir = Path(output_dir)
    for metric, filename in [("accuracy", "training_accuracy.png"), ("loss", "training_loss.png")]:
        plt.figure(figsize=(7, 4))
        plt.plot(history.history[metric], label=f"train {metric}")
        plt.plot(history.history[f"val_{metric}"], label=f"validation {metric}")
        plt.xlabel("Epoch"); plt.ylabel(metric.title()); plt.legend(); plt.tight_layout()
        plt.savefig(output_dir / filename, dpi=160); plt.close()


def evaluate_model(model, X_test, y_test, class_to_index: dict[str, int], output_dir: str | Path, split_sizes: dict[str, int]) -> float:
    """Evaluate only held-out test data and persist all requested KPI evidence."""
    output_dir = Path(output_dir); output_dir.mkdir(parents=True, exist_ok=True)
    class_names = [name for name, _ in sorted(class_to_index.items(), key=lambda x: x[1])]
    loss, accuracy = model.evaluate(X_test, y_test, verbose=0)
    y_true = np.argmax(y_test, axis=1)
    y_pred = np.argmax(model.predict(X_test, verbose=0), axis=1)
    cm = confusion_matrix(y_true, y_pred, labels=np.arange(len(class_names)))
    (output_dir / "confusion_matrix.json").write_text(json.dumps(cm.tolist(), indent=2), encoding="utf-8")
    report = classification_report(y_true, y_pred, labels=np.arange(len(class_names)), target_names=class_names, zero_division=0, output_dict=True)
    (output_dir / "classification_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    (output_dir / "classification_report.txt").write_text(classification_report(y_true, y_pred, labels=np.arange(len(class_names)), target_names=class_names, zero_division=0), encoding="utf-8")
    plt.figure(figsize=(6, 5)); sns.heatmap(cm, annot=True, fmt="d", cmap="Blues", xticklabels=class_names, yticklabels=class_names)
    plt.xlabel("Predicted"); plt.ylabel("True"); plt.tight_layout(); plt.savefig(output_dir / "confusion_matrix.png", dpi=160); plt.close()
    summary = f"# Evaluation summary\n\n- Run (UTC): {datetime.now(timezone.utc).isoformat()}\n- Held-out test accuracy: **{accuracy:.4%}**\n- Test loss: {loss:.6f}\n- Split sizes: train={split_sizes['train']}, validation={split_sizes['validation']}, test={split_sizes['test']}\n- Confusion matrix: `confusion_matrix.png` and `confusion_matrix.json`\n- Classification report: `classification_report.txt` and `classification_report.json`\n"
    (output_dir / "evaluation_summary.md").write_text(summary, encoding="utf-8")
    print(f"Held-out test accuracy: {accuracy:.4%}")
    return float(accuracy)
