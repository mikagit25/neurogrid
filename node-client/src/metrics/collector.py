"""
Advanced Metrics Collection System

Comprehensive system monitoring including GPU, CPU, memory, network, disk I/O,
and AI-specific metrics with real-time collection and historical tracking.
"""

import asyncio
import json
import logging
import time
import threading
from collections import deque, defaultdict
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Deque
from pathlib import Path
import psutil
import platform

from ..utils.gpu_detector import GPUDetector, GPUInfo


@dataclass
class SystemMetrics:
    """System metrics snapshot."""
    timestamp: float
    cpu_percent: float
    cpu_freq: Optional[float]
    cpu_temp: Optional[float]
    memory_total: int
    memory_used: int
    memory_percent: float
    memory_available: int
    disk_usage_percent: float
    disk_read_bytes: int
    disk_write_bytes: int
    network_bytes_sent: int
    network_bytes_recv: int
    gpu_metrics: List[Dict[str, Any]]
    process_count: int
    load_average: Optional[List[float]]
    boot_time: float


@dataclass
class NetworkMetrics:
    """Network-specific metrics."""
    timestamp: float
    bytes_sent: int
    bytes_recv: int
    packets_sent: int
    packets_recv: int
    errin: int
    errout: int
    dropin: int
    dropout: int
    latency_ms: Optional[float]
    bandwidth_mbps: Optional[float]


@dataclass
class AIWorkloadMetrics:
    """AI workload specific metrics."""
    timestamp: float
    active_models: List[str]
    inference_count: int
    avg_inference_time: float
    memory_efficiency: float
    gpu_utilization: float
    throughput_samples_per_sec: float
    error_rate: float
    queue_length: int


class MetricsCollector:
    """Advanced system metrics collection with real-time monitoring."""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.logger = logging.getLogger(__name__)
        self.gpu_detector = GPUDetector()
        
        # Metrics storage
        self.metrics_history: Deque[SystemMetrics] = deque(maxlen=1000)
        self.network_history: Deque[NetworkMetrics] = deque(maxlen=1000)
        self.ai_metrics_history: Deque[AIWorkloadMetrics] = deque(maxlen=1000)
        
        # Real-time data
        self.current_metrics: Optional[SystemMetrics] = None
        self.gpus: List[GPUInfo] = []
        
        # Performance tracking
        self.baseline_metrics: Optional[SystemMetrics] = None
        self.peak_metrics: Dict[str, float] = {}
        
        # Collection settings
        self.collection_interval = config.get('metrics_interval', 5)
        self.detailed_collection = config.get('detailed_metrics', True)
        self.history_duration = config.get('metrics_history_hours', 24)
        
        # Background tasks
        self.collection_task: Optional[asyncio.Task] = None
        self.running = False
        
        # Thread-safe data
        self._lock = threading.Lock()
        
        # Network baseline
        self._last_network_counters = None
        self._network_baseline_time = None
        
        # AI workload tracking
        self.ai_metrics = AIWorkloadMetrics(
            timestamp=time.time(),
            active_models=[],
            inference_count=0,
            avg_inference_time=0.0,
            memory_efficiency=0.0,
            gpu_utilization=0.0,
            throughput_samples_per_sec=0.0,
            error_rate=0.0,
            queue_length=0
        )
        
        self.logger.info("MetricsCollector initialized")
    
    async def initialize(self):
        """Initialize the metrics collector."""
        self.logger.info("Initializing MetricsCollector...")
        
        # Detect GPUs
        self.gpus = await self.gpu_detector.detect_all_gpus()
        self.logger.info(f"Detected {len(self.gpus)} GPU(s)")
        
        # Collect baseline metrics
        self.baseline_metrics = await self.collect_system_metrics()
        self.logger.info("Baseline metrics collected")
        
        # Start background collection
        await self.start_collection()
    
    async def start_collection(self):
        """Start background metrics collection."""
        if self.running:
            return
        
        self.running = True
        self.collection_task = asyncio.create_task(self._collection_loop())
        self.logger.info("Started background metrics collection")
    
    async def stop_collection(self):
        """Stop background metrics collection."""
        if not self.running:
            return
        
        self.running = False
        if self.collection_task:
            self.collection_task.cancel()
            try:
                await self.collection_task
            except asyncio.CancelledError:
                pass
        
        self.logger.info("Stopped background metrics collection")
    
    async def _collection_loop(self):
        """Background metrics collection loop."""
        while self.running:
            try:
                # Collect system metrics
                metrics = await self.collect_system_metrics()
                
                with self._lock:
                    self.current_metrics = metrics
                    self.metrics_history.append(metrics)
                    
                    # Update peak metrics
                    self._update_peak_metrics(metrics)
                
                # Collect network metrics
                network_metrics = await self.collect_network_metrics()
                if network_metrics:
                    with self._lock:
                        self.network_history.append(network_metrics)
                
                # Clean old data
                self._cleanup_old_metrics()
                
            except Exception as e:
                self.logger.error(f"Metrics collection error: {e}")
            
            await asyncio.sleep(self.collection_interval)
    
    async def collect_system_metrics(self) -> SystemMetrics:
        """Collect comprehensive system metrics."""
        timestamp = time.time()
        
        # CPU metrics
        cpu_percent = psutil.cpu_percent(interval=0.1)
        cpu_freq = None
        try:
            freq_info = psutil.cpu_freq()
            cpu_freq = freq_info.current if freq_info else None
        except:
            pass
        
        # CPU temperature (Linux/macOS)
        cpu_temp = await self._get_cpu_temperature()
        
        # Memory metrics
        memory = psutil.virtual_memory()
        
        # Disk metrics
        disk_usage = psutil.disk_usage('/')
        disk_io = psutil.disk_io_counters()
        
        # Network metrics
        network_io = psutil.net_io_counters()
        
        # GPU metrics
        gpu_metrics = []
        for gpu in self.gpus:
            # Refresh GPU info
            updated_gpus = await self.gpu_detector.detect_all_gpus()
            for updated_gpu in updated_gpus:
                if updated_gpu.id == gpu.id and updated_gpu.vendor == gpu.vendor:
                    gpu_metrics.append({
                        'id': updated_gpu.id,
                        'name': updated_gpu.name,
                        'vendor': updated_gpu.vendor,
                        'memory_total': updated_gpu.memory_total,
                        'memory_used': updated_gpu.memory_used,
                        'memory_free': updated_gpu.memory_free,
                        'utilization': updated_gpu.utilization,
                        'temperature': updated_gpu.temperature,
                        'power_usage': None  # Would need vendor-specific APIs
                    })
                    break
        
        # System info
        process_count = len(psutil.pids())
        
        # Load average (Unix systems)
        load_average = None
        try:
            if hasattr(psutil, 'getloadavg'):
                load_average = list(psutil.getloadavg())
        except:
            pass
        
        return SystemMetrics(
            timestamp=timestamp,
            cpu_percent=cpu_percent,
            cpu_freq=cpu_freq,
            cpu_temp=cpu_temp,
            memory_total=memory.total,
            memory_used=memory.used,
            memory_percent=memory.percent,
            memory_available=memory.available,
            disk_usage_percent=disk_usage.percent,
            disk_read_bytes=disk_io.read_bytes if disk_io else 0,
            disk_write_bytes=disk_io.write_bytes if disk_io else 0,
            network_bytes_sent=network_io.bytes_sent,
            network_bytes_recv=network_io.bytes_recv,
            gpu_metrics=gpu_metrics,
            process_count=process_count,
            load_average=load_average,
            boot_time=psutil.boot_time()
        )
    
    async def _get_cpu_temperature(self) -> Optional[float]:
        """Get CPU temperature if available."""
        try:
            if hasattr(psutil, 'sensors_temperatures'):
                temps = psutil.sensors_temperatures()
                if temps:
                    # Try common sensor names
                    for sensor_name in ['coretemp', 'cpu_thermal', 'k10temp']:
                        if sensor_name in temps:
                            return temps[sensor_name][0].current
                    
                    # Fallback to first available sensor
                    first_sensor = next(iter(temps.values()))
                    if first_sensor:
                        return first_sensor[0].current
        except:
            pass
        
        return None
    
    async def collect_network_metrics(self) -> Optional[NetworkMetrics]:
        """Collect detailed network metrics."""
        try:
            current_time = time.time()
            net_io = psutil.net_io_counters()
            
            if self._last_network_counters is None:
                self._last_network_counters = net_io
                self._network_baseline_time = current_time
                return None
            
            # Calculate rates
            time_delta = current_time - self._network_baseline_time
            if time_delta <= 0:
                return None
            
            bytes_sent_rate = (net_io.bytes_sent - self._last_network_counters.bytes_sent) / time_delta
            bytes_recv_rate = (net_io.bytes_recv - self._last_network_counters.bytes_recv) / time_delta
            
            # Estimate bandwidth
            total_bandwidth = (bytes_sent_rate + bytes_recv_rate) * 8 / (1024 * 1024)  # Mbps
            
            # Update baseline
            self._last_network_counters = net_io
            self._network_baseline_time = current_time
            
            # Measure latency (ping localhost)
            latency = await self._measure_network_latency()
            
            return NetworkMetrics(
                timestamp=current_time,
                bytes_sent=net_io.bytes_sent,
                bytes_recv=net_io.bytes_recv,
                packets_sent=net_io.packets_sent,
                packets_recv=net_io.packets_recv,
                errin=net_io.errin,
                errout=net_io.errout,
                dropin=net_io.dropin,
                dropout=net_io.dropout,
                latency_ms=latency,
                bandwidth_mbps=total_bandwidth
            )
        
        except Exception as e:
            self.logger.debug(f"Network metrics collection error: {e}")
            return None
    
    async def _measure_network_latency(self) -> Optional[float]:
        """Measure network latency via ping."""
        try:
            import subprocess
            
            if platform.system().lower() == 'windows':
                cmd = ['ping', '-n', '1', 'localhost']
            else:
                cmd = ['ping', '-c', '1', 'localhost']
            
            result = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, _ = await asyncio.wait_for(result.communicate(), timeout=5.0)
            
            if result.returncode == 0:
                output = stdout.decode()
                # Parse ping output for latency
                # This is simplified - would need platform-specific parsing
                if 'time=' in output:
                    for line in output.split('\n'):
                        if 'time=' in line:
                            time_part = line.split('time=')[1].split()[0]
                            return float(time_part.replace('ms', ''))
        
        except:
            pass
        
        return None
    
    def update_ai_metrics(self, **kwargs):
        """Update AI workload metrics."""
        with self._lock:
            for key, value in kwargs.items():
                if hasattr(self.ai_metrics, key):
                    setattr(self.ai_metrics, key, value)
            
            self.ai_metrics.timestamp = time.time()
            
            # Add to history
            self.ai_metrics_history.append(
                AIWorkloadMetrics(**asdict(self.ai_metrics))
            )
    
    def _update_peak_metrics(self, metrics: SystemMetrics):
        """Update peak metrics tracking."""
        peak_fields = [
            'cpu_percent', 'memory_percent', 'disk_usage_percent'
        ]
        
        for field in peak_fields:
            value = getattr(metrics, field)
            if value is not None:
                current_peak = self.peak_metrics.get(field, 0)
                self.peak_metrics[field] = max(current_peak, value)
        
        # GPU peak metrics
        for gpu_metric in metrics.gpu_metrics:
            gpu_id = gpu_metric['id']
            utilization = gpu_metric.get('utilization', 0)
            memory_percent = (gpu_metric.get('memory_used', 0) / 
                            max(gpu_metric.get('memory_total', 1), 1)) * 100
            
            self.peak_metrics[f'gpu_{gpu_id}_utilization'] = max(
                self.peak_metrics.get(f'gpu_{gpu_id}_utilization', 0),
                utilization
            )
            
            self.peak_metrics[f'gpu_{gpu_id}_memory'] = max(
                self.peak_metrics.get(f'gpu_{gpu_id}_memory', 0),
                memory_percent
            )
    
    def _cleanup_old_metrics(self):
        """Remove old metrics beyond retention period."""
        cutoff_time = time.time() - (self.history_duration * 3600)
        
        with self._lock:
            # Clean system metrics
            while self.metrics_history and self.metrics_history[0].timestamp < cutoff_time:
                self.metrics_history.popleft()
            
            # Clean network metrics
            while self.network_history and self.network_history[0].timestamp < cutoff_time:
                self.network_history.popleft()
            
            # Clean AI metrics
            while self.ai_metrics_history and self.ai_metrics_history[0].timestamp < cutoff_time:
                self.ai_metrics_history.popleft()
    
    async def get_system_info(self) -> Dict[str, Any]:
        """Get comprehensive system information for registration."""
        # Refresh GPU detection
        self.gpus = await self.gpu_detector.detect_all_gpus()
        capabilities = await self.gpu_detector.get_system_capabilities()
        
        # System info
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        cpu_brand = "Unknown"
        try:
            if platform.system() == "Windows":
                cpu_brand = platform.processor()
            else:
                import subprocess
                result = subprocess.run(['cat', '/proc/cpuinfo'], 
                                      capture_output=True, text=True, timeout=5)
                for line in result.stdout.split('\n'):
                    if 'model name' in line:
                        cpu_brand = line.split(':')[1].strip()
                        break
        except:
            pass
        
        return {
            'platform': {
                'system': platform.system(),
                'release': platform.release(),
                'version': platform.version(),
                'architecture': platform.machine(),
                'processor': cpu_brand
            },
            'cpu': {
                'cores_physical': psutil.cpu_count(logical=False),
                'cores_logical': psutil.cpu_count(logical=True),
                'frequency_max': psutil.cpu_freq().max if psutil.cpu_freq() else None,
                'brand': cpu_brand
            },
            'memory': {
                'total_gb': round(memory.total / (1024**3), 2),
                'available_gb': round(memory.available / (1024**3), 2)
            },
            'storage': {
                'total_gb': round(disk.total / (1024**3), 2),
                'free_gb': round(disk.free / (1024**3), 2)
            },
            'gpus': [
                {
                    'id': gpu.id,
                    'name': gpu.name,
                    'vendor': gpu.vendor,
                    'memory_gb': round(gpu.memory_total / 1024, 2),
                    'compute_capability': gpu.compute_capability,
                    'supports_ai': gpu.supports_ai
                }
                for gpu in self.gpus
            ],
            'capabilities': capabilities,
            'ai_frameworks': capabilities['frameworks']
        }
    
    def has_gpu(self) -> bool:
        """Check if system has AI-capable GPU."""
        return any(gpu.supports_ai for gpu in self.gpus)
    
    async def collect_metrics(self) -> Dict[str, Any]:
        """Collect current metrics for transmission."""
        current = self.current_metrics or await self.collect_system_metrics()
        
        with self._lock:
            # Recent metrics (last 5 minutes)
            recent_cutoff = time.time() - 300
            recent_metrics = [m for m in self.metrics_history if m.timestamp > recent_cutoff]
            
            # Calculate averages
            if recent_metrics:
                avg_cpu = sum(m.cpu_percent for m in recent_metrics) / len(recent_metrics)
                avg_memory = sum(m.memory_percent for m in recent_metrics) / len(recent_metrics)
            else:
                avg_cpu = current.cpu_percent
                avg_memory = current.memory_percent
            
            # Network stats
            network_current = self.network_history[-1] if self.network_history else None
            
            return {
                'timestamp': current.timestamp,
                'system': {
                    'cpu_percent': current.cpu_percent,
                    'cpu_avg_5min': avg_cpu,
                    'cpu_frequency': current.cpu_freq,
                    'cpu_temperature': current.cpu_temp,
                    'memory_percent': current.memory_percent,
                    'memory_avg_5min': avg_memory,
                    'memory_total_gb': round(current.memory_total / (1024**3), 2),
                    'memory_used_gb': round(current.memory_used / (1024**3), 2),
                    'disk_usage_percent': current.disk_usage_percent,
                    'process_count': current.process_count,
                    'load_average': current.load_average,
                    'uptime_hours': round((time.time() - current.boot_time) / 3600, 1)
                },
                'gpus': current.gpu_metrics,
                'network': {
                    'latency_ms': network_current.latency_ms if network_current else None,
                    'bandwidth_mbps': network_current.bandwidth_mbps if network_current else None,
                    'bytes_sent': current.network_bytes_sent,
                    'bytes_recv': current.network_bytes_recv
                },
                'ai_workload': asdict(self.ai_metrics),
                'peak_metrics': dict(self.peak_metrics),
                'baseline_comparison': self._compare_to_baseline(current) if self.baseline_metrics else {}
            }
    
    def _compare_to_baseline(self, current: SystemMetrics) -> Dict[str, float]:
        """Compare current metrics to baseline."""
        if not self.baseline_metrics:
            return {}
        
        return {
            'cpu_increase_pct': ((current.cpu_percent - self.baseline_metrics.cpu_percent) / 
                               max(self.baseline_metrics.cpu_percent, 1)) * 100,
            'memory_increase_pct': ((current.memory_percent - self.baseline_metrics.memory_percent) / 
                                  max(self.baseline_metrics.memory_percent, 1)) * 100,
            'process_increase': current.process_count - self.baseline_metrics.process_count
        }
    
    def get_performance_summary(self) -> Dict[str, Any]:
        """Get performance summary for the last hour."""
        hour_ago = time.time() - 3600
        
        with self._lock:
            recent_metrics = [m for m in self.metrics_history if m.timestamp > hour_ago]
        
        if not recent_metrics:
            return {}
        
        cpu_values = [m.cpu_percent for m in recent_metrics]
        memory_values = [m.memory_percent for m in recent_metrics]
        
        return {
            'duration_minutes': len(recent_metrics) * (self.collection_interval / 60),
            'cpu': {
                'avg': sum(cpu_values) / len(cpu_values),
                'min': min(cpu_values),
                'max': max(cpu_values),
                'samples': len(cpu_values)
            },
            'memory': {
                'avg': sum(memory_values) / len(memory_values),
                'min': min(memory_values),
                'max': max(memory_values),
                'samples': len(memory_values)
            },
            'ai_tasks': {
                'completed': self.ai_metrics.inference_count,
                'avg_time': self.ai_metrics.avg_inference_time,
                'error_rate': self.ai_metrics.error_rate,
                'throughput': self.ai_metrics.throughput_samples_per_sec
            }
        }
    
    async def export_metrics(self, filepath: str, duration_hours: int = 1):
        """Export metrics to JSON file."""
        cutoff_time = time.time() - (duration_hours * 3600)
        
        with self._lock:
            export_data = {
                'export_timestamp': time.time(),
                'duration_hours': duration_hours,
                'system_metrics': [
                    asdict(m) for m in self.metrics_history 
                    if m.timestamp > cutoff_time
                ],
                'network_metrics': [
                    asdict(m) for m in self.network_history 
                    if m.timestamp > cutoff_time
                ],
                'ai_metrics': [
                    asdict(m) for m in self.ai_metrics_history 
                    if m.timestamp > cutoff_time
                ],
                'peak_metrics': dict(self.peak_metrics)
            }
        
        with open(filepath, 'w') as f:
            json.dump(export_data, f, indent=2)
        
        self.logger.info(f"Metrics exported to {filepath}")
    
    def reset_metrics(self):
        """Reset all metrics and history."""
        with self._lock:
            self.metrics_history.clear()
            self.network_history.clear()
            self.ai_metrics_history.clear()
            self.peak_metrics.clear()
            self.baseline_metrics = None
        
        self.logger.info("All metrics reset")