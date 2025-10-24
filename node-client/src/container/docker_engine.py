"""
Advanced Docker Engine for Secure AI Task Execution

Provides containerized execution environment with resource limits,
security isolation, and GPU passthrough for AI inference tasks.
"""

import asyncio
import json
import logging
import tempfile
import time
from pathlib import Path
from typing import Dict, List, Optional, Any, Union
import docker
from docker.models.containers import Container
from docker.errors import DockerException, APIError
import tarfile
import io


class ContainerSpec:
    """Container specification for task execution."""
    
    def __init__(
        self,
        image: str = "neurogrid/ai-worker:latest",
        memory_limit: str = "8g",
        cpu_count: float = 2.0,
        gpu_access: bool = True,
        network_mode: str = "none",
        read_only: bool = True,
        environment: Optional[Dict[str, str]] = None,
        volumes: Optional[Dict[str, str]] = None,
        security_opts: Optional[List[str]] = None
    ):
        self.image = image
        self.memory_limit = memory_limit
        self.cpu_count = cpu_count
        self.gpu_access = gpu_access
        self.network_mode = network_mode
        self.read_only = read_only
        self.environment = environment or {}
        self.volumes = volumes or {}
        self.security_opts = security_opts or [
            "no-new-privileges:true",
            "seccomp=unconfined"  # May need adjustment based on models
        ]


class ResourceLimits:
    """Resource limits for container execution."""
    
    def __init__(
        self,
        memory_mb: int = 8192,
        cpu_cores: float = 2.0,
        execution_timeout: int = 300,
        disk_quota_mb: int = 1024,
        network_bandwidth_mbps: Optional[int] = None
    ):
        self.memory_mb = memory_mb
        self.cpu_cores = cpu_cores
        self.execution_timeout = execution_timeout
        self.disk_quota_mb = disk_quota_mb
        self.network_bandwidth_mbps = network_bandwidth_mbps


class DockerEngine:
    """Advanced Docker integration for secure AI task execution."""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.logger = logging.getLogger(__name__)
        self.client: Optional[docker.DockerClient] = None
        
        # Configuration
        self.base_image = config.get('docker_base_image', 'neurogrid/ai-worker:latest')
        self.network_name = config.get('docker_network', 'neurogrid')
        self.enable_gpu = config.get('enable_gpu_passthrough', True)
        self.max_containers = config.get('max_concurrent_containers', 3)
        
        # Container tracking
        self.active_containers: Dict[str, Container] = {}
        self.container_stats: Dict[str, Dict] = {}
        
        # Security settings
        self.security_enabled = config.get('enable_container_security', True)
        self.user_namespace = config.get('docker_user_namespace', 'neurogrid')
        
        self.logger.info("DockerEngine initialized")
    
    async def initialize(self):
        """Initialize Docker engine and setup environment."""
        self.logger.info("Initializing Docker engine...")
        
        try:
            # Connect to Docker daemon
            self.client = docker.from_env()
            
            # Verify Docker is running
            self.client.ping()
            self.logger.info("Connected to Docker daemon")
            
            # Setup network
            await self._setup_network()
            
            # Ensure base image is available
            await self._ensure_base_image()
            
            # Cleanup any stale containers
            await self._cleanup_stale_containers()
            
            self.logger.info("Docker engine initialized successfully")
            
        except DockerException as e:
            self.logger.error(f"Failed to initialize Docker: {e}")
            raise
    
    async def _setup_network(self):
        """Setup isolated Docker network for containers."""
        try:
            # Check if network exists
            networks = self.client.networks.list(names=[self.network_name])
            
            if not networks:
                self.logger.info(f"Creating Docker network: {self.network_name}")
                
                # Create isolated network
                network = self.client.networks.create(
                    name=self.network_name,
                    driver="bridge",
                    options={
                        "com.docker.network.bridge.enable_icc": "false",  # Disable inter-container communication
                        "com.docker.network.bridge.enable_ip_masquerade": "false"  # Disable external access
                    },
                    ipam=docker.types.IPAMConfig(
                        pool_configs=[
                            docker.types.IPAMPool(
                                subnet="172.20.0.0/16",
                                gateway="172.20.0.1"
                            )
                        ]
                    )
                )
                self.logger.info(f"Created Docker network: {network.name}")
            else:
                self.logger.info(f"Using existing Docker network: {self.network_name}")
                
        except Exception as e:
            self.logger.warning(f"Failed to setup Docker network: {e}")
            # Continue without custom network - will use default
    
    async def _ensure_base_image(self):
        """Ensure base Docker image is available."""
        try:
            # Check if image exists locally
            images = self.client.images.list(name=self.base_image)
            
            if not images:
                self.logger.info(f"Base image not found, building: {self.base_image}")
                await self._build_base_image()
            else:
                self.logger.info(f"Base image available: {self.base_image}")
                
        except Exception as e:
            self.logger.warning(f"Failed to ensure base image: {e}")
    
    async def _build_base_image(self):
        """Build base Docker image for AI task execution."""
        dockerfile_content = self._generate_dockerfile()
        
        # Create temporary build context
        with tempfile.TemporaryDirectory() as build_dir:
            dockerfile_path = Path(build_dir) / "Dockerfile"
            
            with open(dockerfile_path, 'w') as f:
                f.write(dockerfile_content)
            
            self.logger.info("Building base Docker image...")
            
            try:
                image, logs = self.client.images.build(
                    path=build_dir,
                    tag=self.base_image,
                    rm=True,
                    forcerm=True
                )
                
                # Log build output
                for log in logs:
                    if 'stream' in log:
                        self.logger.debug(log['stream'].strip())
                
                self.logger.info(f"Built base image: {image.short_id}")
                
            except Exception as e:
                self.logger.error(f"Failed to build base image: {e}")
                # Fallback to a standard Python image
                self.base_image = "python:3.9-slim"
                self.logger.info(f"Using fallback image: {self.base_image}")
    
    def _generate_dockerfile(self) -> str:
        """Generate Dockerfile for AI worker container."""
        return """
FROM python:3.9-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \\
    gcc \\
    g++ \\
    curl \\
    wget \\
    git \\
    && rm -rf /var/lib/apt/lists/*

# Install Python packages
RUN pip install --no-cache-dir \\
    torch \\
    transformers \\
    diffusers \\
    whisper-openai \\
    numpy \\
    pillow \\
    librosa \\
    soundfile

# Create non-root user
RUN useradd -m -u 1000 worker
USER worker
WORKDIR /workspace

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV TORCH_HOME=/tmp/torch
ENV HF_HOME=/tmp/huggingface

# Default command
CMD ["python", "-c", "print('NeuroGrid AI Worker Container Ready')"]
"""
    
    async def create_container(self, task_data: Dict[str, Any], spec: Optional[ContainerSpec] = None) -> str:
        """Create a new container for task execution."""
        if len(self.active_containers) >= self.max_containers:
            raise RuntimeError("Maximum number of containers reached")
        
        if spec is None:
            spec = self._create_default_spec(task_data)
        
        # Generate unique container name
        container_name = f"neurogrid-task-{task_data.get('id', int(time.time()))}"
        
        try:
            self.logger.info(f"Creating container: {container_name}")
            
            # Prepare container configuration
            container_config = await self._prepare_container_config(spec, task_data)
            
            # Create container
            container = self.client.containers.create(
                image=spec.image,
                name=container_name,
                **container_config
            )
            
            # Track container
            self.active_containers[container.id] = container
            self.container_stats[container.id] = {
                'created_at': time.time(),
                'task_id': task_data.get('id'),
                'status': 'created'
            }
            
            self.logger.info(f"Container created: {container.short_id}")
            return container.id
            
        except Exception as e:
            self.logger.error(f"Failed to create container: {e}")
            raise
    
    def _create_default_spec(self, task_data: Dict[str, Any]) -> ContainerSpec:
        """Create default container specification based on task."""
        # Adjust resources based on task requirements
        model_type = task_data.get('model_type', 'text')
        
        memory_limit = "4g"
        cpu_count = 1.0
        gpu_access = False
        
        if model_type == 'image':
            memory_limit = "8g"
            cpu_count = 2.0
            gpu_access = True
        elif model_type == 'text' and 'large' in task_data.get('model', '').lower():
            memory_limit = "12g"
            cpu_count = 2.0
            gpu_access = True
        elif model_type == 'audio':
            memory_limit = "6g"
            cpu_count = 1.5
            gpu_access = True
        
        return ContainerSpec(
            image=self.base_image,
            memory_limit=memory_limit,
            cpu_count=cpu_count,
            gpu_access=gpu_access and self.enable_gpu,
            environment={
                'TASK_TYPE': model_type,
                'TASK_ID': str(task_data.get('id', ''))
            }
        )
    
    async def _prepare_container_config(self, spec: ContainerSpec, task_data: Dict[str, Any]) -> Dict[str, Any]:
        """Prepare Docker container configuration."""
        config = {
            'detach': True,
            'mem_limit': spec.memory_limit,
            'cpu_count': spec.cpu_count,
            'network': self.network_name if spec.network_mode != "none" else None,
            'network_mode': spec.network_mode,
            'read_only': spec.read_only,
            'environment': spec.environment,
            'volumes': spec.volumes,
            'security_opt': spec.security_opts,
            'user': '1000:1000',  # Run as non-root user
            'working_dir': '/workspace'
        }
        
        # GPU access
        if spec.gpu_access and self.enable_gpu:
            try:
                config['device_requests'] = [
                    docker.types.DeviceRequest(count=-1, capabilities=[['gpu']])
                ]
                self.logger.debug("GPU access enabled for container")
            except Exception as e:
                self.logger.warning(f"Failed to enable GPU access: {e}")
        
        # Resource limits
        if hasattr(docker.types, 'Resources'):
            config['host_config'] = docker.types.HostConfig(
                cpu_period=100000,
                cpu_quota=int(spec.cpu_count * 100000),
                memory=docker.types.parse_bytes(spec.memory_limit),
                memswap_limit=docker.types.parse_bytes(spec.memory_limit),
                pids_limit=1024,
                ulimits=[
                    docker.types.Ulimit(name='nofile', soft=1024, hard=1024),
                    docker.types.Ulimit(name='nproc', soft=512, hard=512)
                ]
            )
        
        # Security options
        if self.security_enabled:
            config.setdefault('security_opt', []).extend([
                'apparmor=unconfined',  # May need adjustment
                'no-new-privileges:true'
            ])
        
        return config
    
    async def start_container(self, container_id: str) -> bool:
        """Start a container."""
        if container_id not in self.active_containers:
            raise ValueError(f"Container not found: {container_id}")
        
        container = self.active_containers[container_id]
        
        try:
            self.logger.info(f"Starting container: {container.short_id}")
            container.start()
            
            # Update status
            self.container_stats[container_id]['status'] = 'running'
            self.container_stats[container_id]['started_at'] = time.time()
            
            self.logger.info(f"Container started: {container.short_id}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to start container: {e}")
            return False
    
    async def execute_in_container(
        self, 
        container_id: str, 
        model: Any, 
        input_data: Any,
        timeout: int = 300
    ) -> Any:
        """Execute AI inference task in container."""
        if container_id not in self.active_containers:
            raise ValueError(f"Container not found: {container_id}")
        
        container = self.active_containers[container_id]
        
        try:
            # Prepare execution script
            script_content = await self._prepare_execution_script(model, input_data)
            
            # Copy script to container
            await self._copy_to_container(container, "/workspace/task.py", script_content)
            
            # Execute script
            self.logger.info(f"Executing task in container: {container.short_id}")
            
            exec_result = container.exec_run(
                cmd=["python", "/workspace/task.py"],
                workdir="/workspace",
                user="1000",
                environment={"PYTHONPATH": "/workspace"},
                demux=True
            )
            
            # Check execution result
            if exec_result.exit_code == 0:
                # Parse result
                stdout_output = exec_result.output[0].decode() if exec_result.output[0] else ""
                result = self._parse_execution_result(stdout_output)
                
                self.logger.info(f"Task completed successfully in container: {container.short_id}")
                return result
            else:
                error_output = exec_result.output[1].decode() if exec_result.output[1] else "Unknown error"
                raise RuntimeError(f"Task execution failed: {error_output}")
                
        except Exception as e:
            self.logger.error(f"Container execution error: {e}")
            raise
        finally:
            # Update statistics
            self.container_stats[container_id]['last_execution'] = time.time()
    
    async def _prepare_execution_script(self, model: Any, input_data: Any) -> str:
        """Prepare Python script for task execution."""
        # This is a simplified version - would need to be more sophisticated
        # based on model type and input format
        
        script = f"""
import json
import sys
import traceback
import base64
from pathlib import Path

def main():
    try:
        # Input data
        input_data = {json.dumps(input_data)}
        
        # Model execution would be implemented here
        # This is a placeholder that would be replaced with actual model inference
        
        result = {{
            "status": "success",
            "output": "Task executed successfully",
            "input_data": input_data,
            "timestamp": time.time()
        }}
        
        print(json.dumps(result))
        
    except Exception as e:
        error_result = {{
            "status": "error",
            "error": str(e),
            "traceback": traceback.format_exc()
        }}
        print(json.dumps(error_result))
        sys.exit(1)

if __name__ == "__main__":
    import time
    main()
"""
        return script
    
    async def _copy_to_container(self, container: Container, dest_path: str, content: str):
        """Copy content to container."""
        # Create tarfile in memory
        tar_stream = io.BytesIO()
        tar = tarfile.TarFile(fileobj=tar_stream, mode='w')
        
        # Add file to tar
        tarinfo = tarfile.TarInfo(name=Path(dest_path).name)
        tarinfo.size = len(content.encode())
        tar.addfile(tarinfo, io.BytesIO(content.encode()))
        tar.close()
        
        # Copy to container
        tar_stream.seek(0)
        container.put_archive(
            path=str(Path(dest_path).parent),
            data=tar_stream.read()
        )
    
    def _parse_execution_result(self, output: str) -> Any:
        """Parse execution result from container output."""
        try:
            # Try to parse as JSON
            result = json.loads(output.strip())
            return result
        except json.JSONDecodeError:
            # Return raw output if not JSON
            return {"output": output.strip()}
    
    async def stop_container(self, container_id: str, timeout: int = 10) -> bool:
        """Stop a container."""
        if container_id not in self.active_containers:
            return True  # Already stopped/removed
        
        container = self.active_containers[container_id]
        
        try:
            self.logger.info(f"Stopping container: {container.short_id}")
            container.stop(timeout=timeout)
            
            # Update status
            self.container_stats[container_id]['status'] = 'stopped'
            self.container_stats[container_id]['stopped_at'] = time.time()
            
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to stop container: {e}")
            return False
    
    async def remove_container(self, container_id: str, force: bool = False) -> bool:
        """Remove a container."""
        if container_id not in self.active_containers:
            return True
        
        container = self.active_containers[container_id]
        
        try:
            self.logger.info(f"Removing container: {container.short_id}")
            
            # Stop first if running
            if container.status == 'running':
                await self.stop_container(container_id)
            
            # Remove container
            container.remove(force=force)
            
            # Remove from tracking
            del self.active_containers[container_id]
            if container_id in self.container_stats:
                del self.container_stats[container_id]
            
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to remove container: {e}")
            return False
    
    async def get_container_stats(self, container_id: str) -> Optional[Dict[str, Any]]:
        """Get container resource usage statistics."""
        if container_id not in self.active_containers:
            return None
        
        container = self.active_containers[container_id]
        
        try:
            stats = container.stats(stream=False)
            
            # Calculate CPU usage percentage
            cpu_stats = stats['cpu_stats']
            precpu_stats = stats['precpu_stats']
            
            cpu_usage = 0.0
            if 'cpu_usage' in cpu_stats and 'cpu_usage' in precpu_stats:
                cpu_delta = cpu_stats['cpu_usage']['total_usage'] - precpu_stats['cpu_usage']['total_usage']
                system_delta = cpu_stats['system_cpu_usage'] - precpu_stats['system_cpu_usage']
                cpu_count = len(cpu_stats['cpu_usage']['percpu_usage'])
                
                if system_delta > 0:
                    cpu_usage = (cpu_delta / system_delta) * cpu_count * 100.0
            
            # Memory usage
            memory_stats = stats['memory_stats']
            memory_usage = memory_stats.get('usage', 0)
            memory_limit = memory_stats.get('limit', 0)
            memory_percent = (memory_usage / memory_limit * 100) if memory_limit > 0 else 0
            
            return {
                'container_id': container_id,
                'cpu_percent': round(cpu_usage, 2),
                'memory_usage_mb': round(memory_usage / (1024 * 1024), 2),
                'memory_limit_mb': round(memory_limit / (1024 * 1024), 2),
                'memory_percent': round(memory_percent, 2),
                'network_rx_bytes': stats.get('networks', {}).get('eth0', {}).get('rx_bytes', 0),
                'network_tx_bytes': stats.get('networks', {}).get('eth0', {}).get('tx_bytes', 0),
                'timestamp': time.time()
            }
            
        except Exception as e:
            self.logger.error(f"Failed to get container stats: {e}")
            return None
    
    async def cleanup_stale_containers(self):
        """Cleanup stale containers."""
        await self._cleanup_stale_containers()
    
    async def _cleanup_stale_containers(self):
        """Remove old containers with neurogrid prefix."""
        try:
            containers = self.client.containers.list(
                all=True,
                filters={'name': 'neurogrid-task-'}
            )
            
            for container in containers:
                try:
                    self.logger.info(f"Cleaning up stale container: {container.short_id}")
                    container.remove(force=True)
                except Exception as e:
                    self.logger.warning(f"Failed to remove stale container {container.short_id}: {e}")
            
        except Exception as e:
            self.logger.error(f"Failed to cleanup stale containers: {e}")
    
    async def cleanup(self):
        """Cleanup all resources."""
        self.logger.info("Cleaning up Docker engine...")
        
        # Stop and remove all active containers
        for container_id in list(self.active_containers.keys()):
            await self.remove_container(container_id, force=True)
        
        # Cleanup stale containers
        await self._cleanup_stale_containers()
        
        self.logger.info("Docker engine cleanup completed")
    
    def get_active_containers(self) -> Dict[str, Dict[str, Any]]:
        """Get information about active containers."""
        result = {}
        
        for container_id, container in self.active_containers.items():
            try:
                container.reload()  # Refresh status
                
                result[container_id] = {
                    'short_id': container.short_id,
                    'name': container.name,
                    'status': container.status,
                    'image': container.image.tags[0] if container.image.tags else 'unknown',
                    'created': self.container_stats.get(container_id, {}).get('created_at'),
                    'task_id': self.container_stats.get(container_id, {}).get('task_id')
                }
            except Exception as e:
                self.logger.warning(f"Failed to get container info for {container_id}: {e}")
        
        return result