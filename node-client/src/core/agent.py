"""
NeuroGrid Node Agent - Core Agent Implementation

This module contains the main NodeAgent class that manages the lifecycle
of a NeuroGrid node, including task execution, resource monitoring,
and communication with the coordinator server.
"""

import asyncio
import logging
import json
import uuid
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
import aiohttp
import websockets
from pathlib import Path

from ..utils.logger import get_logger
from ..models.loader import ModelLoader
from ..container.docker_engine import DockerEngine
from ..metrics.collector import MetricsCollector
from ..utils.crypto import CryptoManager
from ..utils.api_client import CoordinatorClient


class NodeAgent:
    """
    Main agent class for NeuroGrid nodes.
    
    Handles:
    - Registration with coordinator
    - Task reception and execution
    - Resource monitoring
    - Result transmission
    - Token tracking
    """
    
    def __init__(self, config: Dict[str, Any]):
        """Initialize the node agent with configuration."""
        self.config = config
        self.logger = get_logger(__name__)
        
        # Generate or load node ID
        self.node_id = self._get_or_create_node_id()
        
        # Initialize components
        self.model_loader = ModelLoader(config)
        self.docker_engine = DockerEngine(config) if config.get('enable_docker') else None
        self.metrics_collector = MetricsCollector(config)
        self.crypto_manager = CryptoManager(config)
        self.api_client = CoordinatorClient(config)
        
        # State management
        self.running = False
        self.current_task = None
        self.websocket = None
        self.heartbeat_task = None
        self.metrics_task = None
        
        # Performance tracking
        self.tasks_completed = 0
        self.tasks_failed = 0
        self.total_earnings = 0.0
        self.start_time = None
        
        self.logger.info(f"NodeAgent initialized with ID: {self.node_id}")

    def _get_or_create_node_id(self) -> str:
        """Get existing node ID or create a new one."""
        node_id_file = Path('data/node_id.txt')
        
        if node_id_file.exists():
            with open(node_id_file, 'r') as f:
                node_id = f.read().strip()
                self.logger.info(f"Loaded existing node ID: {node_id}")
                return node_id
        else:
            node_id = str(uuid.uuid4())
            node_id_file.parent.mkdir(exist_ok=True)
            with open(node_id_file, 'w') as f:
                f.write(node_id)
            self.logger.info(f"Created new node ID: {node_id}")
            return node_id

    async def start(self):
        """Start the node agent."""
        if self.running:
            self.logger.warning("Node agent is already running")
            return
        
        self.logger.info("🚀 Starting NeuroGrid Node Agent...")
        self.running = True
        self.start_time = datetime.now()
        
        try:
            # Initialize components
            await self._initialize_components()
            
            # Register with coordinator
            await self._register_with_coordinator()
            
            # Start background tasks
            await self._start_background_tasks()
            
            # Connect WebSocket for real-time communication
            await self._connect_websocket()
            
            self.logger.info("✅ Node agent started successfully")
            
        except Exception as e:
            self.logger.error(f"❌ Failed to start node agent: {e}")
            await self.stop()
            raise

    async def stop(self):
        """Stop the node agent gracefully."""
        if not self.running:
            return
        
        self.logger.info("🛑 Stopping NeuroGrid Node Agent...")
        self.running = False
        
        # Stop current task if running
        if self.current_task:
            self.logger.info("Stopping current task...")
            # Implementation depends on task type
        
        # Close WebSocket connection
        if self.websocket:
            await self.websocket.close()
        
        # Stop background tasks
        if self.heartbeat_task:
            self.heartbeat_task.cancel()
        if self.metrics_task:
            self.metrics_task.cancel()
        
        # Cleanup components
        if self.docker_engine:
            await self.docker_engine.cleanup()
        
        self.logger.info("👋 Node agent stopped")

    async def wait_for_shutdown(self):
        """Wait for shutdown signal."""
        try:
            while self.running:
                await asyncio.sleep(1)
        except asyncio.CancelledError:
            await self.stop()

    async def _initialize_components(self):
        """Initialize all node components."""
        self.logger.info("Initializing components...")
        
        # Initialize metrics collector
        await self.metrics_collector.initialize()
        
        # Initialize Docker engine if enabled
        if self.docker_engine:
            await self.docker_engine.initialize()
        
        # Initialize model loader
        await self.model_loader.initialize()
        
        self.logger.info("All components initialized")

    async def _register_with_coordinator(self):
        """Register this node with the coordinator server."""
        self.logger.info("Registering with coordinator...")
        
        # Collect system metrics for registration
        system_info = await self.metrics_collector.get_system_info()
        
        registration_data = {
            'node_id': self.node_id,
            'node_token': self.config.get('node_token'),
            'system_info': system_info,
            'supported_models': self.config.get('supported_models', []),
            'max_vram_gb': self.config.get('max_vram_gb', 8),
            'max_cpu_cores': self.config.get('max_cpu_cores', 4),
            'version': '0.1.0',
            'capabilities': self._get_capabilities()
        }
        
        response = await self.api_client.register_node(registration_data)
        
        if response.get('success'):
            self.logger.info("✅ Successfully registered with coordinator")
            # Store any returned configuration
            if 'config_updates' in response:
                self._apply_config_updates(response['config_updates'])
        else:
            raise Exception(f"Registration failed: {response.get('error')}")

    def _get_capabilities(self) -> Dict[str, Any]:
        """Get node capabilities and features."""
        capabilities = {
            'docker_enabled': bool(self.docker_engine),
            'gpu_available': self.metrics_collector.has_gpu(),
            'supported_frameworks': ['pytorch', 'transformers'],
            'max_task_timeout': self.config.get('task_timeout', 300),
            'container_isolation': self.config.get('enable_docker', False),
            'encryption_support': True
        }
        
        return capabilities

    def _apply_config_updates(self, updates: Dict[str, Any]):
        """Apply configuration updates from coordinator."""
        self.logger.info(f"Applying config updates: {updates}")
        # Update configuration with coordinator-provided values
        self.config.update(updates)

    async def _start_background_tasks(self):
        """Start background monitoring and communication tasks."""
        self.logger.info("Starting background tasks...")
        
        # Heartbeat task
        heartbeat_interval = self.config.get('heartbeat_interval', 30)
        self.heartbeat_task = asyncio.create_task(
            self._heartbeat_loop(heartbeat_interval)
        )
        
        # Metrics collection task
        metrics_interval = self.config.get('metrics_interval', 60)
        self.metrics_task = asyncio.create_task(
            self._metrics_loop(metrics_interval)
        )

    async def _heartbeat_loop(self, interval: int):
        """Send periodic heartbeat to coordinator."""
        while self.running:
            try:
                heartbeat_data = {
                    'node_id': self.node_id,
                    'timestamp': datetime.now().isoformat(),
                    'status': 'active',
                    'current_task': self.current_task.get('id') if self.current_task else None,
                    'tasks_completed': self.tasks_completed,
                    'uptime': (datetime.now() - self.start_time).total_seconds()
                }
                
                await self.api_client.send_heartbeat(heartbeat_data)
                
            except Exception as e:
                self.logger.error(f"Heartbeat failed: {e}")
            
            await asyncio.sleep(interval)

    async def _metrics_loop(self, interval: int):
        """Collect and send metrics periodically."""
        while self.running:
            try:
                metrics = await self.metrics_collector.collect_metrics()
                
                await self.api_client.send_metrics({
                    'node_id': self.node_id,
                    'timestamp': datetime.now().isoformat(),
                    'metrics': metrics
                })
                
            except Exception as e:
                self.logger.error(f"Metrics collection failed: {e}")
            
            await asyncio.sleep(interval)

    async def _connect_websocket(self):
        """Connect to coordinator WebSocket for real-time communication."""
        ws_url = self.config['coordinator_url'].replace('http', 'ws') + '/ws'
        
        self.logger.info(f"Connecting to WebSocket: {ws_url}")
        
        async def websocket_handler():
            while self.running:
                try:
                    async with websockets.connect(ws_url) as websocket:
                        self.websocket = websocket
                        self.logger.info("✅ WebSocket connected")
                        
                        # Send initial authentication
                        auth_message = {
                            'type': 'node_auth',
                            'payload': {
                                'node_id': self.node_id,
                                'token': self.config.get('node_token')
                            }
                        }
                        await websocket.send(json.dumps(auth_message))
                        
                        # Listen for messages
                        async for message in websocket:
                            await self._handle_websocket_message(json.loads(message))
                            
                except websockets.exceptions.ConnectionClosed:
                    self.logger.warning("WebSocket connection closed, reconnecting...")
                    await asyncio.sleep(5)
                except Exception as e:
                    self.logger.error(f"WebSocket error: {e}")
                    await asyncio.sleep(10)
        
        asyncio.create_task(websocket_handler())

    async def _handle_websocket_message(self, message: Dict[str, Any]):
        """Handle incoming WebSocket messages."""
        message_type = message.get('type')
        payload = message.get('payload', {})
        
        self.logger.debug(f"Received WebSocket message: {message_type}")
        
        if message_type == 'task_assignment':
            await self._handle_task_assignment(payload)
        elif message_type == 'task_cancel':
            await self._handle_task_cancellation(payload)
        elif message_type == 'config_update':
            self._apply_config_updates(payload)
        elif message_type == 'node_command':
            await self._handle_node_command(payload)
        else:
            self.logger.warning(f"Unknown message type: {message_type}")

    async def _handle_task_assignment(self, task_data: Dict[str, Any]):
        """Handle incoming task assignment."""
        if self.current_task:
            # Node is busy, reject task
            await self._send_task_rejection(task_data['id'], 'Node busy')
            return
        
        self.logger.info(f"📝 Received task assignment: {task_data['id']}")
        
        try:
            # Validate task
            if not self._validate_task(task_data):
                await self._send_task_rejection(task_data['id'], 'Task validation failed')
                return
            
            # Accept task
            self.current_task = task_data
            await self._send_task_acceptance(task_data['id'])
            
            # Execute task asynchronously
            asyncio.create_task(self._execute_task(task_data))
            
        except Exception as e:
            self.logger.error(f"Error handling task assignment: {e}")
            await self._send_task_rejection(task_data['id'], str(e))

    def _validate_task(self, task_data: Dict[str, Any]) -> bool:
        """Validate if this node can execute the given task."""
        # Check model support
        model_type = task_data.get('model_type')
        if model_type not in self.config.get('supported_models', []):
            self.logger.warning(f"Unsupported model type: {model_type}")
            return False
        
        # Check resource requirements
        required_vram = task_data.get('required_vram_gb', 0)
        if required_vram > self.config.get('max_vram_gb', 8):
            self.logger.warning(f"Insufficient VRAM: need {required_vram}GB")
            return False
        
        # Additional validation...
        return True

    async def _execute_task(self, task_data: Dict[str, Any]):
        """Execute the assigned task."""
        task_id = task_data['id']
        
        try:
            self.logger.info(f"🚀 Executing task: {task_id}")
            
            # Update task status
            await self._send_task_status(task_id, 'running')
            
            # Load required model
            model_name = task_data['model']
            model = await self.model_loader.load_model(model_name)
            
            # Prepare execution environment
            if self.docker_engine:
                container = await self.docker_engine.create_container(task_data)
                result = await self.docker_engine.execute_in_container(
                    container, model, task_data['input']
                )
            else:
                # Direct execution (less secure)
                result = await self._execute_direct(model, task_data['input'])
            
            # Encrypt result if required
            if self.config.get('encrypt_results', True):
                result = self.crypto_manager.encrypt_data(result)
            
            # Send result
            await self._send_task_result(task_id, result)
            
            self.tasks_completed += 1
            self.logger.info(f"✅ Task completed: {task_id}")
            
        except Exception as e:
            self.logger.error(f"❌ Task execution failed: {e}")
            await self._send_task_error(task_id, str(e))
            self.tasks_failed += 1
        
        finally:
            self.current_task = None

    async def _execute_direct(self, model, input_data):
        """Execute task directly without container isolation."""
        # This is a simplified implementation
        # In practice, this would depend on the model type and framework
        if hasattr(model, 'generate'):
            return model.generate(input_data)
        else:
            return model(input_data)

    async def _send_task_acceptance(self, task_id: str):
        """Send task acceptance message."""
        message = {
            'type': 'task_accepted',
            'payload': {
                'task_id': task_id,
                'node_id': self.node_id,
                'timestamp': datetime.now().isoformat()
            }
        }
        await self.websocket.send(json.dumps(message))

    async def _send_task_rejection(self, task_id: str, reason: str):
        """Send task rejection message."""
        message = {
            'type': 'task_rejected',
            'payload': {
                'task_id': task_id,
                'node_id': self.node_id,
                'reason': reason,
                'timestamp': datetime.now().isoformat()
            }
        }
        await self.websocket.send(json.dumps(message))

    async def _send_task_status(self, task_id: str, status: str):
        """Send task status update."""
        message = {
            'type': 'task_status',
            'payload': {
                'task_id': task_id,
                'node_id': self.node_id,
                'status': status,
                'timestamp': datetime.now().isoformat()
            }
        }
        await self.websocket.send(json.dumps(message))

    async def _send_task_result(self, task_id: str, result: Any):
        """Send task execution result."""
        message = {
            'type': 'task_result',
            'payload': {
                'task_id': task_id,
                'node_id': self.node_id,
                'result': result,
                'timestamp': datetime.now().isoformat(),
                'execution_time': 0  # TODO: Track actual execution time
            }
        }
        await self.websocket.send(json.dumps(message))

    async def _send_task_error(self, task_id: str, error: str):
        """Send task execution error."""
        message = {
            'type': 'task_error',
            'payload': {
                'task_id': task_id,
                'node_id': self.node_id,
                'error': error,
                'timestamp': datetime.now().isoformat()
            }
        }
        await self.websocket.send(json.dumps(message))

    async def _handle_task_cancellation(self, payload: Dict[str, Any]):
        """Handle task cancellation request."""
        task_id = payload.get('task_id')
        
        if self.current_task and self.current_task['id'] == task_id:
            self.logger.info(f"🛑 Cancelling task: {task_id}")
            # Implementation depends on execution method
            self.current_task = None

    async def _handle_node_command(self, payload: Dict[str, Any]):
        """Handle node management commands."""
        command = payload.get('command')
        
        if command == 'restart':
            self.logger.info("Received restart command")
            await self.stop()
            await self.start()
        elif command == 'update_config':
            self._apply_config_updates(payload.get('config', {}))
        elif command == 'clear_cache':
            await self.model_loader.clear_cache()
        else:
            self.logger.warning(f"Unknown command: {command}")

    def get_status(self) -> Dict[str, Any]:
        """Get current node status."""
        uptime = (datetime.now() - self.start_time).total_seconds() if self.start_time else 0
        
        return {
            'node_id': self.node_id,
            'status': 'running' if self.running else 'stopped',
            'uptime': uptime,
            'current_task': self.current_task.get('id') if self.current_task else None,
            'tasks_completed': self.tasks_completed,
            'tasks_failed': self.tasks_failed,
            'success_rate': (
                self.tasks_completed / (self.tasks_completed + self.tasks_failed)
                if (self.tasks_completed + self.tasks_failed) > 0 else 0
            ),
            'total_earnings': self.total_earnings
        }