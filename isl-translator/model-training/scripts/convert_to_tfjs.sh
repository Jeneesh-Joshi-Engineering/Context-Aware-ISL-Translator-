#!/usr/bin/env sh
# Convert a trained Keras artifact and copy its label mapping to the browser.
set -eu
VERSION="${1:-v1}"
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
OUT="$ROOT/../frontend/model"
mkdir -p "$OUT"
tensorflowjs_converter --input_format=keras --output_format=tfjs_layers_model "$ROOT/saved_model/$VERSION/model.h5" "$OUT"
cp "$ROOT/dataset/processed/$VERSION/label_encoder.json" "$OUT/label_encoder.json"
cp "$ROOT/saved_model/$VERSION/model_metadata.json" "$OUT/model_metadata.json"
