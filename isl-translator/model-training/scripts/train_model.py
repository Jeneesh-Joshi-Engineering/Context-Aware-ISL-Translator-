"""Train the transit-hub BiLSTM from a versioned processed dataset."""
from __future__ import annotations
import argparse, json
from pathlib import Path
import numpy as np
import tensorflow as tf
import matplotlib.pyplot as plt

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset-version", default="v1")
    parser.add_argument("--dataset-root", default=None)
    parser.add_argument("--epochs", type=int, default=100)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    data = Path(args.dataset_root or root / "dataset" / "processed") / args.dataset_version
    out = root / "saved_model" / args.dataset_version
    out.mkdir(parents=True, exist_ok=True)
    Xtr, ytr = np.load(data / "X_train.npy"), np.load(data / "y_train.npy")
    Xv, yv = np.load(data / "X_val.npy"), np.load(data / "y_val.npy")
    with (data / "label_encoder.json").open(encoding="utf-8") as f: encoder = json.load(f)
    classes = encoder.get("classes") or list(encoder)
    n = len(classes)
    if n < 2: raise ValueError("At least two recorded labels are required before training.")
    model = tf.keras.Sequential([
        tf.keras.layers.Input(shape=Xtr.shape[1:]),
        tf.keras.layers.Bidirectional(tf.keras.layers.LSTM(64, return_sequences=True)),
        tf.keras.layers.Dropout(.3), tf.keras.layers.Bidirectional(tf.keras.layers.LSTM(32)),
        tf.keras.layers.Dropout(.3), tf.keras.layers.Dense(32, activation="relu"),
        tf.keras.layers.Dense(n, activation="softmax")])
    model.compile(optimizer="adam", loss="categorical_crossentropy", metrics=["accuracy"])
    ytr, yv = tf.keras.utils.to_categorical(ytr, n), tf.keras.utils.to_categorical(yv, n)
    callbacks=[tf.keras.callbacks.EarlyStopping(monitor="val_loss", patience=10, restore_best_weights=True),
               tf.keras.callbacks.ModelCheckpoint(out / "best_model.h5", monitor="val_loss", save_best_only=True)]
    history=model.fit(Xtr,ytr,validation_data=(Xv,yv),epochs=args.epochs,callbacks=callbacks,verbose=1)
    model.save(out / "model.h5"); model.export(out / "model_savedmodel")
    (out / "model_metadata.json").write_text(json.dumps({"num_classes":n,"input_shape":list(Xtr.shape[1:]),"confidence_threshold":.7,"label_mapping":encoder.get("label_to_index", encoder)},indent=2),encoding="utf-8")
    fig, axes=plt.subplots(1,2,figsize=(11,4))
    for key in ("loss","val_loss"): axes[0].plot(history.history[key],label=key)
    for key in ("accuracy","val_accuracy"): axes[1].plot(history.history[key],label=key)
    [axis.legend() for axis in axes]; fig.tight_layout(); fig.savefig(out / "training_history.png",dpi=150)
if __name__ == "__main__": main()
