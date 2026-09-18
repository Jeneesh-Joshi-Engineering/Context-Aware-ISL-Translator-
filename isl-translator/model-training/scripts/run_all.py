"""
Complete quick start script for BiLSTM training pipeline.
Runs all steps in sequence: load → preprocess → train → convert
"""

import subprocess
import sys
from pathlib import Path

def run_command(cmd: list, description: str) -> bool:
    """Run a command and return True if successful."""
    print(f"\n{'='*60}")
    print(f"▶️  {description}")
    print(f"{'='*60}")
    print(f"Command: {' '.join(cmd)}\n")
    
    result = subprocess.run(cmd)
    return result.returncode == 0

def main():
    script_dir = Path(__file__).parent
    
    print("\n" + "="*60)
    print("🚀 ISL BiLSTM Training - Complete Pipeline")
    print("="*60)
    print("\nThis legacy launcher is disabled because it bypasses the versioned validation and deduplication pipeline.")
    print("Use build_dataset.py, then train_bilstm.py. See model-training/README.md.")
    return
    
    steps = [
        (
            [sys.executable, "load_and_merge.py"],
            "Step 1: Loading & Merging Datasets"
        ),
        (
            [sys.executable, "preprocess_and_split.py"],
            "Step 2: Preprocessing & Splitting"
        ),
        (
            [sys.executable, "train_bilstm.py"],
            "Step 3: Training BiLSTM Model"
        ),
        (
            [sys.executable, "convert_to_tfjs.py"],
            "Step 4: Converting to TensorFlow.js"
        ),
    ]
    
    failed_steps = []
    
    for cmd, description in steps:
        success = run_command(cmd, description)
        if not success:
            print(f"\n❌ {description} failed!")
            failed_steps.append(description)
            response = input("\nContinue anyway? (y/n): ")
            if response.lower() != 'y':
                break
    
    print("\n" + "="*60)
    print("✨ Pipeline Complete!")
    print("="*60)
    
    if failed_steps:
        print(f"\n⚠️  {len(failed_steps)} step(s) failed:")
        for step in failed_steps:
            print(f"  ❌ {step}")
        print("\nTroubleshooting:")
        print("  1. Check that all JSON files are in: isl-translator/data-collection/dataset/raw/")
        print("  2. Ensure all sequences are 30 frames long with 126 features")
        print("  3. Install dependencies: pip install tensorflow scikit-learn matplotlib seaborn tensorflowjs")
    else:
        print("\n✅ All steps completed successfully!")
        print("\n📍 Model outputs:")
        print(f"  - Trained model: isl-translator/model-training/saved_model/v1/model.h5")
        print(f"  - TensorFlow.js: isl-translator/frontend/model/")
        print("\n🎯 Next steps:")
        print("  1. Copy isl-translator/frontend/model/ to your web server")
        print("  2. Update frontend/js/main.js to load the model")
        print("  3. Test in-browser inference")

if __name__ == "__main__":
    main()
