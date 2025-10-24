"""
Advanced API Client for Coordinator Communication

Handles all communication with the NeuroGrid coordinator server
including registration, heartbeats, task management, and metrics.
"""

import asyncio
import aiohttp
import json
import logging
import time
from typing import Dict, List, Optional, Any, Callable
from datetime import datetime, timedelta
from urllib.parse import urljoin
import websockets
from websockets.exceptions import ConnectionClosed, WebSocketException


class ConnectionManager:
    """Manages connection state and retry logic."""
    
    def __init__(self, base_url: str, max_retries: int = 5, backoff_factor: float = 2.0):
        self.base_url = base_url.rstrip('/')
        self.max_retries = max_retries
        self.backoff_factor = backoff_factor
        self.connected = False
        self.last_connection_attempt = 0
        self.connection_failures = 0
        
    def get_retry_delay(self) -> float:
        """Calculate exponential backoff delay."""
        return min(300, self.backoff_factor ** self.connection_failures)  # Max 5 minutes
    
    def on_connection_success(self):
        """Reset connection state on successful connection."""
        self.connected = True
        self.connection_failures = 0
    
    def on_connection_failure(self):
        """Update connection state on failure."""
        self.connected = False
        self.connection_failures += 1
        self.last_connection_attempt = time.time()


class CoordinatorClient:
    """Advanced API client for coordinator communication."""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.logger = logging.getLogger(__name__)
        
        # Connection settings
        self.base_url = config['coordinator_url'].rstrip('/')
        self.node_id = config.get('node_id')
        self.node_token = config.get('node_token')
        
        # HTTP client settings
        self.timeout = aiohttp.ClientTimeout(total=30, connect=10)
        self.session: Optional[aiohttp.ClientSession] = None
        
        # Connection management
        self.connection_manager = ConnectionManager(
            self.base_url,
            max_retries=config.get('max_retries', 5),
            backoff_factor=config.get('retry_backoff', 2.0)
        )
        
        # WebSocket settings
        self.websocket_url = self.base_url.replace('http', 'ws') + '/ws'
        self.websocket: Optional[websockets.WebSocketServerProtocol] = None
        self.websocket_handlers: Dict[str, Callable] = {}
        
        # Request tracking
        self.request_count = 0
        self.last_heartbeat = 0
        self.last_metrics_send = 0
        
        # Rate limiting
        self.rate_limit_requests = config.get('rate_limit_per_minute', 60)
        self.request_timestamps: List[float] = []
        
        self.logger.info(f"CoordinatorClient initialized for {self.base_url}")
    
    async def initialize(self):
        """Initialize the API client."""
        await self._create_session()
        self.logger.info("CoordinatorClient initialized")
    
    async def _create_session(self):
        """Create aiohttp session with proper configuration."""
        if self.session and not self.session.closed:
            return
        
        # Headers for all requests
        headers = {
            'User-Agent': 'NeuroGrid-Node/1.0',
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
        
        if self.node_token:
            headers['Authorization'] = f'Bearer {self.node_token}'
        
        connector = aiohttp.TCPConnector(
            limit=20,
            limit_per_host=10,
            ttl_dns_cache=300,
            use_dns_cache=True,
            keepalive_timeout=30,
            enable_cleanup_closed=True
        )
        
        self.session = aiohttp.ClientSession(
            connector=connector,
            timeout=self.timeout,
            headers=headers,
            json_serialize=json.dumps,
            raise_for_status=False  # Handle status codes manually
        )
    
    async def close(self):
        """Close the API client and cleanup resources."""
        if self.websocket:
            await self.websocket.close()
        
        if self.session and not self.session.closed:
            await self.session.close()
        
        self.logger.info("CoordinatorClient closed")
    
    async def _make_request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict] = None,
        params: Optional[Dict] = None,
        retry_count: int = 0
    ) -> Dict[str, Any]:
        """Make HTTP request with retry logic and error handling."""
        
        # Rate limiting check
        if not self._check_rate_limit():
            raise Exception("Rate limit exceeded")
        
        # Ensure session exists
        await self._create_session()
        
        url = urljoin(self.base_url + '/', endpoint.lstrip('/'))
        
        try:
            self.logger.debug(f"{method} {url}")
            
            async with self.session.request(
                method=method,
                url=url,
                json=data,
                params=params
            ) as response:
                
                self.request_count += 1
                self._track_request_time()
                
                # Handle different status codes
                if response.status == 200:
                    self.connection_manager.on_connection_success()
                    
                    content_type = response.headers.get('content-type', '')
                    if 'application/json' in content_type:
                        return await response.json()
                    else:
                        text_content = await response.text()
                        return {'success': True, 'data': text_content}
                
                elif response.status == 401:
                    error_msg = "Authentication failed - invalid node token"
                    self.logger.error(error_msg)
                    raise Exception(error_msg)
                
                elif response.status == 403:
                    error_msg = "Access forbidden - node not authorized"
                    self.logger.error(error_msg)
                    raise Exception(error_msg)
                
                elif response.status == 429:
                    # Rate limited
                    retry_after = int(response.headers.get('Retry-After', 60))
                    self.logger.warning(f"Rate limited, retry after {retry_after}s")
                    
                    if retry_count < self.connection_manager.max_retries:
                        await asyncio.sleep(retry_after)
                        return await self._make_request(method, endpoint, data, params, retry_count + 1)
                    else:
                        raise Exception("Rate limit exceeded, max retries reached")
                
                elif response.status >= 500:
                    # Server error - retry
                    error_text = await response.text()
                    self.logger.warning(f"Server error {response.status}: {error_text}")
                    
                    if retry_count < self.connection_manager.max_retries:
                        delay = self.connection_manager.get_retry_delay()
                        self.logger.info(f"Retrying in {delay}s...")
                        await asyncio.sleep(delay)
                        self.connection_manager.on_connection_failure()
                        return await self._make_request(method, endpoint, data, params, retry_count + 1)
                    else:
                        raise Exception(f"Server error {response.status}: {error_text}")
                
                else:
                    # Client error
                    error_text = await response.text()
                    error_msg = f"Request failed {response.status}: {error_text}"
                    self.logger.error(error_msg)
                    raise Exception(error_msg)
        
        except aiohttp.ClientError as e:
            self.connection_manager.on_connection_failure()
            self.logger.error(f"Network error: {e}")
            
            if retry_count < self.connection_manager.max_retries:
                delay = self.connection_manager.get_retry_delay()
                self.logger.info(f"Retrying in {delay}s...")
                await asyncio.sleep(delay)
                return await self._make_request(method, endpoint, data, params, retry_count + 1)
            else:
                raise Exception(f"Network error after {retry_count} retries: {e}")
        
        except Exception as e:
            self.logger.error(f"Unexpected error in request: {e}")
            raise
    
    def _check_rate_limit(self) -> bool:
        """Check if request is within rate limits."""
        now = time.time()
        
        # Remove old timestamps (older than 1 minute)
        self.request_timestamps = [ts for ts in self.request_timestamps if now - ts < 60]
        
        # Check if we're under the limit
        if len(self.request_timestamps) >= self.rate_limit_requests:
            self.logger.warning("Rate limit reached")
            return False
        
        return True
    
    def _track_request_time(self):
        """Track request timestamp for rate limiting."""
        self.request_timestamps.append(time.time())
    
    async def register_node(self, registration_data: Dict[str, Any]) -> Dict[str, Any]:
        """Register this node with the coordinator."""
        self.logger.info("Registering node with coordinator...")
        
        try:
            response = await self._make_request('POST', '/api/nodes/register', registration_data)
            
            if response.get('success'):
                self.logger.info("Node registration successful")
                
                # Update node credentials if provided
                if 'node_token' in response:
                    self.node_token = response['node_token']
                    # Update session headers
                    if self.session:
                        self.session.headers['Authorization'] = f'Bearer {self.node_token}'
                
                return response
            else:
                error_msg = response.get('error', 'Unknown registration error')
                raise Exception(f"Registration failed: {error_msg}")
        
        except Exception as e:
            self.logger.error(f"Node registration failed: {e}")
            raise
    
    async def send_heartbeat(self, heartbeat_data: Dict[str, Any]) -> Dict[str, Any]:
        """Send heartbeat to coordinator."""
        try:
            response = await self._make_request('POST', '/api/nodes/heartbeat', heartbeat_data)
            self.last_heartbeat = time.time()
            
            self.logger.debug("Heartbeat sent successfully")
            return response
        
        except Exception as e:
            self.logger.error(f"Heartbeat failed: {e}")
            # Don't raise exception for heartbeat failures
            return {'success': False, 'error': str(e)}
    
    async def send_metrics(self, metrics_data: Dict[str, Any]) -> Dict[str, Any]:
        """Send system metrics to coordinator."""
        try:
            response = await self._make_request('POST', '/api/nodes/metrics', metrics_data)
            self.last_metrics_send = time.time()
            
            self.logger.debug("Metrics sent successfully")
            return response
        
        except Exception as e:
            self.logger.error(f"Metrics send failed: {e}")
            return {'success': False, 'error': str(e)}
    
    async def get_available_tasks(self) -> List[Dict[str, Any]]:
        """Get list of available tasks from coordinator."""
        try:
            response = await self._make_request('GET', f'/api/nodes/{self.node_id}/tasks')
            
            if response.get('success'):
                return response.get('tasks', [])
            else:
                self.logger.warning(f"Failed to get tasks: {response.get('error')}")
                return []
        
        except Exception as e:
            self.logger.error(f"Failed to get available tasks: {e}")
            return []
    
    async def accept_task(self, task_id: str) -> Dict[str, Any]:
        """Accept a task assignment."""
        try:
            response = await self._make_request(
                'POST',
                f'/api/tasks/{task_id}/accept',
                {'node_id': self.node_id}
            )
            
            self.logger.info(f"Task accepted: {task_id}")
            return response
        
        except Exception as e:
            self.logger.error(f"Failed to accept task {task_id}: {e}")
            raise
    
    async def submit_task_result(self, task_id: str, result_data: Dict[str, Any]) -> Dict[str, Any]:
        """Submit task execution result."""
        try:
            payload = {
                'node_id': self.node_id,
                'result': result_data,
                'timestamp': time.time()
            }
            
            response = await self._make_request(
                'POST',
                f'/api/tasks/{task_id}/result',
                payload
            )
            
            self.logger.info(f"Task result submitted: {task_id}")
            return response
        
        except Exception as e:
            self.logger.error(f"Failed to submit result for task {task_id}: {e}")
            raise
    
    async def report_task_error(self, task_id: str, error_details: Dict[str, Any]) -> Dict[str, Any]:
        """Report task execution error."""
        try:
            payload = {
                'node_id': self.node_id,
                'error': error_details,
                'timestamp': time.time()
            }
            
            response = await self._make_request(
                'POST',
                f'/api/tasks/{task_id}/error',
                payload
            )
            
            self.logger.info(f"Task error reported: {task_id}")
            return response
        
        except Exception as e:
            self.logger.error(f"Failed to report error for task {task_id}: {e}")
            return {'success': False, 'error': str(e)}
    
    async def update_node_status(self, status_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update node status information."""
        try:
            response = await self._make_request(
                'PUT',
                f'/api/nodes/{self.node_id}/status',
                status_data
            )
            
            return response
        
        except Exception as e:
            self.logger.error(f"Failed to update node status: {e}")
            return {'success': False, 'error': str(e)}
    
    async def get_node_config(self) -> Dict[str, Any]:
        """Get node configuration from coordinator."""
        try:
            response = await self._make_request('GET', f'/api/nodes/{self.node_id}/config')
            
            if response.get('success'):
                return response.get('config', {})
            else:
                return {}
        
        except Exception as e:
            self.logger.error(f"Failed to get node config: {e}")
            return {}
    
    async def get_network_info(self) -> Dict[str, Any]:
        """Get network information and statistics."""
        try:
            response = await self._make_request('GET', '/api/network/info')
            
            if response.get('success'):
                return response.get('network_info', {})
            else:
                return {}
        
        except Exception as e:
            self.logger.error(f"Failed to get network info: {e}")
            return {}
    
    async def connect_websocket(self, message_handler: Callable[[Dict], None]) -> bool:
        """Connect to coordinator WebSocket for real-time communication."""
        try:
            self.logger.info(f"Connecting to WebSocket: {self.websocket_url}")
            
            headers = {}
            if self.node_token:
                headers['Authorization'] = f'Bearer {self.node_token}'
            
            self.websocket = await websockets.connect(
                self.websocket_url,
                extra_headers=headers,
                ping_interval=30,
                ping_timeout=10,
                close_timeout=10
            )
            
            # Send authentication message
            auth_message = {
                'type': 'node_auth',
                'payload': {
                    'node_id': self.node_id,
                    'timestamp': time.time()
                }
            }
            
            await self.websocket.send(json.dumps(auth_message))
            
            # Start message handling loop
            asyncio.create_task(self._websocket_message_loop(message_handler))
            
            self.logger.info("WebSocket connected successfully")
            return True
        
        except Exception as e:
            self.logger.error(f"WebSocket connection failed: {e}")
            return False
    
    async def _websocket_message_loop(self, message_handler: Callable[[Dict], None]):
        """Handle incoming WebSocket messages."""
        try:
            async for message in self.websocket:
                try:
                    data = json.loads(message)
                    await message_handler(data)
                except json.JSONDecodeError:
                    self.logger.warning(f"Invalid JSON in WebSocket message: {message}")
                except Exception as e:
                    self.logger.error(f"Error handling WebSocket message: {e}")
        
        except ConnectionClosed:
            self.logger.warning("WebSocket connection closed")
        except WebSocketException as e:
            self.logger.error(f"WebSocket error: {e}")
        except Exception as e:
            self.logger.error(f"Unexpected WebSocket error: {e}")
        finally:
            self.websocket = None
    
    async def send_websocket_message(self, message: Dict[str, Any]) -> bool:
        """Send message via WebSocket."""
        if not self.websocket:
            self.logger.warning("WebSocket not connected")
            return False
        
        try:
            await self.websocket.send(json.dumps(message))
            return True
        except Exception as e:
            self.logger.error(f"Failed to send WebSocket message: {e}")
            return False
    
    async def disconnect_websocket(self):
        """Disconnect from WebSocket."""
        if self.websocket:
            try:
                await self.websocket.close()
            except Exception as e:
                self.logger.warning(f"Error closing WebSocket: {e}")
            finally:
                self.websocket = None
    
    def is_connected(self) -> bool:
        """Check if client is connected to coordinator."""
        return self.connection_manager.connected
    
    def get_connection_stats(self) -> Dict[str, Any]:
        """Get connection statistics."""
        return {
            'connected': self.connection_manager.connected,
            'connection_failures': self.connection_manager.connection_failures,
            'last_connection_attempt': self.connection_manager.last_connection_attempt,
            'request_count': self.request_count,
            'last_heartbeat': self.last_heartbeat,
            'last_metrics_send': self.last_metrics_send,
            'rate_limit_requests_per_minute': self.rate_limit_requests,
            'recent_requests': len(self.request_timestamps),
            'websocket_connected': self.websocket is not None
        }
    
    async def health_check(self) -> Dict[str, Any]:
        """Perform health check with coordinator."""
        try:
            start_time = time.time()
            response = await self._make_request('GET', '/api/health')
            end_time = time.time()
            
            return {
                'success': True,
                'response_time_ms': round((end_time - start_time) * 1000, 2),
                'coordinator_status': response.get('status', 'unknown'),
                'timestamp': end_time
            }
        
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'timestamp': time.time()
            }
    
    async def get_task_details(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get detailed information about a specific task."""
        try:
            response = await self._make_request('GET', f'/api/tasks/{task_id}')
            
            if response.get('success'):
                return response.get('task')
            else:
                return None
        
        except Exception as e:
            self.logger.error(f"Failed to get task details for {task_id}: {e}")
            return None
    
    async def request_task_cancellation(self, task_id: str, reason: str) -> Dict[str, Any]:
        """Request cancellation of a running task."""
        try:
            payload = {
                'node_id': self.node_id,
                'reason': reason,
                'timestamp': time.time()
            }
            
            response = await self._make_request(
                'POST',
                f'/api/tasks/{task_id}/cancel',
                payload
            )
            
            return response
        
        except Exception as e:
            self.logger.error(f"Failed to request task cancellation for {task_id}: {e}")
            return {'success': False, 'error': str(e)}
    
    async def get_earnings_info(self) -> Dict[str, Any]:
        """Get node earnings and token information."""
        try:
            response = await self._make_request('GET', f'/api/nodes/{self.node_id}/earnings')
            
            if response.get('success'):
                return response.get('earnings', {})
            else:
                return {}
        
        except Exception as e:
            self.logger.error(f"Failed to get earnings info: {e}")
            return {}
    
    async def submit_performance_report(self, report_data: Dict[str, Any]) -> Dict[str, Any]:
        """Submit performance report to coordinator."""
        try:
            payload = {
                'node_id': self.node_id,
                'report': report_data,
                'timestamp': time.time()
            }
            
            response = await self._make_request(
                'POST',
                f'/api/nodes/{self.node_id}/performance',
                payload
            )
            
            return response
        
        except Exception as e:
            self.logger.error(f"Failed to submit performance report: {e}")
            return {'success': False, 'error': str(e)}