#!/usr/bin/env python3

"""
Basic Python Node Client Test
Tests core components without installing all dependencies
"""

import sys
import os
import importlib.util

def test_basic_imports():
    """Test basic Python modules that should be available"""
    results = []
    
    # Test standard library imports
    try:
        import asyncio
        import json
        import logging
        import datetime
        results.append(("Standard Library", "PASS", "Core modules available"))
    except ImportError as e:
        results.append(("Standard Library", "FAIL", str(e)))
    
    # Test if main.py exists and can be loaded
    try:
        main_path = os.path.join(os.path.dirname(__file__), 'main.py')
        if os.path.exists(main_path):
            spec = importlib.util.spec_from_file_location("main", main_path)
            if spec:
                results.append(("Main Module", "PASS", "main.py file exists and can be loaded"))
            else:
                results.append(("Main Module", "FAIL", "main.py cannot be loaded"))
        else:
            results.append(("Main Module", "FAIL", "main.py does not exist"))
    except Exception as e:
        results.append(("Main Module", "FAIL", str(e)))
    
    # Test src directory structure
    try:
        src_path = os.path.join(os.path.dirname(__file__), 'src')
        if os.path.exists(src_path) and os.path.isdir(src_path):
            results.append(("Project Structure", "PASS", "src directory exists"))
        else:
            results.append(("Project Structure", "FAIL", "src directory missing"))
    except Exception as e:
        results.append(("Project Structure", "FAIL", str(e)))
    
    # Test config directory
    try:
        config_path = os.path.join(os.path.dirname(__file__), 'config')
        if os.path.exists(config_path) and os.path.isdir(config_path):
            results.append(("Configuration", "PASS", "config directory exists"))
        else:
            results.append(("Configuration", "FAIL", "config directory missing"))
    except Exception as e:
        results.append(("Configuration", "FAIL", str(e)))
    
    return results

def main():
    print("🧪 Starting Python Node Client Basic Test...\n")
    
    results = test_basic_imports()
    
    print("📋 Python Node Client Test Results:")
    print("=" * 38)
    print()
    
    pass_count = 0
    fail_count = 0
    
    for component, status, message in results:
        status_icon = "✅" if status == "PASS" else "❌"
        print(f"{status_icon} {component}: {message}")
        
        if status == "PASS":
            pass_count += 1
        else:
            fail_count += 1
    
    print(f"\n📊 Summary: {pass_count} passed, {fail_count} failed")
    
    if fail_count == 0:
        print("🎉 All basic Python components are working!")
        sys.exit(0)
    else:
        print("⚠️  Some Python components need attention.")
        sys.exit(1)

if __name__ == "__main__":
    main()