"""
Setup script: Check dependencies, create directories, prepare environment.
Run this BEFORE running the main training pipeline.
"""

import subprocess
import sys
from pathlib import Path

def check_python_version():
    """Ensure Python 3.8+"""
    version = sys.version_info
    if version.major < 3 or (version.major == 3 and version.minor < 8):
        print(f"❌ Python 3.8+ required (you have {version.major}.{version.minor})")
        return False
    print(f"✅ Python {version.major}.{version.minor}")
    return True

def check_package(package_name: str, import_name: str = None) -> bool:
    """Check if a package is installed."""
    if import_name is None:
        import_name = package_name.replace("-", "_")
    
    try:
        __import__(import_name)
        print(f"✅ {package_name}")
        return True
    except ImportError:
        print(f"❌ {package_name} (install with: pip install {package_name})")
        return False

def create_directories(base_dir: Path):
    """Create necessary directory structure."""
    dirs = [
        base_dir / "data-collection" / "dataset" / "raw",
        base_dir / "data-collection" / "dataset" / "processed",
        base_dir / "model-training" / "saved_model",
        base_dir / "frontend" / "model",
    ]
    
    for d in dirs:
        d.mkdir(parents=True, exist_ok=True)
        print(f"✅ {d.relative_to(base_dir)}")

def main():
    print("\n" + "="*60)
    print("🔧 ISL BiLSTM Training - Setup & Verification")
    print("="*60)
    
    # Check Python version
    print("\n📋 Checking Python version...")
    if not check_python_version():
        return False
    
    # Check required packages
    print("\n📦 Checking required packages...")
    packages = [
        ("numpy", "numpy"),
        ("tensorflow", "tensorflow"),
        ("scikit-learn", "sklearn"),
        ("matplotlib", "matplotlib"),
        ("seaborn", "seaborn"),
        ("tensorflowjs", "tensorflowjs"),
    ]
    
    missing = []
    for pkg, import_name in packages:
        if not check_package(pkg, import_name):
            missing.append(pkg)
    
    if missing:
        print(f"\n⚠️  Missing packages: {', '.join(missing)}")
        response = input("Install now? (y/n): ")
        if response.lower() == 'y':
            print(f"\n📥 Installing: pip install {' '.join(missing)}")
            result = subprocess.run([sys.executable, "-m", "pip", "install"] + missing)
            if result.returncode != 0:
                print("❌ Installation failed!")
                return False
            print("✅ Installation complete")
        else:
            print("⚠️  Skipped installation. You may encounter errors.")
    else:
        print("✅ All packages installed")
    
    # Create directory structure
    print("\n📁 Creating directory structure...")
    script_dir = Path(__file__).parent.parent.parent  # Go up to isl-translator/
    create_directories(script_dir)
    
    # Check for dataset files
    print("\n📊 Checking for dataset files...")
    raw_dir = script_dir / "data-collection" / "dataset" / "raw"
    json_files = [path for path in raw_dir.rglob("*.json") if path.is_file()]
    
    if json_files:
        print(f"✅ Found {len(json_files)} JSON file(s):")
        for f in sorted(json_files):
            size_mb = f.stat().st_size / (1024 * 1024)
            print(f"   - {f.relative_to(raw_dir)} ({size_mb:.2f} MB)")
    else:
        print(f"⚠️  No JSON files found in {raw_dir}")
        print("   Place your exported gesture JSON files there before training")
    
    # Final summary
    print("\n" + "="*60)
    print("✨ Setup Complete!")
    print("="*60)
    print("\n🚀 Next steps:")
    print("   1. Place all exported gesture JSON files in:")
    print(f"      {raw_dir}")
    print("   2. Run the training pipeline:")
    print("      python run_all.py")
    print("\n📚 For more details, see: BILSTM_TRAINING_ROADMAP.md")
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
