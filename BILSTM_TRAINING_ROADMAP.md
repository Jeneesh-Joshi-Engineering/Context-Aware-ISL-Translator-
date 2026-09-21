# BiLSTM Training Roadmap for ISL Hand Sign Dataset
**Date:** August 18, 2026  
**Dataset Format:** `isl.data-acquisition.v1` (JSON with normalized hand landmarks)

---

## Understanding Your Data Format

### JSON Structure
```json
{
  "schema": "isl.data-acquisition.v1",
  "exportedAt": "2026-08-18T04:53:03.200Z",
  "sequenceCount": 1,
  "targetFrameCount": 30,           // Fixed sequence length
  "frameVectorLength": 126,          // 21 landmarks × 3 (x,y,z) × 2 hands
  "sequences": [
    {
      "label": "ticket",             // Gesture name
      "timestamp": "2026-08-18T04:52:59.321Z",
      "handedness": ["Left", "Right"], // Which hands were detected
      "frames": [                    // 30 frames, each 126 values
        [0, 0, 0, ..., 126 values],
        [0, 0, 0, ..., 126 values],
        ...
      ]
    }
  ]
}
```

### Data Dimensions Explained
- **21 landmarks per hand:** Wrist + finger joints (thumb, index, middle, ring, pinky)
- **3 coordinates per landmark:** x, y, z (normalized by MediaPipe)
- **2 hands max:** Left hand (indices 0–62) + Right hand (indices 63–125)
- **30 frames per sequence:** Fixed temporal length for LSTM input
- **Handedness metadata:** Tells you which hands were used

---

## Step-by-Step Training Roadmap

### STEP 1: Organize Your Dataset

**Location:** `c:\BE Project demonstration\isl-translator\data-collection\dataset\raw\`

**Action:** Collect all JSON files from your team members
```
raw/
├── jeneesh_session1.json     (multiple gesture types)
├── shreya_session1.json
├── neelakshi_session1.json
├── ashmeet_session1.json
├── jeneesh_session2.json     (more recordings, different conditions)
└── ...
```

Each JSON file should contain an array of sequences with different labels:
- "ticket"
- "help"
- "emergency"
- "hello"
- "thanks"
- "yes"
- "no"
- etc.

**Goal:** Aim for at least **20–30 sequences per gesture class** across all team members.

**Timeline:** Week 1 (parallel with other phases)

---

### STEP 2: Create a Data Loader & Merger

**File to create:** `model-training/scripts/load_and_merge.py`

**Purpose:** Combine all JSON files into a single training dataset

**Run:**
```bash
cd model-training/scripts
python load_and_merge.py
```

**Expected output:**
```
✅ Merged dataset shape: X=(150, 30, 126), y=(150,)
✅ Unique gestures: ['emergency', 'hello', 'help', 'ticket', 'thanks', 'yes']
✅ Class distribution:
   emergency: 25 sequences
   hello: 26 sequences
   help: 24 sequences
   ticket: 25 sequences
   thanks: 25 sequences
   yes: 25 sequences
```

**Timeline:** ~2 hours (one-time setup)

---

### STEP 3: Preprocess & Split Dataset

**File to create:** `model-training/scripts/preprocess_and_split.py`

**Purpose:** Normalize data and create train/validation/test splits

**Run:**
```bash
cd model-training/scripts
python preprocess_and_split.py
```

**Expected output files:**
```
data-collection/dataset/processed/v1/
├── X_train.npy          # (105, 30, 126) - training sequences
├── y_train.npy          # (105,) - training labels (0, 1, 2, ...)
├── X_val.npy            # (22, 30, 126)
├── y_val.npy            # (22,)
├── X_test.npy           # (23, 30, 126)
├── y_test.npy           # (23,)
└── label_encoder.json   # {"emergency": 0, "hello": 1, ...}
```

**Timeline:** ~3 hours

---

### STEP 4: Build and Train BiLSTM Model

**File to create:** `model-training/scripts/train_bilstm.py`

**Purpose:** Build a Bidirectional LSTM model and train it on your landmark data

**Run:**
```bash
cd model-training/scripts
python train_bilstm.py
```

**Expected output:**
```
📂 Loading preprocessed data...
✅ Data loaded:
   Training: (105, 30, 126)
   Validation: (22, 30, 126)
   Test: (23, 30, 126)
   Num classes: 6

🏗️  Building BiLSTM model...
Model: "sequential"
_________________________________________________________________
 Layer (type)                Output Shape              Param #
=================================================================
 bidirectional (Bidirectional) (None, 30, 128)        133120
 dropout (Dropout)            (None, 30, 128)        0
 bidirectional_1 (Bidirectional) (None, 64)          41216
 dropout_1 (Dropout)          (None, 64)            0
 dense (Dense)                (None, 32)            2080
 dropout_2 (Dropout)          (None, 32)            0
 dense_1 (Dense)              (None, 6)            198
=================================================================
Total params: 176,614
Trainable params: 176,614
Non-trainable params: 0

🚀 Training model...
Epoch 1/100
...
Epoch 45/100 (early stopped)

📊 Evaluating on test set...
   Test Loss: 0.1234
   Test Accuracy: 0.9565

📋 Classification Report:
              precision    recall  f1-score   support
    emergency    0.9500  0.9500    0.9500        20
        hello    0.9600  0.9600    0.9600        25
         help    0.9400  0.9400    0.9400        16
       ticket    0.9800  0.9800    0.9800        51
       thanks    0.9300  0.9300    0.9300        30
          yes    0.9700  0.9700    0.9700        28

✅ Confusion matrix saved
✅ Training history saved
💾 Saving model...
```

**Expected output files:**
```
saved_model/v1/
├── model.h5                    # Keras model (full)
├── model_savedmodel/           # SavedModel format (for TF.js conversion)
│   ├── saved_model.pb
│   └── variables/
├── best_model.weights.h5       # Best weights checkpoint
├── confusion_matrix.png        # Per-class metrics
├── training_history.png        # Loss/accuracy curves
├── model_metadata.json         # For inference: label mapping, num_classes
└── ...
```

**Timeline:** ~4–6 hours (depending on dataset size)

---

### STEP 5: Convert Model to TensorFlow.js

**File to create:** `model-training/scripts/convert_to_tfjs.py`

**Purpose:** Convert saved model to TensorFlow.js format for browser inference


**Timeline:** ~3 hours

---

### STEP 7: Test & Evaluate

**Checklist:**

- [ ] **Unit test:** Load single JSON file, verify shape
- [ ] **Integration test:** Train on small subset (10 sequences), overfit check
- [ ] **Full training:** Train on complete dataset
- [ ] **Accuracy benchmark:** Test accuracy ≥ 85% on test set
- [ ] **Inference speed:** ≤50ms per prediction in browser
- [ ] **Confidence calibration:** Current operating threshold is 0.60; calibrate it on new participant-held-out data

**Run inference on sample:**
```python
# test_inference.py
import numpy as np
import tensorflow as tf
import json

# Load model
model = tf.keras.models.load_model('saved_model/v1/model.h5')

# Load test data
X_test = np.load('data-collection/dataset/processed/v1/X_test.npy')
y_test = np.load('data-collection/dataset/processed/v1/y_test.npy')

with open('data-collection/dataset/processed/v1/label_encoder.json') as f:
    label_mapping = json.load(f)

# Make predictions
y_pred_probs = model.predict(X_test)
y_pred = np.argmax(y_pred_probs, axis=1)

# Show results for first 5 test samples
idx_to_label = {v: k for k, v in label_mapping.items()}
for i in range(min(5, len(X_test))):
    true_label = idx_to_label[y_test[i]]
    pred_label = idx_to_label[y_pred[i]]
    confidence = y_pred_probs[i, y_pred[i]]
    print(f"Sample {i}: True={true_label}, Pred={pred_label}, Confidence={confidence:.2%}")
```

**Timeline:** ~2 hours

---

## Quick Reference: Complete Command List

```bash
# Step 1: Organize files (manual - move JSON files to raw/)
# Files should be in: data-collection/dataset/raw/*.json

# Step 2: Load and merge
cd isl-translator/model-training/scripts
python load_and_merge.py

# Step 3: Preprocess and split
python preprocess_and_split.py

# Step 4: Train model
python train_bilstm.py

# Step 5: Install TensorFlow.js converter
pip install tensorflowjs

# Step 6: Convert to TensorFlow.js
python convert_to_tfjs.py

# Step 7: Test inference (optional)
python test_inference.py

# Frontend: Load model in browser (update main.js as shown above)
```

---

## Dataset Quality Checklist

Before you start training, ensure your JSON files have:

- [ ] **At least 20 sequences per gesture class**
- [ ] **All sequences exactly 30 frames long**
- [ ] **All frames exactly 126 values** (no missing landmarks)
- [ ] **Consistent labels** (lowercase, no extra spaces)
- [ ] **Diverse conditions:** different people, lighting, hand positions, speeds
- [ ] **"No gesture" or "resting" class** for negative examples
- [ ] **Balanced classes** (~same number per gesture)

If any sequence has all zeros or mismatched shape, `load_and_merge.py` will skip it and warn you.

---

## Expected Results

| Metric | Target | Realistic |
|--------|--------|-----------|
| Test Accuracy | >90% | 85–95% |
| Training Time | <1 hour | 30–45 min |
| Model Size | <10MB | 2–5MB |
| Inference Speed | <50ms | 20–40ms |
| Confidence Threshold | 0.60 | Validate 0.55–0.70 on new data |

---

## Troubleshooting

### Issue: "Shape mismatch (expected 30, got 15)"
**Cause:** Some sequences in JSON are shorter than 30 frames.
**Fix:** Frontend should pad to 30 frames during export, or `load_and_merge.py` will skip those sequences.

### Issue: "Low accuracy (<70%)"
**Cause:** Dataset too small or imbalanced; model underfitting.
**Fix:** 
- Collect more sequences per gesture (aim for 50+ per class)
- Ensure data is balanced across classes
- Increase training epochs
- Check that normalization is working

### Issue: "Inference too slow (>100ms)"
**Cause:** Model too large; JavaScript overhead.
**Fix:**
- Use smaller BiLSTM (32 → 16 units)
- Reduce rolling window size (30 → 20 frames)
- Run in WebWorker (background thread)

### Issue: "Confidence always <0.60"
**Cause:** Model is uncertain; threshold too high for your data quality.
**Fix:**
- Lower threshold to 0.50–0.60
- Collect cleaner, more diverse data
- Ensure normalization is working correctly

---

## Timeline Summary

| Step | Task | Duration | Owner |
|------|------|----------|-------|
| 1 | Collect & organize JSON files | 3–5 days | All team |
| 2 | Load and merge data | 2 hours | ML lead |
| 3 | Preprocess & split | 3 hours | ML lead |
| 4 | Train BiLSTM | 4–6 hours | ML lead |
| 5 | Convert to TensorFlow.js | 10 min | ML lead |
| 6 | Integrate into frontend | 3 hours | Frontend/ML |
| 7 | Test & validate | 2–3 hours | All |
| **Total** | | **~15–20 hours** | |

**Wall clock time:** ~2 weeks (can be parallelized with other phases)

---

## Next Steps

1. **This week:** Collect all JSON files and organize in `data-collection/dataset/raw/`
2. **Next week:** Run Steps 2–4 (load, preprocess, train)
3. **Week after:** Run Steps 5–6 (convert and integrate)
4. **Final week:** Test end-to-end and optimize

Good luck! 🚀
