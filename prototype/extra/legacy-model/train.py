"""Legacy training entry point archived from the monolithic app."""
from __future__ import annotations
import argparse
from pathlib import Path
import numpy as np
from config import PipelineConfig
from data import encode_labels, generate_synthetic_dataset, load_dataset, preprocess_dataset, split_dataset, split_distribution
from evaluate import evaluate_model, plot_training_curves
from infer import predict_with_confidence
from model import build_model


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=Path, help="Folder-per-class dataset or CSV/Parquet index")
    parser.add_argument("--output", type=Path, default=Path("outputs"))
    parser.add_argument("--synthetic", action="store_true", help="Generate a testable 3-class dataset first")
    parser.add_argument("--epochs", type=int, default=None)
    parser.add_argument("--batch-size", type=int, default=None, help="Override the small-dataset default (8)")
    parser.add_argument("--synthetic-samples", type=int, default=30, help="Samples per synthetic class")
    args = parser.parse_args()
    config = PipelineConfig(epochs=args.epochs or PipelineConfig.epochs, batch_size=args.batch_size or PipelineConfig.batch_size)
    data_path = args.data or Path("work/synthetic_data")
    if args.synthetic or not args.data:
        generate_synthetic_dataset(data_path, config, samples_per_class=args.synthetic_samples)
    sequences, labels = load_dataset(data_path)
    X = preprocess_dataset(sequences, config)
    y, class_to_index = encode_labels(labels)
    train_idx, val_idx, test_idx = split_dataset(X, labels, config)
    for name, idx in [("train", train_idx), ("validation", val_idx), ("test", test_idx)]:
        print(f"{name} distribution: {split_distribution(labels, idx)}")
    np.random.seed(config.random_seed)
    import tensorflow as tf
    tf.keras.utils.set_random_seed(config.random_seed)
    model = build_model(config.max_frames, config.num_features, len(class_to_index))
    args.output.mkdir(parents=True, exist_ok=True)
    callbacks = [
        tf.keras.callbacks.EarlyStopping(monitor="val_loss", patience=config.early_stopping_patience, restore_best_weights=True),
        # Best weights are checkpointed independently; the complete final model is
        # saved below in both portable H5 and TensorFlow SavedModel formats.
        tf.keras.callbacks.ModelCheckpoint(args.output / "best_model.weights.h5", monitor="val_accuracy", save_best_only=True, save_weights_only=True, mode="max"),
    ]
    history = model.fit(X[train_idx], y[train_idx], validation_data=(X[val_idx], y[val_idx]), epochs=config.epochs, batch_size=config.batch_size, callbacks=callbacks, verbose=2)
    model.save(args.output / "sign_classifier.h5")
    model.export(args.output / "saved_model")
    config.save(args.output / "preprocessing_config.json", class_to_index)
    plot_training_curves(history, args.output)
    evaluate_model(model, X[test_idx], y[test_idx], class_to_index, args.output, {"train": len(train_idx), "validation": len(val_idx), "test": len(test_idx)})
    print("Inference demonstration (default threshold):", predict_with_confidence(model, sequences[test_idx[0]], class_to_index, config))
    # Threshold is configurable for product calibration; 0.0 explicitly exercises
    # the frontend's confident branch even for a deliberately short smoke-training run.
    print("Inference demonstration (confident branch, threshold=0.0):", predict_with_confidence(model, sequences[test_idx[0]], class_to_index, config, threshold=0.0))
    noise = np.random.default_rng(9).normal(0, 1, (config.max_frames, config.num_features)).astype(np.float32)
    print("Inference demonstration (forced fallback threshold):", predict_with_confidence(model, noise, class_to_index, config, threshold=1.01))


if __name__ == "__main__":
    main()
