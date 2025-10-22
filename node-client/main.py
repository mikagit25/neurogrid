#!/usr/bin/env python3
"""
NeuroGrid Node Client - Main Entry Point

This is the main application file for the NeuroGrid node client.
It initializes and runs the core agent that participates in the distributed AI inference network.
"""

import sys
import os
import argparse
import asyncio
import logging
import signal
from pathlib import Path

# Add src directory to Python path
sys.path.insert(0, str(Path(__file__).parent / 'src'))

from src.core.agent import NodeAgent
from src.core.config import ConfigManager
from src.utils.logger import setup_logging
from src.utils.system_check import SystemChecker


def setup_argument_parser():
    """Set up command line argument parser."""
    parser = argparse.ArgumentParser(
        description='NeuroGrid Node Client - Distributed AI Inference Node',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python main.py                           # Run with default config
  python main.py --config custom.json     # Run with custom config
  python main.py --check-requirements     # Check system requirements
  python main.py --test-config           # Test configuration
  python main.py --log-level DEBUG       # Run with debug logging
        """
    )
    
    parser.add_argument(
        '--config', '-c',
        type=str,
        default='config/config.json',
        help='Path to configuration file (default: config/config.json)'
    )
    
    parser.add_argument(
        '--log-level', '-l',
        type=str,
        choices=['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'],
        default='INFO',
        help='Set logging level (default: INFO)'
    )
    
    parser.add_argument(
        '--check-requirements',
        action='store_true',
        help='Check system requirements and exit'
    )
    
    parser.add_argument(
        '--test-config',
        action='store_true',
        help='Test configuration and exit'
    )
    
    parser.add_argument(
        '--status',
        action='store_true',
        help='Show node status and exit'
    )
    
    parser.add_argument(
        '--daemon', '-d',
        action='store_true',
        help='Run as daemon process'
    )
    
    parser.add_argument(
        '--pid-file',
        type=str,
        default='neurogrid-node.pid',
        help='PID file path for daemon mode'
    )
    
    return parser


def check_system_requirements():
    """Check if system meets minimum requirements."""
    print("🔍 Checking system requirements...")
    
    checker = SystemChecker()
    results = checker.check_all()
    
    print("\n📋 System Requirements Check:")
    print("=" * 50)
    
    all_passed = True
    for category, checks in results.items():
        print(f"\n{category.upper()}:")
        for check_name, result in checks.items():
            status = "✅ PASS" if result['passed'] else "❌ FAIL"
            print(f"  {check_name}: {status}")
            if 'message' in result:
                print(f"    {result['message']}")
            if not result['passed']:
                all_passed = False
    
    print("\n" + "=" * 50)
    if all_passed:
        print("🎉 All requirements met! Ready to run NeuroGrid node.")
        return True
    else:
        print("⚠️  Some requirements not met. Please fix issues above.")
        return False


def test_configuration(config_path: str):
    """Test configuration file."""
    print(f"🔧 Testing configuration: {config_path}")
    
    try:
        config_manager = ConfigManager()
        config = config_manager.load_config(config_path)
        
        print("✅ Configuration file loaded successfully")
        print("\n📋 Configuration Summary:")
        print("=" * 50)
        
        # Display key configuration values
        key_configs = [
            ('coordinator_url', 'Coordinator URL'),
            ('max_vram_gb', 'Max VRAM (GB)'),
            ('max_cpu_cores', 'Max CPU Cores'),
            ('supported_models', 'Supported Models'),
            ('enable_docker', 'Docker Enabled'),
            ('log_level', 'Log Level')
        ]
        
        for key, display_name in key_configs:
            value = config.get(key, 'Not set')
            print(f"  {display_name}: {value}")
        
        # Validate configuration
        validation_errors = config_manager.validate_config(config)
        if validation_errors:
            print("\n⚠️  Configuration Issues:")
            for error in validation_errors:
                print(f"  - {error}")
            return False
        else:
            print("\n🎉 Configuration is valid!")
            return True
            
    except Exception as e:
        print(f"❌ Configuration error: {e}")
        return False


def show_node_status():
    """Show current node status."""
    print("📊 NeuroGrid Node Status")
    print("=" * 50)
    
    # Check if node is running
    pid_file = Path('neurogrid-node.pid')
    if pid_file.exists():
        try:
            with open(pid_file, 'r') as f:
                pid = int(f.read().strip())
            
            # Check if process is actually running
            try:
                os.kill(pid, 0)  # Send signal 0 to check if process exists
                print(f"🟢 Node is RUNNING (PID: {pid})")
            except OSError:
                print("🔴 Node is STOPPED (stale PID file)")
                pid_file.unlink()  # Remove stale PID file
        except (ValueError, FileNotFoundError):
            print("🔴 Node is STOPPED")
    else:
        print("🔴 Node is STOPPED")
    
    # Show system resources
    try:
        import psutil
        import GPUtil
        
        print(f"\n💻 System Resources:")
        print(f"  CPU Usage: {psutil.cpu_percent()}%")
        print(f"  Memory Usage: {psutil.virtual_memory().percent}%")
        print(f"  Disk Usage: {psutil.disk_usage('/').percent}%")
        
        gpus = GPUtil.getGPUs()
        if gpus:
            print(f"\n🎮 GPU Status:")
            for i, gpu in enumerate(gpus):
                print(f"  GPU {i}: {gpu.name}")
                print(f"    Memory: {gpu.memoryUsed}MB / {gpu.memoryTotal}MB ({gpu.memoryUtil*100:.1f}%)")
                print(f"    Load: {gpu.load*100:.1f}%")
                print(f"    Temperature: {gpu.temperature}°C")
        
    except ImportError:
        print("\n⚠️  psutil or GPUtil not installed - cannot show detailed system status")


async def run_node_agent(config_path: str, log_level: str):
    """Run the main node agent."""
    
    # Setup logging
    setup_logging(log_level)
    logger = logging.getLogger(__name__)
    
    logger.info("🚀 Starting NeuroGrid Node Client")
    logger.info(f"📁 Config file: {config_path}")
    logger.info(f"📊 Log level: {log_level}")
    
    try:
        # Load configuration
        config_manager = ConfigManager()
        config = config_manager.load_config(config_path)
        
        # Create and initialize node agent
        agent = NodeAgent(config)
        
        # Setup signal handlers for graceful shutdown
        def signal_handler(signum, frame):
            logger.info(f"🛑 Received signal {signum}, initiating graceful shutdown...")
            asyncio.create_task(agent.stop())
        
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
        
        # Start the agent
        await agent.start()
        
        # Keep running until stopped
        await agent.wait_for_shutdown()
        
    except KeyboardInterrupt:
        logger.info("🛑 Shutdown requested by user")
    except Exception as e:
        logger.error(f"❌ Fatal error: {e}", exc_info=True)
        return 1
    
    logger.info("👋 NeuroGrid Node Client stopped")
    return 0


def create_daemon_process(config_path: str, log_level: str, pid_file: str):
    """Create daemon process (Unix only)."""
    if os.name == 'nt':
        print("❌ Daemon mode not supported on Windows. Use --service instead.")
        return 1
    
    try:
        # Fork first child
        pid = os.fork()
        if pid > 0:
            # Parent process
            return 0
    except OSError as e:
        print(f"❌ Fork failed: {e}")
        return 1
    
    # Decouple from parent environment
    os.chdir('/')
    os.setsid()
    os.umask(0)
    
    # Fork second child
    try:
        pid = os.fork()
        if pid > 0:
            # Second parent
            sys.exit(0)
    except OSError as e:
        print(f"❌ Second fork failed: {e}")
        sys.exit(1)
    
    # Write PID file
    with open(pid_file, 'w') as f:
        f.write(str(os.getpid()))
    
    # Redirect standard file descriptors
    sys.stdout.flush()
    sys.stderr.flush()
    
    with open(os.devnull, 'r') as dev_null:
        os.dup2(dev_null.fileno(), sys.stdin.fileno())
    
    with open('logs/node.log', 'a') as log_file:
        os.dup2(log_file.fileno(), sys.stdout.fileno())
        os.dup2(log_file.fileno(), sys.stderr.fileno())
    
    # Run the main function
    return asyncio.run(run_node_agent(config_path, log_level))


def main():
    """Main entry point."""
    parser = setup_argument_parser()
    args = parser.parse_args()
    
    # Ensure required directories exist
    Path('logs').mkdir(exist_ok=True)
    Path('data').mkdir(exist_ok=True)
    Path('config').mkdir(exist_ok=True)
    
    # Handle special commands
    if args.check_requirements:
        success = check_system_requirements()
        return 0 if success else 1
    
    if args.test_config:
        success = test_configuration(args.config)
        return 0 if success else 1
    
    if args.status:
        show_node_status()
        return 0
    
    # Check if config file exists
    if not Path(args.config).exists():
        print(f"❌ Configuration file not found: {args.config}")
        print("📝 Create a configuration file from the example:")
        print(f"   cp config/config.example.json {args.config}")
        return 1
    
    # Run in daemon mode if requested
    if args.daemon:
        return create_daemon_process(args.config, args.log_level, args.pid_file)
    
    # Run normally
    try:
        return asyncio.run(run_node_agent(args.config, args.log_level))
    except KeyboardInterrupt:
        print("\n👋 Shutdown requested by user")
        return 0
    except Exception as e:
        print(f"❌ Fatal error: {e}")
        return 1


if __name__ == '__main__':
    exit_code = main()
    sys.exit(exit_code)