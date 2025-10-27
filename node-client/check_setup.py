# NeuroGrid Node Client Setup
import sys

# Check Python version
if sys.version_info < (3, 10):
    print("❌ Error: NeuroGrid requires Python 3.10 or higher")
    print(f"📍 Current version: {sys.version}")
    print("🔧 Please upgrade Python: https://python.org/downloads/")
    sys.exit(1)

print("✅ Python version check passed")
print(f"🐍 Using Python {sys.version}")

# Import check for key dependencies
try:
    import torch
    print(f"✅ PyTorch: {torch.__version__}")
    
    if torch.cuda.is_available():
        print(f"🚀 CUDA available: {torch.version.cuda}")
        print(f"🎯 GPU devices: {torch.cuda.device_count()}")
    else:
        print("⚠️  CUDA not available - CPU only mode")
        
except ImportError:
    print("⚠️  PyTorch not installed - install with: pip install torch")

try:
    import transformers
    print(f"✅ Transformers: {transformers.__version__}")
except ImportError:
    print("⚠️  Transformers not installed")

print("\n🌐 NeuroGrid Node Client ready!")
print("🚀 Run: python start_node.py --help")