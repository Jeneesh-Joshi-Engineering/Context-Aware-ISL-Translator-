"""
Preprocess landmark data and create train/val/test splits.
Handles normalization and stratified splitting.
"""

import json
import numpy as np
from pathlib import Path
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split

def normalize_landmarks(X: np.ndarray) -> np.ndarray:
    """
    Normalize each frame independently:
    - For each hand: subtract wrist position (landmark 0) from all landmarks
    - Optional: scale by distance from wrist to middle finger MCP (landmark 9)
    
    This makes the model translation-invariant and scale-invariant.
    
    Input shape: (num_sequences, 30, 126)
    Where 126 = 63 per hand = 21 landmarks × 3 coords
    Hand 1 (Left): indices 0–62
    Hand 2 (Right): indices 63–125
    """
    X_normalized = X.copy()
    
    for seq_idx in range(X.shape[0]):
        # Process left hand (landmarks 0–62)
        for hand_idx, hand_start in enumerate([0, 63]):  # Left, Right
            for frame_idx in range(30):
                frame = X_normalized[seq_idx, frame_idx]
                
                # Extract hand landmarks (21 landmarks × 3 coords = 63 values)
                hand_landmarks = frame[hand_start:hand_start + 63].reshape(21, 3)
                
                # Wrist is landmark 0, middle MCP is landmark 9
                wrist = hand_landmarks[0].copy()
                reference = hand_landmarks[9].copy()
                
                # Check if hand was detected (not all zeros)
                if np.allclose(hand_landmarks, 0):
                    continue
                
                # Translate: subtract wrist from all points
                hand_landmarks -= wrist
                
                # Scale: divide by distance from wrist to reference landmark
                # This makes the model invariant to hand size
                distance = np.linalg.norm(reference - wrist)
                if distance > 1e-6:
                    hand_landmarks /= distance
                
                # Put normalized landmarks back into frame
                X_normalized[seq_idx, frame_idx, hand_start:hand_start + 63] = hand_landmarks.flatten()
    
    return X_normalized

def preprocess_and_split(raw_data_dir: Path, output_dir: Path):
    """
    Load merged data, normalize, and create train/validation/test splits.
    
    Split: 70% train, 15% validation, 15% test (stratified by class)
    """
    
    # Load merged data from previous step
    print("📂 Loading merged data...")
    X_path = raw_data_dir / "X_merged.npy"
    y_path = raw_data_dir / "y_merged.npy"
    labels_path = raw_data_dir / "labels.json"
    
    if not X_path.exists():
        print(f"❌ Missing {X_path}")
        print("   Run load_and_merge.py first!")
        return
    
    X = np.load(X_path)
    y = np.load(y_path)
    with open(labels_path) as f:
        label_names = json.load(f)
    
    print(f"✅ Loaded: X.shape={X.shape}, y.shape={y.shape}")
    print(f"   Gesture classes: {label_names}")
    
    # Normalize landmarks
    print("\n🔄 Normalizing landmarks...")
    print("   - Subtracting wrist position (translation-invariant)")
    print("   - Scaling by wrist-to-MCP distance (scale-invariant)")
    X_normalized = normalize_landmarks(X)
    print("✅ Normalization complete")
    
    # Encode labels to integers (required by sparse_categorical_crossentropy)
    print("\n🔄 Encoding labels to integers...")
    le = LabelEncoder()
    y_encoded = le.fit_transform(y)
    print(f"✅ Label mapping: {dict(zip(le.classes_, le.transform(le.classes_)))}")
    
    # Stratified split: 70% train, 15% val, 15% test
    print("\n🔄 Splitting dataset (70/15/15 stratified)...")
    
    # First split: train (70%) vs temp (30%)
    train_idx, temp_idx = train_test_split(
        np.arange(len(y)),
        test_size=0.30,
        stratify=y_encoded,
        random_state=42
    )
    
    # Second split: temp into val (50% of temp = 15% overall) and test (50% of temp = 15% overall)
    val_idx, test_idx = train_test_split(
        temp_idx,
        test_size=0.50,
        stratify=y_encoded[temp_idx],
        random_state=42
    )
    
    # Create splits
    X_train = X_normalized[train_idx]
    y_train = y_encoded[train_idx]
    
    X_val = X_normalized[val_idx]
    y_val = y_encoded[val_idx]
    
    X_test = X_normalized[test_idx]
    y_test = y_encoded[test_idx]
    
    # Save splits
    print("\n💾 Saving splits...")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    np.save(output_dir / "X_train.npy", X_train)
    np.save(output_dir / "y_train.npy", y_train)
    np.save(output_dir / "X_val.npy", X_val)
    np.save(output_dir / "y_val.npy", y_val)
    np.save(output_dir / "X_test.npy", X_test)
    np.save(output_dir / "y_test.npy", y_test)
    print(f"✅ Train: {X_train.shape} → y_train: {y_train.shape}")
    print(f"✅ Val:   {X_val.shape} → y_val: {y_val.shape}")
    print(f"✅ Test:  {X_test.shape} → y_test: {y_test.shape}")
    
    # Save label encoder
    label_mapping = {name: int(idx) for idx, name in enumerate(le.classes_)}
    with open(output_dir / "label_encoder.json", 'w') as f:
        json.dump(label_mapping, f, indent=2)
    print(f"✅ Label encoder: {label_mapping}")
    
    # Print stratification check
    print("\n✅ Stratification check (class distribution per split):")
    for split_name, split_y in [("Train", y_train), ("Val", y_val), ("Test", y_test)]:
        print(f"\n   {split_name}:")
        for label in sorted(le.classes_):
            label_idx = label_mapping[label]
            count = (split_y == label_idx).sum()
            pct = (count / len(split_y)) * 100
            print(f"      {label}: {count} ({pct:.1f}%)")
    
    print("\n✨ Preprocessing complete!")
    print("   Next step: Run train_bilstm.py")
    
    return X_train, y_train, X_val, y_val, X_test, y_test, label_mapping

if __name__ == "__main__":
    script_dir = Path(__file__).parent
    raw_data_dir = script_dir.parent / "data-collection" / "dataset" / "processed"
    output_dir = script_dir.parent / "data-collection" / "dataset" / "processed" / "v1"
    
    print("=" * 60)
    print("🔄 Preprocess & Split Dataset")
    print("=" * 60)
    print(f"📂 Input: {raw_data_dir}")
    print(f"📂 Output: {output_dir}\n")
    
    preprocess_and_split(raw_data_dir, output_dir)
