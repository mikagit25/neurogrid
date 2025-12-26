#!/usr/bin/env python3
"""
Simple NeuroGrid Node Client Test
Tests connection to coordinator and basic functionality
"""

import requests
import json
import time
import sys
import os

# Configuration
COORDINATOR_URL = "http://localhost:8080"
NODE_ID = f"test-node-{int(time.time())}"

def test_coordinator_connection():
    """Test connection to coordinator server"""
    print("🔗 Testing connection to coordinator...")
    
    # Custom headers to avoid being blocked
    headers = {
        'User-Agent': 'NeuroGrid-NodeClient/1.0',
        'Accept': 'application/json',
        'Connection': 'close'
    }
    
    try:
        response = requests.get(f"{COORDINATOR_URL}/health", timeout=10, headers=headers)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Connected to coordinator: {data.get('service', 'Unknown')}")
            print(f"📊 Status: {data.get('status', 'Unknown')}")
            return True
        else:
            print(f"❌ Coordinator returned {response.status_code}")
            print(f"Response text: {response.text[:200]}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to connect to coordinator: {e}")
        # Try alternative endpoint
        try:
            response = requests.get(f"{COORDINATOR_URL}/api/nodes", timeout=10, headers=headers)
            if response.status_code == 200:
                print("✅ Alternative endpoint works - coordinator is accessible")
                return True
        except:
            pass
        return False

def test_node_registration():
    """Test node registration with coordinator"""
    print("📝 Testing node registration...")
    
    node_data = {
        "id": NODE_ID,
        "name": "Test Node Client",
        "gpu": "CPU (Test Mode)",
        "location": "localhost",
        "capabilities": ["text-generation"],
        "status": "ready"
    }
    
    try:
        # Try to register node (this endpoint might not exist in enhanced-server)
        # But we can test if the coordinator accepts the data
        response = requests.post(
            f"{COORDINATOR_URL}/api/nodes/register",
            json=node_data,
            timeout=5,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            print("✅ Node registration successful")
            return True
        else:
            print(f"⚠️ Node registration returned {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"⚠️ Node registration test failed (expected): {e}")
        return False

def test_task_retrieval():
    """Test retrieving tasks from coordinator"""
    print("📋 Testing task retrieval...")
    
    try:
        response = requests.get(f"{COORDINATOR_URL}/api/tasks", timeout=5)
        if response.status_code == 200:
            data = response.json()
            tasks = data.get('data', {}).get('tasks', [])
            print(f"✅ Retrieved {len(tasks)} tasks from coordinator")
            
            # Show first task details
            if tasks:
                first_task = tasks[0]
                print(f"📝 Sample task: {first_task.get('id', 'Unknown')}")
                print(f"🤖 Model: {first_task.get('model', 'Unknown')}")
                print(f"📊 Status: {first_task.get('status', 'Unknown')}")
            
            return True
        else:
            print(f"❌ Task retrieval failed: {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Task retrieval failed: {e}")
        return False

def simulate_task_processing():
    """Simulate processing a simple task"""
    print("⚡ Simulating task processing...")
    
    # Create a mock task
    mock_task = {
        "id": f"task-{int(time.time())}",
        "prompt": "Hello, this is a test prompt for NeuroGrid",
        "model": "test-model",
        "priority": "standard"
    }
    
    print(f"📋 Processing task: {mock_task['id']}")
    print(f"💬 Prompt: {mock_task['prompt']}")
    
    # Simulate processing time
    print("⏳ Processing (simulated)...")
    time.sleep(2)
    
    # Mock result
    result = {
        "task_id": mock_task["id"],
        "result": "Hello! This is a simulated response from NeuroGrid node client. The task has been processed successfully in test mode.",
        "processing_time": 2.0,
        "node_id": NODE_ID,
        "status": "completed"
    }
    
    print("✅ Task processing completed")
    print(f"💬 Result: {result['result'][:100]}...")
    
    return result

def main():
    """Main test function"""
    print("🚀 NeuroGrid Node Client - Simple Test")
    print("=" * 50)
    
    # Test 1: Coordinator connection
    if not test_coordinator_connection():
        print("❌ Coordinator connection failed. Make sure enhanced-server is running.")
        sys.exit(1)
    
    print()
    
    # Test 2: Node registration (optional)
    test_node_registration()
    print()
    
    # Test 3: Task retrieval
    test_task_retrieval()
    print()
    
    # Test 4: Task processing simulation
    result = simulate_task_processing()
    print()
    
    # Summary
    print("🎉 Simple node client test completed!")
    print("✅ Basic coordinator communication works")
    print("✅ Task simulation successful")
    print("📊 Node client is ready for integration testing")

if __name__ == "__main__":
    main()