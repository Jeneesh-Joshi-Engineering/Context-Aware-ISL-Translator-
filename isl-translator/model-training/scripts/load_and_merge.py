"""
Load and merge all JSON gesture datasets from raw directory.
Combines multiple JSON exports into a single training dataset.
"""

import json
import numpy as np
from pathlib import Path
from typing import List, Dict, Tuple

def load_json_sequences(json_file: Path) -> List[Dict]:
    """Load sequences from a single JSON export file."""
    try:
        with open(json_file, 'r') as f:
            data = json.load(f)
        return data.get('sequences', [])
    except Exception as e:
        print(f"  ⚠️  Error loading {json_file.name}: {e}")
        return []

def merge_all_sessions(raw_dir: Path) -> Tuple[np.ndarray, np.ndarray, List[str]]:
    """
    Merge all JSON files in raw_dir into:
    - X: array of shape (num_sequences, 30, 126) - landmark frames
    - y: array of labels (strings)
    - all_labels: unique label names
    """
    all_sequences = []
    all_labels = []
    skipped = 0
    
    # Legacy path: recursive so person/session folders are not silently skipped.
    json_files = [path for path in raw_dir.rglob('*.json') if path.is_file()]
    if not json_files:
        print(f"❌ No JSON files found in {raw_dir}")
        return None, None, None
    
    # Load all JSON files
    for json_file in sorted(json_files):
        print(f"📂 Loading {json_file.name}...")
        sequences = load_json_sequences(json_file)
        
        for seq in sequences:
            try:
                frames = np.array(seq['frames'], dtype=np.float32)  # Shape: (30, 126)
                label = seq['label'].lower().strip()
                
                if frames.shape != (30, 126):
                    print(f"     ⚠️  Skipping '{label}': expected (30, 126), got {frames.shape}")
                    skipped += 1
                    continue
                
                # Check for all-zero frames (no hand detected)
                if np.allclose(frames, 0):
                    print(f"     ⚠️  Skipping '{label}': all landmarks are zero (hand not detected)")
                    skipped += 1
                    continue
                
                all_sequences.append(frames)
                all_labels.append(label)
            except Exception as e:
                print(f"     ⚠️  Error processing sequence: {e}")
                skipped += 1
                continue
    
    if not all_sequences:
        print(f"❌ No valid sequences found after processing!")
        return None, None, None
    
    X = np.array(all_sequences, dtype=np.float32)  # Shape: (num_seq, 30, 126)
    y = np.array(all_labels, dtype=str)
    unique_labels = sorted(np.unique(y))
    
    print(f"\n✅ Merged dataset shape: X={X.shape}, y={y.shape}")
    print(f"   Sequences loaded: {len(all_sequences)}")
    print(f"   Sequences skipped: {skipped}")
    print(f"\n✅ Unique gestures: {unique_labels}")
    print(f"\n✅ Class distribution:")
    for label in unique_labels:
        count = (y == label).sum()
        percentage = (count / len(y)) * 100
        print(f"   {label}: {count} sequences ({percentage:.1f}%)")
    
    return X, y, list(unique_labels)

if __name__ == "__main__":
    # Define paths relative to this script
    script_dir = Path(__file__).parent
    raw_dir = script_dir.parent / "data-collection" / "dataset" / "raw"
    processed_dir = script_dir.parent / "data-collection" / "dataset" / "processed"
    
    # Create processed directory if needed
    processed_dir.mkdir(parents=True, exist_ok=True)
    
    print("=" * 60)
    print("📊 ISL Dataset Loader & Merger")
    print("=" * 60)
    print(f"📂 Raw data directory: {raw_dir}")
    print(f"📂 Output directory: {processed_dir}\n")
    
    # Load and merge
    X, y, labels = merge_all_sessions(raw_dir)
    
    if X is not None:
        # Save intermediate merged data
        print("\n💾 Saving merged data...")
        np.save(processed_dir / "X_merged.npy", X)
        np.save(processed_dir / "y_merged.npy", y)
        with open(processed_dir / "labels.json", 'w') as f:
            json.dump(labels, f, indent=2)
        print(f"✅ X_merged.npy: {X.shape}")
        print(f"✅ y_merged.npy: {y.shape}")
        print(f"✅ labels.json: {len(labels)} classes")
        print("\n✨ Ready for preprocessing! Run: python preprocess_and_split.py")
    else:
        print("\n❌ Failed to load dataset. Check that JSON files are in:")
        print(f"   {raw_dir}")
