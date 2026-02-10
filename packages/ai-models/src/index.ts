/**
 * NeuroGrid AI Models Package
 * Real AI model integration for distributed computing
 */

// Export main classes and interfaces
export * from './huggingface';
export * from './manager';

// Re-export commonly used items
export {
  HuggingFaceClient,
  HuggingFaceProvider,
  AIModelManager,
  aiModelManager,
  RECOMMENDED_MODELS
} from './index';