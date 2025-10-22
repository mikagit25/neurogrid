"""
Configuration Management for NeuroGrid Node Client

This module handles loading, validating, and managing configuration
for the node client application.
"""

import json
import os
from pathlib import Path
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
import logging

from ..utils.logger import get_logger


@dataclass
class NodeConfig:
    """Node configuration data class."""
    coordinator_url: str
    node_token: str
    max_vram_gb: int
    max_cpu_cores: int
    supported_models: List[str]
    data_dir: str
    log_level: str
    heartbeat_interval: int
    task_timeout: int
    enable_docker: bool
    docker_network: str
    metrics_port: int
    
    # Optional configurations
    model_cache_size_gb: int = 20
    auto_download_models: bool = True
    preferred_models: List[str] = None
    encrypt_data: bool = True
    allow_custom_models: bool = False
    sandbox_mode: bool = True
    metrics_interval: int = 60
    
    def __post_init__(self):
        if self.preferred_models is None:
            self.preferred_models = []


class ConfigManager:
    """Manages node configuration loading and validation."""
    
    def __init__(self):
        self.logger = get_logger(__name__)
        self.config_schema = self._get_config_schema()
    
    def load_config(self, config_path: str) -> Dict[str, Any]:
        """Load configuration from file."""
        config_file = Path(config_path)
        
        if not config_file.exists():
            raise FileNotFoundError(f"Configuration file not found: {config_path}")
        
        try:
            with open(config_file, 'r') as f:
                config = json.load(f)
            
            # Apply environment variable overrides
            config = self._apply_env_overrides(config)
            
            # Validate configuration
            validation_errors = self.validate_config(config)
            if validation_errors:
                raise ValueError(f"Configuration validation failed: {validation_errors}")
            
            # Set defaults for missing values
            config = self._apply_defaults(config)
            
            self.logger.info(f"Configuration loaded from: {config_path}")
            return config
            
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON in configuration file: {e}")
        except Exception as e:
            raise Exception(f"Failed to load configuration: {e}")
    
    def validate_config(self, config: Dict[str, Any]) -> List[str]:
        """Validate configuration against schema."""
        errors = []
        
        # Required fields
        required_fields = [
            'coordinator_url',
            'max_vram_gb',
            'max_cpu_cores',
            'supported_models'
        ]
        
        for field in required_fields:
            if field not in config:
                errors.append(f"Missing required field: {field}")
        
        # Type validation
        if 'coordinator_url' in config:
            if not isinstance(config['coordinator_url'], str):
                errors.append("coordinator_url must be a string")
            elif not config['coordinator_url'].startswith(('http://', 'https://')):
                errors.append("coordinator_url must be a valid HTTP/HTTPS URL")
        
        if 'max_vram_gb' in config:
            if not isinstance(config['max_vram_gb'], (int, float)):
                errors.append("max_vram_gb must be a number")
            elif config['max_vram_gb'] <= 0:
                errors.append("max_vram_gb must be greater than 0")
        
        if 'max_cpu_cores' in config:
            if not isinstance(config['max_cpu_cores'], int):
                errors.append("max_cpu_cores must be an integer")
            elif config['max_cpu_cores'] <= 0:
                errors.append("max_cpu_cores must be greater than 0")
        
        if 'supported_models' in config:
            if not isinstance(config['supported_models'], list):
                errors.append("supported_models must be a list")
            else:
                valid_models = ['text', 'image', 'audio', 'multimodal']
                for model in config['supported_models']:
                    if model not in valid_models:
                        errors.append(f"Invalid model type: {model}. Valid types: {valid_models}")
        
        # Additional validations
        if 'heartbeat_interval' in config:
            if not isinstance(config['heartbeat_interval'], int) or config['heartbeat_interval'] < 10:
                errors.append("heartbeat_interval must be an integer >= 10 seconds")
        
        if 'task_timeout' in config:
            if not isinstance(config['task_timeout'], int) or config['task_timeout'] < 60:
                errors.append("task_timeout must be an integer >= 60 seconds")
        
        if 'metrics_port' in config:
            if not isinstance(config['metrics_port'], int) or not (1024 <= config['metrics_port'] <= 65535):
                errors.append("metrics_port must be an integer between 1024 and 65535")
        
        return errors
    
    def _apply_env_overrides(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Apply environment variable overrides."""
        env_mappings = {
            'NEUROGRID_COORDINATOR_URL': 'coordinator_url',
            'NEUROGRID_NODE_TOKEN': 'node_token',
            'NEUROGRID_MAX_VRAM_GB': 'max_vram_gb',
            'NEUROGRID_MAX_CPU_CORES': 'max_cpu_cores',
            'NEUROGRID_LOG_LEVEL': 'log_level',
            'NEUROGRID_ENABLE_DOCKER': 'enable_docker',
            'NEUROGRID_DATA_DIR': 'data_dir'
        }
        
        for env_var, config_key in env_mappings.items():
            if env_var in os.environ:
                value = os.environ[env_var]
                
                # Type conversion based on config key
                if config_key in ['max_vram_gb', 'max_cpu_cores', 'heartbeat_interval', 'task_timeout', 'metrics_port']:
                    try:
                        value = int(value)
                    except ValueError:
                        self.logger.warning(f"Invalid integer value for {env_var}: {value}")
                        continue
                elif config_key in ['enable_docker', 'auto_download_models', 'encrypt_data', 'sandbox_mode']:
                    value = value.lower() in ('true', '1', 'yes', 'on')
                
                config[config_key] = value
                self.logger.info(f"Applied environment override: {config_key} = {value}")
        
        return config
    
    def _apply_defaults(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Apply default values for missing configuration."""
        defaults = {
            'node_token': '',
            'data_dir': './data',
            'log_level': 'INFO',
            'heartbeat_interval': 30,
            'task_timeout': 300,
            'enable_docker': True,
            'docker_network': 'neurogrid',
            'metrics_port': 8080,
            'model_cache_size_gb': 20,
            'auto_download_models': True,
            'preferred_models': [],
            'encrypt_data': True,
            'allow_custom_models': False,
            'sandbox_mode': True,
            'metrics_interval': 60
        }
        
        for key, default_value in defaults.items():
            if key not in config:
                config[key] = default_value
        
        return config
    
    def _get_config_schema(self) -> Dict[str, Any]:
        """Get configuration schema for validation."""
        return {
            "type": "object",
            "required": ["coordinator_url", "max_vram_gb", "max_cpu_cores", "supported_models"],
            "properties": {
                "coordinator_url": {"type": "string", "format": "uri"},
                "node_token": {"type": "string"},
                "max_vram_gb": {"type": "number", "minimum": 1},
                "max_cpu_cores": {"type": "integer", "minimum": 1},
                "supported_models": {
                    "type": "array",
                    "items": {"type": "string", "enum": ["text", "image", "audio", "multimodal"]}
                },
                "data_dir": {"type": "string"},
                "log_level": {"type": "string", "enum": ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]},
                "heartbeat_interval": {"type": "integer", "minimum": 10},
                "task_timeout": {"type": "integer", "minimum": 60},
                "enable_docker": {"type": "boolean"},
                "docker_network": {"type": "string"},
                "metrics_port": {"type": "integer", "minimum": 1024, "maximum": 65535}
            }
        }
    
    def create_example_config(self, output_path: str):
        """Create an example configuration file."""
        example_config = {
            "coordinator_url": "http://localhost:3001",
            "node_token": "your-node-token-here",
            "max_vram_gb": 8,
            "max_cpu_cores": 4,
            "supported_models": ["text", "image"],
            "data_dir": "./data",
            "log_level": "INFO",
            "heartbeat_interval": 30,
            "task_timeout": 300,
            "enable_docker": True,
            "docker_network": "neurogrid",
            "metrics_port": 8080,
            "model_cache_size_gb": 20,
            "auto_download_models": True,
            "preferred_models": [],
            "encrypt_data": True,
            "allow_custom_models": False,
            "sandbox_mode": True,
            "metrics_interval": 60
        }
        
        config_file = Path(output_path)
        config_file.parent.mkdir(parents=True, exist_ok=True)
        
        with open(config_file, 'w') as f:
            json.dump(example_config, f, indent=2)
        
        self.logger.info(f"Example configuration created: {output_path}")
    
    def update_config(self, config_path: str, updates: Dict[str, Any]):
        """Update configuration file with new values."""
        config = self.load_config(config_path)
        config.update(updates)
        
        # Validate updated configuration
        validation_errors = self.validate_config(config)
        if validation_errors:
            raise ValueError(f"Updated configuration is invalid: {validation_errors}")
        
        # Save updated configuration
        with open(config_path, 'w') as f:
            json.dump(config, f, indent=2)
        
        self.logger.info(f"Configuration updated: {config_path}")
    
    def get_config_summary(self, config: Dict[str, Any]) -> str:
        """Get a human-readable summary of the configuration."""
        summary_lines = [
            "NeuroGrid Node Configuration Summary:",
            "=" * 40,
            f"Coordinator URL: {config.get('coordinator_url')}",
            f"Max VRAM: {config.get('max_vram_gb')}GB",
            f"Max CPU Cores: {config.get('max_cpu_cores')}",
            f"Supported Models: {', '.join(config.get('supported_models', []))}",
            f"Docker Enabled: {config.get('enable_docker')}",
            f"Data Directory: {config.get('data_dir')}",
            f"Log Level: {config.get('log_level')}",
            f"Heartbeat Interval: {config.get('heartbeat_interval')}s",
            f"Task Timeout: {config.get('task_timeout')}s",
            f"Metrics Port: {config.get('metrics_port')}"
        ]
        
        if config.get('preferred_models'):
            summary_lines.append(f"Preferred Models: {', '.join(config['preferred_models'])}")
        
        return "\n".join(summary_lines)


def load_config_from_path(config_path: str) -> Dict[str, Any]:
    """Convenience function to load configuration."""
    manager = ConfigManager()
    return manager.load_config(config_path)


def create_default_config():
    """Create default configuration file if it doesn't exist."""
    config_file = Path('config/config.json')
    
    if not config_file.exists():
        manager = ConfigManager()
        manager.create_example_config('config/config.example.json')
        
        print("📝 Configuration file not found.")
        print("📋 Example configuration created at: config/config.example.json")
        print("🔧 Please copy and customize it:")
        print("   cp config/config.example.json config/config.json")
        print("   nano config/config.json")
        
        return False
    
    return True