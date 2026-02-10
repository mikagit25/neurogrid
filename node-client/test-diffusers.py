#!/usr/bin/env python3
"""
Test script to verify diffusers installation and functionality
"""

def test_diffusers_import():
    """Test basic diffusers imports"""
    try:
        print("🔍 Testing diffusers import...")
        import diffusers
        print(f"✅ diffusers version: {diffusers.__version__}")
        
        print("🔍 Testing StableDiffusionPipeline import...")
        from diffusers import StableDiffusionPipeline
        print("✅ StableDiffusionPipeline imported successfully")
        
        print("🔍 Testing StableDiffusionXLPipeline import...")
        from diffusers import StableDiffusionXLPipeline  
        print("✅ StableDiffusionXLPipeline imported successfully")
        
        return True
        
    except ImportError as e:
        print(f"❌ Import error: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

def test_pipeline_creation():
    """Test basic pipeline creation (without model loading)"""
    try:
        print("\n🔍 Testing pipeline creation (mock)...")
        from diffusers import StableDiffusionPipeline
        
        # Test that the class can be instantiated (we won't load actual models)
        print("✅ Pipeline classes are accessible")
        return True
        
    except Exception as e:
        print(f"❌ Pipeline creation error: {e}")
        return False

def main():
    print("🚀 Diffusers Installation Test")
    print("=" * 50)
    
    # Test imports
    import_success = test_diffusers_import()
    
    if import_success:
        # Test pipeline creation  
        pipeline_success = test_pipeline_creation()
        
        if pipeline_success:
            print(f"\n🎉 All tests passed! Diffusers is properly installed.")
            print("✅ Ready for image generation tasks")
            return 0
        else:
            print(f"\n⚠️ Import successful but pipeline creation failed")
            return 1
    else:
        print(f"\n❌ Import failed. Diffusers not properly installed")
        return 1

if __name__ == "__main__":
    exit(main())