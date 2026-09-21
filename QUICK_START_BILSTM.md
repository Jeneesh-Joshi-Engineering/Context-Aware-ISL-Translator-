# Quick Start Guide: BiLSTM Training

## Overview

This guide walks you through training a Bidirectional LSTM model on your ISL hand-gesture dataset (JSON format).

**Estimated time:** 2–3 hours total (most is hands-off training)

---

## Prerequisites

1. **Python 3.8+** 
2. **Your exported gesture JSON files** from the frontend (e.g., `isl_dataset_2026-08-18T04-53-03-200Z.json`)
3. **All team members' recordings** combined into one folder

---

## Step 1: Verify Setup (5 minutes)

Run this to check your environment and create folders:

```bash
cd isl-translator/model-training/scripts
python setup.py
```

**Expected output:**
```
✅ Python 3.10
✅ numpy
✅ tensorflow
✅ scikit-learn
✅ matplotlib
✅ seaborn
✅ tensorflowjs
✅ data-collection/dataset/raw/
✅ data-collection/dataset/processed/
✅ model-training/saved_model/
✅ frontend/model/
```

---

## Step 2: Prepare Your Dataset (30 minutes)

### Option A: All in one script (recommended)

```bash
cd isl-translator/model-training/scripts
python run_all.py
```

This runs:
1. `load_and_merge.py` — Combines all JSON files
2. `preprocess_and_split.py` — Normalizes and splits (70/15/15)
3. `train_bilstm.py` — Trains the model (~30–45 min)
4. `convert_to_tfjs.py` — Converts for browser

### Option B: Step-by-step (for debugging)

**Step 2a: Load and merge datasets**
```bash
python load_and_merge.py
```

**Expected output:**
```
✅ Merged dataset shape: X=(150, 30, 126), y=(150,)
✅ Unique gestures: ['emergency', 'hello', 'help', 'ticket', 'thanks', 'yes']
✅ Class distribution:
   emergency: 25 sequences (16.7%)
   hello: 26 sequences (17.3%)
   help: 24 sequences (16.0%)
   ...
```

**Step 2b: Preprocess and split**
```bash
python preprocess_and_split.py
```

**Expected output:**
```
✅ Loaded: X.shape=(150, 30, 126), y.shape=(150,)
🔄 Normalizing landmarks...
🔄 Encoding labels to integers...
🔄 Splitting dataset (70/15/15 stratified)...
✅ Train: (105, 30, 126)
✅ Val: (22, 30, 126)
✅ Test: (23, 30, 126)
```

**Step 2c: Train BiLSTM model**
```bash
python train_bilstm.py
```

**This takes 30–45 minutes. Expected output:**
```
🏗️  Building BiLSTM model...
Model: "sequential"
_________________________________________________________________
 Layer (type)                Output Shape              Param #
=================================================================
 bidirectional               (None, 30, 128)        133120
 ...
 dense_1                     (None, 6)                 198
=================================================================
Total params: 176,614

🚀 Training model...
Epoch 1/100
13/13 [==============================] 2s 145ms/step - loss: 2.5678 - accuracy: 0.1905 - val_loss: 2.1234 - val_accuracy: 0.4545
...
Epoch 45/100 (early stopped)

📊 Evaluating on test set...
✅ Test Loss: 0.1234
✅ Test Accuracy: 0.9565 (95.65%)

📋 Classification Report:
              precision    recall  f1-score   support
    emergency    0.9500  0.9500    0.9500        20
        hello    0.9600  0.9600    0.9600        25
         help    0.9400  0.9400    0.9400        16
       ticket    0.9800  0.9800    0.9800        51
       thanks    0.9300  0.9300    0.9300        30
          yes    0.9700  0.9700    0.9700        28
       
       accuracy                           0.9565       170
       macro avg       0.9483  0.9483    0.9483       170
    weighted avg       0.9571  0.9565    0.9571       170

✅ Saved: model-training/saved_model/v1/confusion_matrix.png
✅ Saved: model-training/saved_model/v1/training_history.png
💾 Keras model: model-training/saved_model/v1/model.h5
✅ SavedModel format: model-training/saved_model/v1/model_savedmodel/
✅ Metadata: model-training/saved_model/v1/model_metadata.json
```

**Step 2d: Convert to TensorFlow.js**
```bash
python convert_to_tfjs.py
```

**Expected output:**
```
🔄 Converting Keras Model to TensorFlow.js...

📂 Input:  .../model-training/saved_model/v1/model.h5
📂 Output: .../frontend/model/

✅ Conversion successful!

📦 Generated files:
   - model.json (45 KB)
   - model.weights.bin (2.8 MB)
   - model_metadata.json (0.5 KB)

✨ Ready for browser!
```

---

## Step 3: Verify Output Files

After training, check these files exist:

```
isl-translator/
├── model-training/
│   └── saved_model/v1/
│       ├── model.h5                    ✅ Keras model
│       ├── model_savedmodel/           ✅ SavedModel format
│       ├── model_metadata.json         ✅ Label mapping & hyperparams
│       ├── confusion_matrix.png        ✅ Per-class metrics
│       ├── training_history.png        ✅ Loss/accuracy curves
│       └── best_model.weights.h5       ✅ Best weights
│
└── frontend/
    └── model/
        ├── model.json                  ✅ TensorFlow.js architecture
        ├── model.weights.bin           ✅ TensorFlow.js weights
        └── model_metadata.json         ✅ (copy of metadata)
```

---

## Step 4: Integrate into Frontend (15 minutes)

Copy metadata to frontend:
```bash
cp isl-translator/model-training/saved_model/v1/model_metadata.json \
   isl-translator/frontend/model/model_metadata.json
```

Update `frontend/js/main.js` to load the model:

```javascript
let tfModel = null;
const CONFIDENCE_THRESHOLD = 0.60;
const ROLLING_WINDOW_SIZE = 30;
let landmarkWindow = [];

async function loadModel() {
  console.log("🔄 Loading TensorFlow.js model...");
  try {
    tfModel = await tf.loadLayersModel('file://frontend/model/model.json');
    console.log("✅ Model loaded successfully!");
    return true;
  } catch (error) {
    console.error("❌ Failed to load model:", error);
    return false;
  }
}

function predictGesture(frameVector) {
  landmarkWindow.push(frameVector);
  if (landmarkWindow.length > ROLLING_WINDOW_SIZE) {
    landmarkWindow.shift();
  }
  
  if (landmarkWindow.length < ROLLING_WINDOW_SIZE) {
    return null;
  }
  
  const input = tf.tensor3d([landmarkWindow]);
  const output = tfModel.predict(input);
  const probabilities = output.dataSync();
  
  let maxProb = 0, maxClass = -1;
  for (let i = 0; i < probabilities.length; i++) {
    if (probabilities[i] > maxProb) {
      maxProb = probabilities[i];
      maxClass = i;
    }
  }
  
  input.dispose();
  output.dispose();
  
  if (maxProb < CONFIDENCE_THRESHOLD) {
    return { status: "low_confidence", confidence: maxProb };
  }
  
  return { status: "confident", classIndex: maxClass, confidence: maxProb };
}

// Call after camera starts
async function init() {
  if (await loadModel()) {
    requestAnimationFrame(processFrame);
  }
}
```

Test in browser:
```bash
cd isl-translator/frontend
npx serve .
# Open http://localhost:3000 in your browser
```

---

## Troubleshooting

### "Module not found: tensorflow"
```bash
pip install tensorflow numpy scikit-learn matplotlib seaborn tensorflowjs
```

### "No JSON files found in raw/"
Make sure your exported gesture files are in:
```
isl-translator/data-collection/dataset/raw/
```

File naming convention:
```
jeneesh_session1.json
shreya_session1.json
neelakshi_session1.json
ashmeet_session1.json
```

### "Shape mismatch (30, 126)"
Some sequences are not 30 frames long. The loader will skip them and print a warning.

### "Low accuracy (<70%)"
- Collect more data (aim for 50+ sequences per gesture)
- Ensure diverse conditions (different lighting, angles, speeds)
- Check that normalization is working (verify X values are in range -1 to 1)

### "Inference too slow (>100ms)"
- Use GPU: `CUDA_VISIBLE_DEVICES=0 python train_bilstm.py`
- Reduce rolling window: change `ROLLING_WINDOW_SIZE = 20`
- Run inference in WebWorker (background thread)

---

## Understanding Your Results

### Confusion Matrix
Shows true labels vs predicted labels. Perfect model = diagonal line.

- Diagonal (top-left to bottom-right) = correct predictions
- Off-diagonal = misclassifications

**Example:**
```
           Predicted
          E  H  HE T  TH Y
        +--+--+--+--+--+--+
Actual E| 19| 1| 0| 0| 0| 0|  (95% accuracy for "emergency")
        | 1|24| 0| 0| 0| 1|  (92% accuracy for "hello")
        | 0| 0|16| 0| 0| 0|  (100% accuracy for "help")
```

### Training History
- **Loss curve:** Should go down over time (model learning)
- **Accuracy curve:** Should go up over time
- If validation loss goes up while training loss goes down = overfitting (model memorizing)

---

## Next Steps

1. ✅ Run full pipeline: `python run_all.py`
2. ✅ Check accuracy is >85%
3. ✅ Verify TensorFlow.js files exist
4. ✅ Integrate into frontend (see Step 4)
5. ✅ Test live predictions in browser
6. ✅ Collect more data if accuracy is low
7. ✅ Retrain on larger dataset

---

## Files Created

| File | Purpose | Location |
|------|---------|----------|
| `X_train.npy` | Training sequences | `data-collection/dataset/processed/v1/` |
| `y_train.npy` | Training labels | `data-collection/dataset/processed/v1/` |
| `model.h5` | Trained Keras model | `model-training/saved_model/v1/` |
| `model.json` | TensorFlow.js model | `frontend/model/` |
| `model.weights.bin` | TensorFlow.js weights | `frontend/model/` |
| `confusion_matrix.png` | Test set metrics | `model-training/saved_model/v1/` |
| `training_history.png` | Loss/accuracy curves | `model-training/saved_model/v1/` |

---

## Support

For detailed technical explanations, see: **BILSTM_TRAINING_ROADMAP.md**

Good luck! 🚀
