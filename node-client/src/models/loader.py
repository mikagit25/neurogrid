"""
NeuroGrid Model Loader

This module provides functionality for loading, caching, and managing AI models.
"""

import logging
import os
from typing import Dict, Any, Optional, List
from pathlib import Path
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, AutoModel
from diffusers import StableDiffusionPipeline

from ..utils.logger import get_logger


class ModelLoader:
    """
    Handles loading and management of AI models.
    
    Supports:
    - Hugging Face transformers models
    - Stable Diffusion models
    - Custom model architectures
    - Model caching and reuse
    """
    
    def __init__(self, config: Dict[str, Any]):
        """
        Initialize the model loader.
        
        Args:
            config: Configuration dictionary containing model settings
        """
        self.config = config
        self.logger = get_logger(__name__)
        
        # Model cache directory
        self.cache_dir = Path(config.get('model_cache_dir', './data/models'))
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
        # Loaded models cache
        self.loaded_models = {}
        
        # Device configuration
        self.device = self._setup_device()
        
        # Supported models from config
        self.supported_models = config.get('supported_models', [])
        
        self.logger.info(f"ModelLoader initialized with device: {self.device}")
        self.logger.info(f"Cache directory: {self.cache_dir}")
        self.logger.info(f"Supported models: {', '.join(self.supported_models)}")
    
    def _setup_device(self) -> str:
        """
        Set up the compute device (CPU/GPU).
        
        Returns:
            Device string ('cuda', 'mps', or 'cpu')
        """
        if torch.cuda.is_available():
            device = 'cuda'
            self.logger.info(f"Using CUDA device: {torch.cuda.get_device_name(0)}")
        elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
            device = 'mps'
            self.logger.info("Using Apple MPS (Metal Performance Shaders)")
        else:
            device = 'cpu'
            self.logger.warning("No GPU available, using CPU (performance may be limited)")
        
        return device
    
    def load_model(self, model_name: str, model_type: str = 'text') -> Any:
        """
        Load a model by name and type.
        
        Args:
            model_name: Name or path of the model
            model_type: Type of model ('text', 'image', 'audio', etc.)
        
        Returns:
            Loaded model object
        
        Raises:
            ValueError: If model type is not supported
            RuntimeError: If model loading fails
        """
        cache_key = f"{model_type}:{model_name}"
        
        # Return cached model if available
        if cache_key in self.loaded_models:
            self.logger.info(f"Using cached model: {cache_key}")
            return self.loaded_models[cache_key]
        
        self.logger.info(f"Loading model: {model_name} (type: {model_type})")
        
        try:
            if model_type == 'text':
                model = self._load_text_model(model_name)
            elif model_type == 'image':
                model = self._load_image_model(model_name)
            elif model_type == 'embedding':
                model = self._load_embedding_model(model_name)
            else:
                raise ValueError(f"Unsupported model type: {model_type}")
            
            # Cache the loaded model
            self.loaded_models[cache_key] = model
            
            self.logger.info(f"Successfully loaded model: {cache_key}")
            return model
            
        except Exception as e:
            self.logger.error(f"Failed to load model {model_name}: {e}", exc_info=True)
            raise RuntimeError(f"Model loading failed: {e}")
    
    def _load_text_model(self, model_name: str) -> Dict[str, Any]:
        """
        Load a text generation model.
        
        Args:
            model_name: Name of the Hugging Face model
        
        Returns:
            Dictionary containing model and tokenizer
        """
        self.logger.info(f"Loading text model: {model_name}")
        
        tokenizer = AutoTokenizer.from_pretrained(
            model_name,
            cache_dir=str(self.cache_dir),
            trust_remote_code=True
        )
        
        model = AutoModelForCausalLM.from_pretrained(
            model_name,
            cache_dir=str(self.cache_dir),
            torch_dtype=torch.float16 if self.device == 'cuda' else torch.float32,
            device_map='auto' if self.device == 'cuda' else None,
            trust_remote_code=True
        )
        
        if self.device != 'cuda':
            model = model.to(self.device)
        
        return {
            'model': model,
            'tokenizer': tokenizer,
            'type': 'text'
        }
    
    def _load_image_model(self, model_name: str) -> Dict[str, Any]:
        """
        Load an image generation model (Stable Diffusion).
        
        Args:
            model_name: Name of the model
        
        Returns:
            Dictionary containing pipeline
        """
        self.logger.info(f"Loading image model: {model_name}")
        
        pipeline = StableDiffusionPipeline.from_pretrained(
            model_name,
            cache_dir=str(self.cache_dir),
            torch_dtype=torch.float16 if self.device == 'cuda' else torch.float32
        )
        
        pipeline = pipeline.to(self.device)
        
        # Enable memory optimizations for CUDA
        if self.device == 'cuda':
            pipeline.enable_attention_slicing()
        
        return {
            'pipeline': pipeline,
            'type': 'image'
        }
    
    def _load_embedding_model(self, model_name: str) -> Dict[str, Any]:
        """
        Load an embedding model.
        
        Args:
            model_name: Name of the model
        
        Returns:
            Dictionary containing model and tokenizer
        """
        self.logger.info(f"Loading embedding model: {model_name}")
        
        tokenizer = AutoTokenizer.from_pretrained(
            model_name,
            cache_dir=str(self.cache_dir)
        )
        
        model = AutoModel.from_pretrained(
            model_name,
            cache_dir=str(self.cache_dir),
            torch_dtype=torch.float16 if self.device == 'cuda' else torch.float32
        )
        
        model = model.to(self.device)
        
        return {
            'model': model,
            'tokenizer': tokenizer,
            'type': 'embedding'
        }
    
    def unload_model(self, model_name: str, model_type: str = 'text') -> bool:
        """
        Unload a model from memory.
        
        Args:
            model_name: Name of the model
            model_type: Type of model
        
        Returns:
            True if model was unloaded, False if not found
        """
        cache_key = f"{model_type}:{model_name}"
        
        if cache_key in self.loaded_models:
            del self.loaded_models[cache_key]
            
            # Clear CUDA cache if using GPU
            if self.device == 'cuda':
                torch.cuda.empty_cache()
            
            self.logger.info(f"Unloaded model: {cache_key}")
            return True
        
        return False
    
    def get_loaded_models(self) -> List[str]:
        """
        Get list of currently loaded models.
        
        Returns:
            List of loaded model cache keys
        """
        return list(self.loaded_models.keys())
    
    def get_memory_usage(self) -> Dict[str, Any]:
        """
        Get current memory usage statistics.
        
        Returns:
            Dictionary with memory usage information
        """
        usage = {
            'loaded_models_count': len(self.loaded_models),
            'device': self.device
        }
        
        if self.device == 'cuda':
            usage['cuda_allocated_gb'] = torch.cuda.memory_allocated() / (1024 ** 3)
            usage['cuda_reserved_gb'] = torch.cuda.memory_reserved() / (1024 ** 3)
            usage['cuda_max_allocated_gb'] = torch.cuda.max_memory_allocated() / (1024 ** 3)
        
        return usage
    
    def cleanup(self):
        """Clean up all loaded models and free memory."""
        self.logger.info("Cleaning up all loaded models...")
        
        for cache_key in list(self.loaded_models.keys()):
            del self.loaded_models[cache_key]
        
        self.loaded_models.clear()
        
        if self.device == 'cuda':
            torch.cuda.empty_cache()
        
        self.logger.info("Model cleanup complete")
