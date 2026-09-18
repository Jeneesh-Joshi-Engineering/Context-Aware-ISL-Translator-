"""
Convert trained Keras model to TensorFlow.js format.
Requires: pip install tensorflowjs
"""

import subprocess
import shutil
from pathlib import Path
import json

def convert_to_tfjs(saved_model_dir: Path, output_dir: Path):
    """
    Convert Keras model to TensorFlow.js format.
    
    Inputs:
    - saved_model_dir: folder with model.h5
    
    Outputs:
    - output_dir: folder with model.json + model.weights.bin
    """
    
    model_h5 = saved_model_dir / "model.h5"
    metadata_json = saved_model_dir / "model_metadata.json"
    
    if not model_h5.exists():
        print(f"❌ Model file not found: {model_h5}")
        return False
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print("=" * 60)
    print("🔄 Converting Keras Model to TensorFlow.js")
    print("=" * 60)
    print(f"\n📂 Input:  {model_h5}")
    print(f"📂 Output: {output_dir}")
    
    # Check if tensorflowjs_converter is installed
    converter_path = shutil.which("tensorflowjs_converter")
    if not converter_path:
        print("\n❌ tensorflowjs_converter not found!")
        print("   Install it with: pip install tensorflowjs")
        return False
    
    print(f"\n✅ Using: {converter_path}")
    
    # Convert
    print("\n🔄 Converting (this may take 1–2 minutes)...")
    cmd = [
        "tensorflowjs_converter",
        "--input_format=keras",
        "--output_format=tfjs_graph_model",
        str(model_h5),
        str(output_dir)
    ]
    
    print(f"   Command: {' '.join(cmd)}\n")
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode != 0:
        print("❌ Conversion failed!")
        print("\nError output:")
        print(result.stderr)
        return False
    
    print(result.stdout)
    
    # Copy metadata file for frontend reference
    if metadata_json.exists():
        print("\n📋 Copying metadata...")
        shutil.copy(metadata_json, output_dir / "model_metadata.json")
        print(f"✅ Copied: {output_dir / 'model_metadata.json'}")
    
    # List generated files
    print("\n✅ Conversion successful!")
    print("\n📦 Generated files:")
    for f in sorted(output_dir.glob("*")):
        if f.is_file():
            size_mb = f.stat().st_size / (1024 * 1024)
            print(f"   - {f.name} ({size_mb:.2f} MB)")
    
    print("\n" + "=" * 60)
    print("✨ Ready for browser!")
    print("=" * 60)
    print(f"\n📍 TensorFlow.js model location:")
    print(f"   {output_dir}")
    print(f"\nIn your frontend HTML/JS, load with:")
    print(f"   const model = await tf.loadLayersModel('file://{output_dir}/model.json');")
    print(f"\nOr copy the entire folder to your web server and use:")
    print(f"   const model = await tf.loadLayersModel('model/model.json');")
    
    return True

if __name__ == "__main__":
    script_dir = Path(__file__).parent
    saved_model_dir = script_dir.parent / "saved_model" / "v1"
    output_dir = script_dir.parent.parent / "frontend" / "model"
    
    if not saved_model_dir.exists():
        print(f"❌ Saved model directory not found: {saved_model_dir}")
        print("   Run train_bilstm.py first!")
        exit(1)
    
    success = convert_to_tfjs(saved_model_dir, output_dir)
    exit(0 if success else 1)
