"""
System Requirements Checker for NeuroGrid Node Client

This module checks if the system meets the minimum requirements
to run as a NeuroGrid node.
"""

import platform
import psutil
import subprocess
import sys
from pathlib import Path
from typing import Dict, Any, List
import json

try:
    import GPUtil
    GPU_UTIL_AVAILABLE = True
except ImportError:
    GPU_UTIL_AVAILABLE = False

try:
    import torch
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

try:
    import docker
    DOCKER_AVAILABLE = True
except ImportError:
    DOCKER_AVAILABLE = False


class SystemChecker:
    """Check system requirements for NeuroGrid node."""
    
    def __init__(self):
        self.requirements = self._get_requirements()
    
    def _get_requirements(self) -> Dict[str, Any]:
        """Get minimum system requirements."""
        return {
            'python': {
                'min_version': (3, 8),
                'description': 'Python 3.8 or higher'
            },
            'memory': {
                'min_gb': 8,
                'recommended_gb': 16,
                'description': 'RAM memory'
            },
            'storage': {
                'min_gb': 50,
                'recommended_gb': 100,
                'description': 'Free disk space for models and data'
            },
            'gpu': {
                'min_vram_gb': 4,
                'recommended_vram_gb': 8,
                'description': 'GPU with VRAM (optional but recommended)'
            },
            'network': {
                'min_mbps': 10,
                'description': 'Stable internet connection'
            },
            'dependencies': {
                'torch': 'PyTorch for AI model execution',
                'docker': 'Docker for secure task isolation (optional)',
                'gpu_util': 'GPU monitoring utilities'
            }
        }
    
    def check_all(self) -> Dict[str, Dict[str, Any]]:
        """Run all system checks."""
        results = {
            'system': self.check_system_info(),
            'python': self.check_python(),
            'memory': self.check_memory(),
            'storage': self.check_storage(),
            'gpu': self.check_gpu(),
            'network': self.check_network(),
            'dependencies': self.check_dependencies()
        }
        
        return results
    
    def check_system_info(self) -> Dict[str, Any]:
        """Check basic system information."""
        results = {}
        
        try:
            # Operating System
            os_info = {
                'system': platform.system(),
                'release': platform.release(),
                'version': platform.version(),
                'machine': platform.machine(),
                'processor': platform.processor()
            }
            
            supported_os = ['Windows', 'Linux', 'Darwin']  # Darwin = macOS
            os_supported = platform.system() in supported_os
            
            results['operating_system'] = {
                'passed': os_supported,
                'info': os_info,
                'message': f"OS: {platform.system()} {platform.release()}"
            }
            
            # CPU Information
            cpu_count = psutil.cpu_count(logical=False)  # Physical cores
            cpu_count_logical = psutil.cpu_count(logical=True)  # Logical cores
            
            results['cpu'] = {
                'passed': cpu_count >= 2,
                'physical_cores': cpu_count,
                'logical_cores': cpu_count_logical,
                'message': f"CPU: {cpu_count} physical cores, {cpu_count_logical} logical cores"
            }
            
        except Exception as e:
            results['system_error'] = {
                'passed': False,
                'message': f"Error checking system info: {e}"
            }
        
        return results
    
    def check_python(self) -> Dict[str, Any]:
        """Check Python version."""
        current_version = sys.version_info[:2]
        min_version = self.requirements['python']['min_version']
        
        version_ok = current_version >= min_version
        
        return {
            'version_check': {
                'passed': version_ok,
                'current': f"{current_version[0]}.{current_version[1]}",
                'required': f"{min_version[0]}.{min_version[1]}+",
                'message': f"Python {current_version[0]}.{current_version[1]} ({'✓' if version_ok else '✗'} >= {min_version[0]}.{min_version[1]})"
            }
        }
    
    def check_memory(self) -> Dict[str, Any]:
        """Check system memory."""
        memory = psutil.virtual_memory()
        total_gb = memory.total / (1024**3)
        available_gb = memory.available / (1024**3)
        
        min_gb = self.requirements['memory']['min_gb']
        recommended_gb = self.requirements['memory']['recommended_gb']
        
        meets_minimum = total_gb >= min_gb
        meets_recommended = total_gb >= recommended_gb
        
        return {
            'total_memory': {
                'passed': meets_minimum,
                'total_gb': round(total_gb, 1),
                'available_gb': round(available_gb, 1),
                'min_required_gb': min_gb,
                'recommended_gb': recommended_gb,
                'meets_recommended': meets_recommended,
                'message': f"RAM: {total_gb:.1f}GB total, {available_gb:.1f}GB available"
            }
        }
    
    def check_storage(self) -> Dict[str, Any]:
        """Check available disk space."""
        try:
            # Check current directory disk space
            current_path = Path.cwd()
            disk_usage = psutil.disk_usage(current_path)
            
            free_gb = disk_usage.free / (1024**3)
            total_gb = disk_usage.total / (1024**3)
            
            min_gb = self.requirements['storage']['min_gb']
            recommended_gb = self.requirements['storage']['recommended_gb']
            
            meets_minimum = free_gb >= min_gb
            meets_recommended = free_gb >= recommended_gb
            
            return {
                'disk_space': {
                    'passed': meets_minimum,
                    'free_gb': round(free_gb, 1),
                    'total_gb': round(total_gb, 1),
                    'min_required_gb': min_gb,
                    'recommended_gb': recommended_gb,
                    'meets_recommended': meets_recommended,
                    'message': f"Storage: {free_gb:.1f}GB free of {total_gb:.1f}GB total"
                }
            }
            
        except Exception as e:
            return {
                'disk_space': {
                    'passed': False,
                    'message': f"Error checking disk space: {e}"
                }
            }
    
    def check_gpu(self) -> Dict[str, Any]:
        """Check GPU availability and specifications."""
        results = {}
        
        # Check if GPU utilities are available
        if not GPU_UTIL_AVAILABLE:
            results['gpu_util'] = {
                'passed': False,
                'message': "GPUtil not installed. Install with: pip install gputil"
            }
            return results
        
        try:
            gpus = GPUtil.getGPUs()
            
            if not gpus:
                results['gpu_detection'] = {
                    'passed': False,
                    'message': "No CUDA GPUs detected. Node can run on CPU only."
                }
                return results
            
            # Check each GPU
            for i, gpu in enumerate(gpus):
                gpu_info = {
                    'name': gpu.name,
                    'memory_total_gb': round(gpu.memoryTotal / 1024, 1),
                    'memory_free_gb': round(gpu.memoryFree / 1024, 1),
                    'memory_used_gb': round(gpu.memoryUsed / 1024, 1),
                    'load_percent': round(gpu.load * 100, 1),
                    'temperature': gpu.temperature
                }
                
                min_vram = self.requirements['gpu']['min_vram_gb']
                recommended_vram = self.requirements['gpu']['recommended_vram_gb']
                
                meets_minimum = gpu_info['memory_total_gb'] >= min_vram
                meets_recommended = gpu_info['memory_total_gb'] >= recommended_vram
                
                results[f'gpu_{i}'] = {
                    'passed': meets_minimum,
                    'info': gpu_info,
                    'meets_recommended': meets_recommended,
                    'message': f"GPU {i}: {gpu.name} - {gpu_info['memory_total_gb']}GB VRAM"
                }
            
            # Overall GPU check
            any_gpu_suitable = any(
                result['passed'] for key, result in results.items() 
                if key.startswith('gpu_')
            )
            
            results['gpu_overall'] = {
                'passed': any_gpu_suitable,
                'gpu_count': len(gpus),
                'message': f"Found {len(gpus)} GPU(s), {sum(1 for k, v in results.items() if k.startswith('gpu_') and v['passed'])} suitable"
            }
            
        except Exception as e:
            results['gpu_error'] = {
                'passed': False,
                'message': f"Error checking GPU: {e}"
            }
        
        return results
    
    def check_network(self) -> Dict[str, Any]:
        """Check network connectivity."""
        results = {}
        
        # Basic connectivity test
        try:
            import socket
            socket.create_connection(("8.8.8.8", 53), timeout=3)
            results['connectivity'] = {
                'passed': True,
                'message': "Internet connectivity: OK"
            }
        except Exception:
            results['connectivity'] = {
                'passed': False,
                'message': "No internet connectivity detected"
            }
        
        # Network interface check
        try:
            network_stats = psutil.net_if_stats()
            active_interfaces = [
                name for name, stats in network_stats.items() 
                if stats.isup and not name.startswith('lo')
            ]
            
            results['interfaces'] = {
                'passed': len(active_interfaces) > 0,
                'active_interfaces': active_interfaces,
                'message': f"Active network interfaces: {len(active_interfaces)}"
            }
            
        except Exception as e:
            results['interfaces'] = {
                'passed': False,
                'message': f"Error checking network interfaces: {e}"
            }
        
        return results
    
    def check_dependencies(self) -> Dict[str, Any]:
        """Check required Python dependencies."""
        results = {}
        
        # PyTorch check
        if TORCH_AVAILABLE:
            try:
                import torch
                cuda_available = torch.cuda.is_available()
                cuda_devices = torch.cuda.device_count() if cuda_available else 0
                
                results['pytorch'] = {
                    'passed': True,
                    'version': torch.__version__,
                    'cuda_available': cuda_available,
                    'cuda_devices': cuda_devices,
                    'message': f"PyTorch {torch.__version__} (CUDA: {'Yes' if cuda_available else 'No'})"
                }
            except Exception as e:
                results['pytorch'] = {
                    'passed': False,
                    'message': f"PyTorch error: {e}"
                }
        else:
            results['pytorch'] = {
                'passed': False,
                'message': "PyTorch not installed. Install with: pip install torch"
            }
        
        # Docker check
        if DOCKER_AVAILABLE:
            try:
                client = docker.from_env()
                client.ping()
                
                results['docker'] = {
                    'passed': True,
                    'message': "Docker is available and running"
                }
            except Exception as e:
                results['docker'] = {
                    'passed': False,
                    'message': f"Docker error: {e}"
                }
        else:
            results['docker'] = {
                'passed': False,
                'message': "Docker not available. Install Docker for enhanced security."
            }
        
        # Check other dependencies
        dependencies = [
            ('aiohttp', 'HTTP client library'),
            ('websockets', 'WebSocket support'),
            ('psutil', 'System monitoring'),
            ('cryptography', 'Encryption support'),
            ('Pillow', 'Image processing'),
        ]
        
        for package, description in dependencies:
            try:
                __import__(package)
                results[package] = {
                    'passed': True,
                    'message': f"{package}: Available"
                }
            except ImportError:
                results[package] = {
                    'passed': False,
                    'message': f"{package}: Not installed ({description})"
                }
        
        return results
    
    def generate_report(self, results: Dict[str, Dict[str, Any]]) -> str:
        """Generate a human-readable report."""
        report_lines = [
            "NeuroGrid Node System Requirements Report",
            "=" * 50,
            f"Generated: {psutil.boot_time()}",
            ""
        ]
        
        # Summary
        all_checks = []
        for category_results in results.values():
            for check_result in category_results.values():
                if isinstance(check_result, dict) and 'passed' in check_result:
                    all_checks.append(check_result['passed'])
        
        passed_count = sum(all_checks)
        total_count = len(all_checks)
        
        report_lines.extend([
            f"Overall Status: {passed_count}/{total_count} checks passed",
            ""
        ])
        
        # Detailed results
        for category, category_results in results.items():
            report_lines.extend([
                f"{category.upper()}:",
                "-" * 20
            ])
            
            for check_name, result in category_results.items():
                if isinstance(result, dict) and 'passed' in result:
                    status = "✅ PASS" if result['passed'] else "❌ FAIL"
                    message = result.get('message', '')
                    report_lines.append(f"  {check_name}: {status} - {message}")
            
            report_lines.append("")
        
        return "\n".join(report_lines)
    
    def save_report(self, results: Dict[str, Dict[str, Any]], filepath: str):
        """Save results to a JSON file."""
        report_data = {
            'timestamp': psutil.boot_time(),
            'system_info': {
                'platform': platform.platform(),
                'python_version': sys.version,
                'architecture': platform.architecture()
            },
            'results': results
        }
        
        with open(filepath, 'w') as f:
            json.dump(report_data, f, indent=2, default=str)


def main():
    """Run system check as standalone script."""
    checker = SystemChecker()
    results = checker.check_all()
    
    # Print report
    report = checker.generate_report(results)
    print(report)
    
    # Save to file
    checker.save_report(results, 'system_check_report.json')
    print(f"\nDetailed report saved to: system_check_report.json")
    
    # Exit with appropriate code
    all_critical_passed = all(
        result.get('passed', True) 
        for category in ['python', 'memory', 'storage']
        for result in results.get(category, {}).values()
        if isinstance(result, dict) and 'passed' in result
    )
    
    sys.exit(0 if all_critical_passed else 1)


if __name__ == '__main__':
    main()