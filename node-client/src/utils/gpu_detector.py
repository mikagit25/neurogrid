"""
GPU Detection and System Optimization Module

Advanced GPU detection with automatic optimization for NVIDIA, AMD, and Apple Silicon.
Includes CUDA/ROCm setup, memory optimization, and performance tuning.
"""

import os
import platform
import subprocess
import json
import logging
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from pathlib import Path
import psutil


@dataclass
class GPUInfo:
    """GPU information dataclass."""
    id: int
    name: str
    vendor: str  # 'nvidia', 'amd', 'intel', 'apple'
    memory_total: int  # MB
    memory_free: int   # MB
    memory_used: int   # MB
    utilization: float  # 0.0 - 1.0
    temperature: Optional[int]  # Celsius
    driver_version: str
    compute_capability: Optional[str]
    pci_id: str
    power_limit: Optional[int]  # Watts
    supports_ai: bool
    framework_support: Dict[str, bool]


class GPUDetector:
    """Advanced GPU detection and optimization system."""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.platform = platform.system().lower()
        self.architecture = platform.machine().lower()
        self._gpu_cache = None
        self._capabilities_cache = None
    
    async def detect_all_gpus(self) -> List[GPUInfo]:
        """Detect all available GPUs with comprehensive information."""
        if self._gpu_cache is not None:
            return self._gpu_cache
        
        gpus = []
        
        # NVIDIA GPU detection
        nvidia_gpus = await self._detect_nvidia_gpus()
        gpus.extend(nvidia_gpus)
        
        # AMD GPU detection
        amd_gpus = await self._detect_amd_gpus()
        gpus.extend(amd_gpus)
        
        # Intel GPU detection
        intel_gpus = await self._detect_intel_gpus()
        gpus.extend(intel_gpus)
        
        # Apple Silicon detection
        if self.platform == 'darwin':
            apple_gpus = await self._detect_apple_gpus()
            gpus.extend(apple_gpus)
        
        # Cache results
        self._gpu_cache = gpus
        
        self.logger.info(f"Detected {len(gpus)} GPU(s): {[gpu.name for gpu in gpus]}")
        return gpus
    
    async def _detect_nvidia_gpus(self) -> List[GPUInfo]:
        """Detect NVIDIA GPUs using nvidia-ml-py and nvidia-smi."""
        gpus = []
        
        try:
            import pynvml
            pynvml.nvmlInit()
            
            device_count = pynvml.nvmlDeviceGetCount()
            
            for i in range(device_count):
                handle = pynvml.nvmlDeviceGetHandleByIndex(i)
                
                # Basic info
                name = pynvml.nvmlDeviceGetName(handle).decode('utf-8')
                
                # Memory info
                mem_info = pynvml.nvmlDeviceGetMemoryInfo(handle)
                memory_total = mem_info.total // (1024 * 1024)  # Convert to MB
                memory_free = mem_info.free // (1024 * 1024)
                memory_used = mem_info.used // (1024 * 1024)
                
                # Utilization
                util_info = pynvml.nvmlDeviceGetUtilizationRates(handle)
                utilization = util_info.gpu / 100.0
                
                # Temperature
                try:
                    temperature = pynvml.nvmlDeviceGetTemperature(handle, pynvml.NVML_TEMPERATURE_GPU)
                except:
                    temperature = None
                
                # Driver version
                try:
                    driver_version = pynvml.nvmlSystemGetDriverVersion().decode('utf-8')
                except:
                    driver_version = "Unknown"
                
                # Compute capability
                try:
                    major = pynvml.nvmlDeviceGetCudaComputeCapability(handle)[0]
                    minor = pynvml.nvmlDeviceGetCudaComputeCapability(handle)[1]
                    compute_capability = f"{major}.{minor}"
                except:
                    compute_capability = None
                
                # PCI ID
                try:
                    pci_info = pynvml.nvmlDeviceGetPciInfo(handle)
                    pci_id = f"{pci_info.busId.decode('utf-8')}"
                except:
                    pci_id = f"GPU-{i}"
                
                # Power limit
                try:
                    power_limit = pynvml.nvmlDeviceGetPowerManagementLimitConstraints(handle)[1] // 1000
                except:
                    power_limit = None
                
                # Framework support
                framework_support = await self._check_nvidia_framework_support(compute_capability)
                
                gpu_info = GPUInfo(
                    id=i,
                    name=name,
                    vendor='nvidia',
                    memory_total=memory_total,
                    memory_free=memory_free,
                    memory_used=memory_used,
                    utilization=utilization,
                    temperature=temperature,
                    driver_version=driver_version,
                    compute_capability=compute_capability,
                    pci_id=pci_id,
                    power_limit=power_limit,
                    supports_ai=compute_capability and float(compute_capability) >= 3.5,
                    framework_support=framework_support
                )
                
                gpus.append(gpu_info)
            
            pynvml.nvmlShutdown()
            
        except ImportError:
            self.logger.warning("pynvml not available, trying nvidia-smi")
            gpus = await self._detect_nvidia_via_smi()
        except Exception as e:
            self.logger.debug(f"NVIDIA GPU detection failed: {e}")
        
        return gpus
    
    async def _detect_nvidia_via_smi(self) -> List[GPUInfo]:
        """Fallback NVIDIA detection using nvidia-smi."""
        gpus = []
        
        try:
            # Query nvidia-smi for GPU information
            cmd = [
                'nvidia-smi',
                '--query-gpu=index,name,memory.total,memory.free,memory.used,utilization.gpu,temperature.gpu,driver_version,pci.bus_id',
                '--format=csv,noheader,nounits'
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0:
                lines = result.stdout.strip().split('\n')
                
                for line in lines:
                    if not line.strip():
                        continue
                    
                    parts = [p.strip() for p in line.split(',')]
                    if len(parts) >= 8:
                        gpu_info = GPUInfo(
                            id=int(parts[0]),
                            name=parts[1],
                            vendor='nvidia',
                            memory_total=int(parts[2]),
                            memory_free=int(parts[3]),
                            memory_used=int(parts[4]),
                            utilization=float(parts[5]) / 100.0,
                            temperature=int(parts[6]) if parts[6] != '[Not Supported]' else None,
                            driver_version=parts[7],
                            compute_capability=None,
                            pci_id=parts[8] if len(parts) > 8 else f"GPU-{parts[0]}",
                            power_limit=None,
                            supports_ai=True,  # Assume true for detected NVIDIA GPUs
                            framework_support={'pytorch': True, 'tensorflow': True, 'cuda': True}
                        )
                        gpus.append(gpu_info)
        
        except (subprocess.TimeoutExpired, subprocess.CalledProcessError, FileNotFoundError):
            self.logger.debug("nvidia-smi not available or failed")
        except Exception as e:
            self.logger.debug(f"nvidia-smi detection error: {e}")
        
        return gpus
    
    async def _detect_amd_gpus(self) -> List[GPUInfo]:
        """Detect AMD GPUs using ROCm tools."""
        gpus = []
        
        try:
            # Try ROCm SMI
            cmd = ['rocm-smi', '--showid', '--showproductname', '--showmeminfo', '--showuse', '--showtemp']
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0:
                # Parse rocm-smi output
                gpus = self._parse_rocm_smi_output(result.stdout)
        
        except (subprocess.TimeoutExpired, subprocess.CalledProcessError, FileNotFoundError):
            # Fallback to other methods
            gpus = await self._detect_amd_fallback()
        
        return gpus
    
    def _parse_rocm_smi_output(self, output: str) -> List[GPUInfo]:
        """Parse ROCm SMI output to extract GPU information."""
        gpus = []
        lines = output.strip().split('\n')
        
        # This is a simplified parser - ROCm SMI output format varies
        # In practice, you'd need more robust parsing
        
        gpu_data = {}
        current_gpu = None
        
        for line in lines:
            if 'GPU' in line and 'DID' in line:
                # New GPU entry
                if current_gpu is not None and gpu_data:
                    gpu_info = self._build_amd_gpu_info(current_gpu, gpu_data)
                    if gpu_info:
                        gpus.append(gpu_info)
                
                current_gpu = len(gpus)
                gpu_data = {}
            
            # Extract various metrics
            if 'Memory' in line:
                # Parse memory information
                pass
            elif 'Temperature' in line:
                # Parse temperature
                pass
            # Add more parsing as needed
        
        return gpus
    
    def _build_amd_gpu_info(self, gpu_id: int, data: Dict) -> Optional[GPUInfo]:
        """Build GPUInfo object for AMD GPU from parsed data."""
        # This would build the GPUInfo from parsed ROCm data
        return GPUInfo(
            id=gpu_id,
            name=data.get('name', 'AMD GPU'),
            vendor='amd',
            memory_total=data.get('memory_total', 0),
            memory_free=data.get('memory_free', 0),
            memory_used=data.get('memory_used', 0),
            utilization=data.get('utilization', 0.0),
            temperature=data.get('temperature'),
            driver_version=data.get('driver_version', 'Unknown'),
            compute_capability=None,
            pci_id=data.get('pci_id', f"AMD-GPU-{gpu_id}"),
            power_limit=data.get('power_limit'),
            supports_ai=True,
            framework_support={'pytorch': True, 'rocm': True}
        )
    
    async def _detect_amd_fallback(self) -> List[GPUInfo]:
        """Fallback AMD GPU detection using system queries."""
        gpus = []
        
        try:
            if self.platform == 'linux':
                # Check for AMD GPUs in /sys/class/drm
                drm_path = Path('/sys/class/drm')
                if drm_path.exists():
                    for card_path in drm_path.glob('card*'):
                        if (card_path / 'device' / 'vendor').exists():
                            with open(card_path / 'device' / 'vendor', 'r') as f:
                                vendor_id = f.read().strip()
                            
                            if vendor_id == '0x1002':  # AMD vendor ID
                                gpu_info = GPUInfo(
                                    id=len(gpus),
                                    name='AMD GPU (Detected)',
                                    vendor='amd',
                                    memory_total=0,  # Would need additional detection
                                    memory_free=0,
                                    memory_used=0,
                                    utilization=0.0,
                                    temperature=None,
                                    driver_version='Unknown',
                                    compute_capability=None,
                                    pci_id=str(card_path.name),
                                    power_limit=None,
                                    supports_ai=True,
                                    framework_support={'pytorch': True, 'rocm': True}
                                )
                                gpus.append(gpu_info)
        
        except Exception as e:
            self.logger.debug(f"AMD fallback detection error: {e}")
        
        return gpus
    
    async def _detect_intel_gpus(self) -> List[GPUInfo]:
        """Detect Intel GPUs (integrated and discrete)."""
        gpus = []
        
        try:
            if self.platform == 'linux':
                # Check for Intel GPUs
                cmd = ['lspci', '-d', '8086:', '-v']
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
                
                if result.returncode == 0:
                    lines = result.stdout.split('\n')
                    
                    for i, line in enumerate(lines):
                        if 'VGA' in line or 'Display' in line:
                            # Extract GPU name
                            parts = line.split(':')
                            if len(parts) >= 3:
                                name = parts[2].strip()
                                
                                gpu_info = GPUInfo(
                                    id=len(gpus),
                                    name=name,
                                    vendor='intel',
                                    memory_total=0,  # Intel integrated GPUs share system memory
                                    memory_free=0,
                                    memory_used=0,
                                    utilization=0.0,
                                    temperature=None,
                                    driver_version='Unknown',
                                    compute_capability=None,
                                    pci_id=parts[0].strip(),
                                    power_limit=None,
                                    supports_ai=False,  # Most Intel GPUs not suitable for AI
                                    framework_support={'opencl': True}
                                )
                                gpus.append(gpu_info)
            
            elif self.platform == 'windows':
                # Windows Intel GPU detection via WMI
                gpus.extend(await self._detect_intel_windows())
        
        except Exception as e:
            self.logger.debug(f"Intel GPU detection error: {e}")
        
        return gpus
    
    async def _detect_intel_windows(self) -> List[GPUInfo]:
        """Detect Intel GPUs on Windows using WMI."""
        gpus = []
        
        try:
            import wmi
            c = wmi.WMI()
            
            for gpu in c.Win32_VideoController():
                if 'Intel' in gpu.Name:
                    gpu_info = GPUInfo(
                        id=len(gpus),
                        name=gpu.Name,
                        vendor='intel',
                        memory_total=gpu.AdapterRAM // (1024 * 1024) if gpu.AdapterRAM else 0,
                        memory_free=0,
                        memory_used=0,
                        utilization=0.0,
                        temperature=None,
                        driver_version=gpu.DriverVersion or 'Unknown',
                        compute_capability=None,
                        pci_id=gpu.PNPDeviceID or f"Intel-GPU-{len(gpus)}",
                        power_limit=None,
                        supports_ai=False,
                        framework_support={'opencl': True}
                    )
                    gpus.append(gpu_info)
        
        except ImportError:
            self.logger.debug("WMI not available for Intel GPU detection")
        except Exception as e:
            self.logger.debug(f"Intel Windows detection error: {e}")
        
        return gpus
    
    async def _detect_apple_gpus(self) -> List[GPUInfo]:
        """Detect Apple Silicon GPUs on macOS."""
        gpus = []
        
        if self.architecture in ['arm64', 'aarch64']:
            try:
                # Use system_profiler to get GPU information
                cmd = ['system_profiler', 'SPDisplaysDataType', '-json']
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
                
                if result.returncode == 0:
                    data = json.loads(result.stdout)
                    displays = data.get('SPDisplaysDataType', [])
                    
                    for i, display in enumerate(displays):
                        if 'Apple' in display.get('sppci_model', ''):
                            # Extract memory info if available
                            memory_str = display.get('sppci_vram', '0 MB')
                            memory_mb = self._parse_memory_string(memory_str)
                            
                            gpu_info = GPUInfo(
                                id=i,
                                name=display.get('sppci_model', 'Apple GPU'),
                                vendor='apple',
                                memory_total=memory_mb,
                                memory_free=memory_mb,  # Shared memory
                                memory_used=0,
                                utilization=0.0,
                                temperature=None,
                                driver_version='Built-in',
                                compute_capability=None,
                                pci_id=f"Apple-GPU-{i}",
                                power_limit=None,
                                supports_ai=True,  # Apple Silicon supports AI workloads
                                framework_support={'pytorch': True, 'metal': True, 'coreml': True}
                            )
                            gpus.append(gpu_info)
            
            except Exception as e:
                self.logger.debug(f"Apple GPU detection error: {e}")
        
        return gpus
    
    def _parse_memory_string(self, memory_str: str) -> int:
        """Parse memory string like '8 GB' or '512 MB' to MB."""
        try:
            parts = memory_str.lower().split()
            if len(parts) >= 2:
                value = float(parts[0])
                unit = parts[1]
                
                if 'gb' in unit:
                    return int(value * 1024)
                elif 'mb' in unit:
                    return int(value)
        except:
            pass
        
        return 0
    
    async def _check_nvidia_framework_support(self, compute_capability: Optional[str]) -> Dict[str, bool]:
        """Check framework support for NVIDIA GPU."""
        support = {
            'pytorch': False,
            'tensorflow': False,
            'cuda': False,
            'tensorrt': False
        }
        
        if not compute_capability:
            return support
        
        try:
            cc_float = float(compute_capability)
            
            # CUDA support (3.5+)
            support['cuda'] = cc_float >= 3.5
            
            # PyTorch support
            try:
                import torch
                support['pytorch'] = torch.cuda.is_available() and cc_float >= 3.5
            except ImportError:
                support['pytorch'] = cc_float >= 3.5
            
            # TensorFlow support
            try:
                import tensorflow as tf
                support['tensorflow'] = len(tf.config.list_physical_devices('GPU')) > 0
            except ImportError:
                support['tensorflow'] = cc_float >= 3.5
            
            # TensorRT support (6.0+)
            support['tensorrt'] = cc_float >= 6.0
        
        except:
            pass
        
        return support
    
    async def get_optimal_gpu(self, task_requirements: Dict[str, Any]) -> Optional[GPUInfo]:
        """Select the optimal GPU for a given task."""
        gpus = await self.detect_all_gpus()
        
        # Filter GPUs that support AI workloads
        ai_gpus = [gpu for gpu in gpus if gpu.supports_ai]
        
        if not ai_gpus:
            return None
        
        # Apply filters based on requirements
        required_memory = task_requirements.get('min_vram_mb', 0)
        required_framework = task_requirements.get('framework', 'pytorch')
        
        suitable_gpus = []
        for gpu in ai_gpus:
            # Check memory requirement
            if gpu.memory_free < required_memory:
                continue
            
            # Check framework support
            if required_framework not in gpu.framework_support:
                continue
            
            # Check if framework is actually supported
            if not gpu.framework_support.get(required_framework, False):
                continue
            
            suitable_gpus.append(gpu)
        
        if not suitable_gpus:
            return None
        
        # Rank GPUs by performance score
        def gpu_score(gpu: GPUInfo) -> float:
            score = 0.0
            
            # Memory score (40%)
            score += (gpu.memory_total / 16384) * 0.4  # Normalized to 16GB
            
            # Utilization score (30%) - prefer less utilized GPUs
            score += (1.0 - gpu.utilization) * 0.3
            
            # Vendor preference (20%)
            vendor_scores = {'nvidia': 1.0, 'apple': 0.8, 'amd': 0.7, 'intel': 0.3}
            score += vendor_scores.get(gpu.vendor, 0.5) * 0.2
            
            # Temperature score (10%) - prefer cooler GPUs
            if gpu.temperature is not None:
                temp_score = max(0, (90 - gpu.temperature) / 90)  # Normalized to 90°C max
                score += temp_score * 0.1
            else:
                score += 0.05  # Neutral score if temperature unknown
            
            return score
        
        # Return the highest scoring GPU
        return max(suitable_gpus, key=gpu_score)
    
    async def optimize_gpu_settings(self, gpu: GPUInfo, task_type: str = 'inference') -> Dict[str, Any]:
        """Optimize GPU settings for specific task types."""
        optimizations = {
            'memory_growth': True,
            'mixed_precision': False,
            'batch_size_hint': 1,
            'environment_vars': {},
            'cuda_settings': {}
        }
        
        if gpu.vendor == 'nvidia':
            optimizations.update(await self._optimize_nvidia_settings(gpu, task_type))
        elif gpu.vendor == 'amd':
            optimizations.update(await self._optimize_amd_settings(gpu, task_type))
        elif gpu.vendor == 'apple':
            optimizations.update(await self._optimize_apple_settings(gpu, task_type))
        
        return optimizations
    
    async def _optimize_nvidia_settings(self, gpu: GPUInfo, task_type: str) -> Dict[str, Any]:
        """Optimize NVIDIA GPU settings."""
        settings = {
            'environment_vars': {
                'CUDA_VISIBLE_DEVICES': str(gpu.id),
                'PYTORCH_CUDA_ALLOC_CONF': 'max_split_size_mb:512'
            },
            'cuda_settings': {
                'allow_growth': True,
                'memory_limit': int(gpu.memory_total * 0.9)  # Reserve 10% for system
            }
        }
        
        # Task-specific optimizations
        if task_type == 'training':
            settings['mixed_precision'] = float(gpu.compute_capability or 0) >= 7.0
            settings['batch_size_hint'] = max(1, gpu.memory_total // 2048)
        elif task_type == 'inference':
            settings['environment_vars']['CUDA_LAUNCH_BLOCKING'] = '0'
            settings['batch_size_hint'] = max(1, gpu.memory_total // 1024)
        
        return settings
    
    async def _optimize_amd_settings(self, gpu: GPUInfo, task_type: str) -> Dict[str, Any]:
        """Optimize AMD GPU settings."""
        return {
            'environment_vars': {
                'HIP_VISIBLE_DEVICES': str(gpu.id),
                'PYTORCH_HIP_ALLOC_CONF': 'max_split_size_mb:512'
            },
            'batch_size_hint': max(1, gpu.memory_total // 1536)  # Conservative for AMD
        }
    
    async def _optimize_apple_settings(self, gpu: GPUInfo, task_type: str) -> Dict[str, Any]:
        """Optimize Apple Silicon GPU settings."""
        return {
            'environment_vars': {
                'PYTORCH_ENABLE_MPS_FALLBACK': '1'
            },
            'metal_settings': {
                'memory_pool_size': int(gpu.memory_total * 0.8)
            },
            'batch_size_hint': max(1, gpu.memory_total // 1024)
        }
    
    async def get_system_capabilities(self) -> Dict[str, Any]:
        """Get comprehensive system capabilities for AI workloads."""
        if self._capabilities_cache is not None:
            return self._capabilities_cache
        
        gpus = await self.detect_all_gpus()
        
        capabilities = {
            'platform': self.platform,
            'architecture': self.architecture,
            'gpu_count': len(gpus),
            'ai_capable_gpus': len([g for g in gpus if g.supports_ai]),
            'total_vram_mb': sum(g.memory_total for g in gpus),
            'available_vram_mb': sum(g.memory_free for g in gpus),
            'cpu_cores': psutil.cpu_count(),
            'cpu_logical': psutil.cpu_count(logical=True),
            'system_ram_gb': psutil.virtual_memory().total // (1024**3),
            'frameworks': {
                'pytorch': False,
                'tensorflow': False,
                'cuda': False,
                'rocm': False,
                'metal': False,
                'opencl': False
            },
            'optimal_gpu': None,
            'recommended_settings': {}
        }
        
        # Check framework availability
        capabilities['frameworks'] = await self._check_all_frameworks()
        
        # Get optimal GPU for general AI tasks
        if gpus:
            optimal_gpu = await self.get_optimal_gpu({'min_vram_mb': 1024, 'framework': 'pytorch'})
            if optimal_gpu:
                capabilities['optimal_gpu'] = {
                    'id': optimal_gpu.id,
                    'name': optimal_gpu.name,
                    'vendor': optimal_gpu.vendor,
                    'memory_total': optimal_gpu.memory_total
                }
                capabilities['recommended_settings'] = await self.optimize_gpu_settings(optimal_gpu)
        
        # Cache results
        self._capabilities_cache = capabilities
        
        return capabilities
    
    async def _check_all_frameworks(self) -> Dict[str, bool]:
        """Check availability of all AI frameworks."""
        frameworks = {
            'pytorch': False,
            'tensorflow': False,
            'cuda': False,
            'rocm': False,
            'metal': False,
            'opencl': False
        }
        
        # PyTorch
        try:
            import torch
            frameworks['pytorch'] = True
            
            if torch.cuda.is_available():
                frameworks['cuda'] = True
            
            if hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
                frameworks['metal'] = True
                
        except ImportError:
            pass
        
        # TensorFlow
        try:
            import tensorflow as tf
            frameworks['tensorflow'] = True
        except ImportError:
            pass
        
        # ROCm (for AMD)
        try:
            result = subprocess.run(['rocm-smi', '--version'], 
                                  capture_output=True, timeout=5)
            frameworks['rocm'] = result.returncode == 0
        except:
            pass
        
        # OpenCL
        try:
            import pyopencl
            frameworks['opencl'] = True
        except ImportError:
            pass
        
        return frameworks
    
    def clear_cache(self):
        """Clear cached detection results."""
        self._gpu_cache = None
        self._capabilities_cache = None
        self.logger.debug("GPU detection cache cleared")