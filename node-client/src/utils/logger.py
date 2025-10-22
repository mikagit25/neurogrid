"""
Logging Configuration for NeuroGrid Node Client

This module sets up structured logging with different outputs
and formatting for development and production environments.
"""

import logging
import logging.handlers
import sys
from pathlib import Path
from typing import Optional
import json
from datetime import datetime

try:
    import colorlog
    COLORLOG_AVAILABLE = True
except ImportError:
    COLORLOG_AVAILABLE = False

try:
    import structlog
    STRUCTLOG_AVAILABLE = True
except ImportError:
    STRUCTLOG_AVAILABLE = False


class NeuroGridFormatter(logging.Formatter):
    """Custom formatter for NeuroGrid logs."""
    
    def format(self, record):
        # Add custom fields
        record.node_id = getattr(record, 'node_id', 'unknown')
        record.component = getattr(record, 'component', record.name.split('.')[-1])
        
        # Format timestamp
        record.timestamp = datetime.fromtimestamp(record.created).isoformat()
        
        return super().format(record)


class JSONFormatter(logging.Formatter):
    """JSON formatter for structured logging."""
    
    def format(self, record):
        log_entry = {
            'timestamp': datetime.fromtimestamp(record.created).isoformat(),
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
            'module': record.module,
            'function': record.funcName,
            'line': record.lineno
        }
        
        # Add custom fields
        for attr in ['node_id', 'task_id', 'component', 'request_id']:
            if hasattr(record, attr):
                log_entry[attr] = getattr(record, attr)
        
        # Add exception info if present
        if record.exc_info:
            log_entry['exception'] = self.formatException(record.exc_info)
        
        return json.dumps(log_entry)


def setup_logging(
    log_level: str = 'INFO',
    log_file: Optional[str] = None,
    enable_console: bool = True,
    enable_json: bool = False,
    enable_colors: bool = True,
    max_file_size: int = 10 * 1024 * 1024,  # 10MB
    backup_count: int = 5
):
    """
    Set up logging configuration for NeuroGrid node client.
    
    Args:
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_file: Path to log file (optional)
        enable_console: Whether to log to console
        enable_json: Whether to use JSON formatting
        enable_colors: Whether to use colored output (console only)
        max_file_size: Maximum log file size before rotation
        backup_count: Number of backup log files to keep
    """
    # Create logs directory if it doesn't exist
    if log_file:
        log_path = Path(log_file)
        log_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, log_level.upper()))
    
    # Remove existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
    
    # Console handler
    if enable_console:
        console_handler = logging.StreamHandler(sys.stdout)
        
        if enable_colors and COLORLOG_AVAILABLE and not enable_json:
            console_format = (
                '%(log_color)s%(asctime)s - %(name)s - %(levelname)s - '
                '%(message)s%(reset)s'
            )
            console_formatter = colorlog.ColoredFormatter(
                console_format,
                datefmt='%Y-%m-%d %H:%M:%S',
                log_colors={
                    'DEBUG': 'cyan',
                    'INFO': 'green',
                    'WARNING': 'yellow',
                    'ERROR': 'red',
                    'CRITICAL': 'red,bg_white',
                }
            )
        elif enable_json:
            console_formatter = JSONFormatter()
        else:
            console_format = (
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            console_formatter = NeuroGridFormatter(
                console_format,
                datefmt='%Y-%m-%d %H:%M:%S'
            )
        
        console_handler.setFormatter(console_formatter)
        root_logger.addHandler(console_handler)
    
    # File handler
    if log_file:
        file_handler = logging.handlers.RotatingFileHandler(
            log_file,
            maxBytes=max_file_size,
            backupCount=backup_count,
            encoding='utf-8'
        )
        
        if enable_json:
            file_formatter = JSONFormatter()
        else:
            file_format = (
                '%(timestamp)s - %(name)s - %(levelname)s - '
                '[%(component)s] %(message)s'
            )
            file_formatter = NeuroGridFormatter(
                file_format,
                datefmt='%Y-%m-%d %H:%M:%S'
            )
        
        file_handler.setFormatter(file_formatter)
        root_logger.addHandler(file_handler)
    
    # Set specific logger levels
    logging.getLogger('urllib3').setLevel(logging.WARNING)
    logging.getLogger('aiohttp').setLevel(logging.WARNING)
    logging.getLogger('websockets').setLevel(logging.WARNING)
    logging.getLogger('docker').setLevel(logging.WARNING)
    
    # Log startup message
    logger = logging.getLogger(__name__)
    logger.info(f"Logging initialized - Level: {log_level}")
    if log_file:
        logger.info(f"Log file: {log_file}")


def get_logger(name: str, node_id: Optional[str] = None) -> logging.Logger:
    """
    Get a logger instance with optional node ID context.
    
    Args:
        name: Logger name (usually __name__)
        node_id: Node ID to include in log messages
    
    Returns:
        Configured logger instance
    """
    logger = logging.getLogger(name)
    
    # Add node ID to all log records from this logger
    if node_id:
        old_factory = logging.getLogRecordFactory()
        
        def record_factory(*args, **kwargs):
            record = old_factory(*args, **kwargs)
            record.node_id = node_id
            return record
        
        logging.setLogRecordFactory(record_factory)
    
    return logger


class LoggerAdapter(logging.LoggerAdapter):
    """Logger adapter that adds context to log messages."""
    
    def __init__(self, logger, extra):
        super().__init__(logger, extra)
    
    def process(self, msg, kwargs):
        # Add context to the log record
        if 'extra' not in kwargs:
            kwargs['extra'] = {}
        
        kwargs['extra'].update(self.extra)
        return msg, kwargs


def get_contextual_logger(
    name: str,
    node_id: Optional[str] = None,
    task_id: Optional[str] = None,
    component: Optional[str] = None
) -> LoggerAdapter:
    """
    Get a logger with contextual information.
    
    Args:
        name: Logger name
        node_id: Node ID context
        task_id: Task ID context
        component: Component name context
    
    Returns:
        Logger adapter with context
    """
    logger = logging.getLogger(name)
    
    context = {}
    if node_id:
        context['node_id'] = node_id
    if task_id:
        context['task_id'] = task_id
    if component:
        context['component'] = component
    
    return LoggerAdapter(logger, context)


class PerformanceLogger:
    """Logger for performance metrics and timing."""
    
    def __init__(self, logger_name: str = 'neurogrid.performance'):
        self.logger = logging.getLogger(logger_name)
        self.timers = {}
    
    def start_timer(self, name: str):
        """Start a named timer."""
        self.timers[name] = datetime.now()
        self.logger.debug(f"Timer started: {name}")
    
    def end_timer(self, name: str, log_level: int = logging.INFO):
        """End a named timer and log the duration."""
        if name not in self.timers:
            self.logger.warning(f"Timer not found: {name}")
            return None
        
        start_time = self.timers.pop(name)
        duration = (datetime.now() - start_time).total_seconds()
        
        self.logger.log(log_level, f"Timer completed: {name} - {duration:.3f}s")
        return duration
    
    def log_metric(self, name: str, value: float, unit: str = ''):
        """Log a performance metric."""
        unit_str = f" {unit}" if unit else ""
        self.logger.info(f"Metric: {name} = {value}{unit_str}")
    
    def log_counter(self, name: str, count: int = 1):
        """Log a counter increment."""
        self.logger.info(f"Counter: {name} += {count}")


# Global performance logger instance
perf_logger = PerformanceLogger()


def log_function_call(func):
    """Decorator to log function calls and execution time."""
    import functools
    
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        logger = logging.getLogger(func.__module__)
        
        # Log function entry
        logger.debug(f"Entering {func.__name__}")
        
        # Start timer
        start_time = datetime.now()
        
        try:
            result = func(*args, **kwargs)
            
            # Log successful completion
            duration = (datetime.now() - start_time).total_seconds()
            logger.debug(f"Completed {func.__name__} in {duration:.3f}s")
            
            return result
            
        except Exception as e:
            # Log exception
            duration = (datetime.now() - start_time).total_seconds()
            logger.error(f"Exception in {func.__name__} after {duration:.3f}s: {e}")
            raise
    
    return wrapper


def log_async_function_call(func):
    """Decorator to log async function calls and execution time."""
    import functools
    import asyncio
    
    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        logger = logging.getLogger(func.__module__)
        
        # Log function entry
        logger.debug(f"Entering async {func.__name__}")
        
        # Start timer
        start_time = datetime.now()
        
        try:
            result = await func(*args, **kwargs)
            
            # Log successful completion
            duration = (datetime.now() - start_time).total_seconds()
            logger.debug(f"Completed async {func.__name__} in {duration:.3f}s")
            
            return result
            
        except Exception as e:
            # Log exception
            duration = (datetime.now() - start_time).total_seconds()
            logger.error(f"Exception in async {func.__name__} after {duration:.3f}s: {e}")
            raise
    
    return wrapper


# Default logging setup for when module is imported
if __name__ != '__main__':
    # Basic setup when imported
    setup_logging(
        log_level='INFO',
        log_file='logs/neurogrid-node.log',
        enable_console=True,
        enable_json=False,
        enable_colors=True
    )