const logger = require('../utils/logger');
const crypto = require('crypto');

/**
 * Enhanced AI Task Validator
 * Улучшенная валидация AI задач с фокусом на качество и эффективность
 */
class EnhancedAIValidator {
  constructor(config = {}) {
    this.config = {
      validationTimeoutMs: config.validationTimeoutMs || 30000,
      qualityThreshold: config.qualityThreshold || 0.8,
      consistencyThreshold: config.consistencyThreshold || 0.9,
      maxRetries: config.maxRetries || 3,
      ...config
    };

    // Validation cache
    this.validationCache = new Map();
    this.validationStats = {
      totalValidations: 0,
      successfulValidations: 0,
      failedValidations: 0,
      averageValidationTime: 0
    };

    logger.info('Enhanced AI Task Validator initialized');
  }

  /**
   * Validate AI computation result
   */
  async validateAIComputation(taskData) {
    const startTime = Date.now();
    const validationId = this.generateValidationId(taskData);

    try {
      this.validationStats.totalValidations++;

      // Check cache first
      const cachedResult = this.validationCache.get(validationId);
      if (cachedResult && !this.isValidationExpired(cachedResult)) {
        logger.debug(`Using cached validation result for ${validationId}`);
        return cachedResult.result;
      }

      logger.info(`Starting AI validation for task ${taskData.taskId} from node ${taskData.nodeId}`);

      // Comprehensive validation
      const validationResult = await this.performComprehensiveValidation(taskData);

      // Cache result
      this.validationCache.set(validationId, {
        result: validationResult,
        timestamp: Date.now(),
        ttl: 300000 // 5 minutes
      });

      // Update stats
      const validationTime = Date.now() - startTime;
      this.updateValidationStats(validationResult.isValid, validationTime);

      logger.info(`AI validation completed for ${validationId}`, {
        isValid: validationResult.isValid,
        score: validationResult.qualityScore,
        time: validationTime
      });

      return validationResult;

    } catch (error) {
      logger.error(`AI validation failed for ${validationId}:`, error);
      this.validationStats.failedValidations++;

      return {
        isValid: false,
        qualityScore: 0,
        error: error.message,
        validationTime: Date.now() - startTime
      };
    }
  }

  /**
   * Perform comprehensive AI validation
   */
  async performComprehensiveValidation(taskData) {
    const {
      taskId,
      nodeId,
      taskType,
      inputData,
      outputData,
      executionTime,
      resourceUsage,
      metadata = {}
    } = taskData;

    const validationResults = [];

    // 1. Format validation
    const formatValidation = await this.validateOutputFormat(taskType, outputData);
    validationResults.push(formatValidation);

    // 2. Consistency validation (compare with known good results)
    const consistencyValidation = await this.validateConsistency(taskType, inputData, outputData);
    validationResults.push(consistencyValidation);

    // 3. Performance validation
    const performanceValidation = await this.validatePerformance(taskType, executionTime, resourceUsage);
    validationResults.push(performanceValidation);

    // 4. Quality validation (task-specific)
    const qualityValidation = await this.validateQuality(taskType, inputData, outputData, metadata);
    validationResults.push(qualityValidation);

    // 5. Resource usage validation
    const resourceValidation = await this.validateResourceUsage(resourceUsage, metadata);
    validationResults.push(resourceValidation);

    // Combine all validation results
    const overallScore = this.calculateOverallScore(validationResults);
    const isValid = overallScore >= this.config.qualityThreshold;

    return {
      isValid,
      qualityScore: overallScore,
      validationDetails: validationResults,
      taskType,
      nodeId,
      timestamp: new Date()
    };
  }

  /**
   * Validate output format
   */
  async validateOutputFormat(taskType, outputData) {
    try {
      const formatRules = this.getFormatRules(taskType);

      if (!formatRules) {
        return { name: 'format', score: 1.0, message: 'No format rules defined' };
      }

      // Check required fields
      for (const field of formatRules.required || []) {
        if (!outputData.hasOwnProperty(field)) {
          return { name: 'format', score: 0, message: `Missing required field: ${field}` };
        }
      }

      // Check data types
      for (const [field, expectedType] of Object.entries(formatRules.types || {})) {
        if (outputData.hasOwnProperty(field) && typeof outputData[field] !== expectedType) {
          return { name: 'format', score: 0.5, message: `Invalid type for field: ${field}` };
        }
      }

      return { name: 'format', score: 1.0, message: 'Format validation passed' };

    } catch (error) {
      return { name: 'format', score: 0, message: `Format validation error: ${error.message}` };
    }
  }

  /**
   * Validate consistency with known results
   */
  async validateConsistency(taskType, inputData, outputData) {
    try {
      // For now, implement basic consistency checks
      // In production, this would compare against a database of known good results

      const inputHash = this.hashInput(inputData);
      const knownResult = await this.getKnownResult(taskType, inputHash);

      if (!knownResult) {
        return { name: 'consistency', score: 0.8, message: 'No reference result available' };
      }

      const similarity = this.calculateSimilarity(outputData, knownResult);
      const score = similarity >= this.config.consistencyThreshold ? 1.0 : similarity;

      return {
        name: 'consistency',
        score,
        message: `Consistency score: ${(similarity * 100).toFixed(1)}%`
      };

    } catch (error) {
      return { name: 'consistency', score: 0.5, message: `Consistency check error: ${error.message}` };
    }
  }

  /**
   * Validate performance metrics
   */
  async validatePerformance(taskType, executionTime, resourceUsage) {
    try {
      const benchmarks = this.getPerformanceBenchmarks(taskType);

      if (!benchmarks) {
        return { name: 'performance', score: 1.0, message: 'No performance benchmarks available' };
      }

      let score = 1.0;
      const issues = [];

      // Check execution time
      if (executionTime > benchmarks.maxTime) {
        score -= 0.3;
        issues.push(`Execution time exceeded: ${executionTime}ms > ${benchmarks.maxTime}ms`);
      }

      // Check resource usage
      if (resourceUsage && resourceUsage.memory > benchmarks.maxMemory) {
        score -= 0.2;
        issues.push(`Memory usage exceeded: ${resourceUsage.memory}MB > ${benchmarks.maxMemory}MB`);
      }

      if (resourceUsage && resourceUsage.cpu > benchmarks.maxCpu) {
        score -= 0.2;
        issues.push(`CPU usage exceeded: ${resourceUsage.cpu}% > ${benchmarks.maxCpu}%`);
      }

      return {
        name: 'performance',
        score: Math.max(0, score),
        message: issues.length ? issues.join('; ') : 'Performance within acceptable limits'
      };

    } catch (error) {
      return { name: 'performance', score: 0.7, message: `Performance check error: ${error.message}` };
    }
  }

  /**
   * Validate quality (task-specific)
   */
  async validateQuality(taskType, inputData, outputData, metadata) {
    try {
      switch (taskType) {
      case 'text_generation':
        return this.validateTextQuality(inputData, outputData, metadata);

      case 'image_generation':
        return this.validateImageQuality(inputData, outputData, metadata);

      case 'code_generation':
        return this.validateCodeQuality(inputData, outputData, metadata);

      case 'data_analysis':
        return this.validateAnalysisQuality(inputData, outputData, metadata);

      default:
        return { name: 'quality', score: 0.8, message: 'Generic quality validation' };
      }

    } catch (error) {
      return { name: 'quality', score: 0.5, message: `Quality check error: ${error.message}` };
    }
  }

  /**
   * Validate text generation quality
   */
  validateTextQuality(inputData, outputData, metadata) {
    const text = outputData.text || outputData.content || '';
    let score = 1.0;
    const issues = [];

    // Basic length check
    if (text.length < 10) {
      score -= 0.4;
      issues.push('Generated text too short');
    }

    // Check for repetition
    const words = text.split(' ');
    const uniqueWords = new Set(words);
    if (uniqueWords.size / words.length < 0.6) {
      score -= 0.3;
      issues.push('High repetition detected');
    }

    // Check for coherence (simple grammar check)
    if (!this.hasBasicCoherence(text)) {
      score -= 0.2;
      issues.push('Poor coherence detected');
    }

    return {
      name: 'quality',
      score: Math.max(0, score),
      message: issues.length ? issues.join('; ') : 'Text quality acceptable'
    };
  }

  /**
   * Validate resource usage
   */
  async validateResourceUsage(resourceUsage, metadata) {
    try {
      if (!resourceUsage) {
        return { name: 'resources', score: 0.7, message: 'No resource usage data provided' };
      }

      let score = 1.0;
      const issues = [];

      // Check for reasonable resource usage
      if (resourceUsage.memory && resourceUsage.memory > 32000) { // > 32GB
        score -= 0.3;
        issues.push('Excessive memory usage');
      }

      if (resourceUsage.cpu && resourceUsage.cpu > 95) { // > 95%
        score -= 0.2;
        issues.push('Excessive CPU usage');
      }

      if (resourceUsage.gpu && resourceUsage.gpu > 98) { // > 98%
        score -= 0.1;
        issues.push('GPU usage at maximum');
      }

      return {
        name: 'resources',
        score: Math.max(0, score),
        message: issues.length ? issues.join('; ') : 'Resource usage within limits'
      };

    } catch (error) {
      return { name: 'resources', score: 0.5, message: `Resource validation error: ${error.message}` };
    }
  }

  /**
   * Calculate overall validation score
   */
  calculateOverallScore(validationResults) {
    if (!validationResults.length) return 0;

    const weights = {
      format: 0.25,
      consistency: 0.3,
      performance: 0.2,
      quality: 0.15,
      resources: 0.1
    };

    let totalScore = 0;
    let totalWeight = 0;

    for (const result of validationResults) {
      const weight = weights[result.name] || 0.1;
      totalScore += result.score * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  /**
   * Helper methods
   */
  generateValidationId(taskData) {
    const hash = crypto.createHash('sha256');
    hash.update(`${taskData.taskId}-${taskData.nodeId}-${JSON.stringify(taskData.inputData)}`);
    return hash.digest('hex').substring(0, 16);
  }

  isValidationExpired(cachedResult) {
    return Date.now() - cachedResult.timestamp > cachedResult.ttl;
  }

  hashInput(inputData) {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(inputData));
    return hash.digest('hex');
  }

  async getKnownResult(taskType, inputHash) {
    // Placeholder - in production, query database of known good results
    return null;
  }

  calculateSimilarity(result1, result2) {
    // Placeholder - implement based on task type
    return 0.85; // Mock similarity score
  }

  getFormatRules(taskType) {
    const rules = {
      text_generation: {
        required: ['text'],
        types: { text: 'string' }
      },
      image_generation: {
        required: ['image_url', 'format'],
        types: { image_url: 'string', format: 'string' }
      },
      code_generation: {
        required: ['code', 'language'],
        types: { code: 'string', language: 'string' }
      }
    };

    return rules[taskType];
  }

  getPerformanceBenchmarks(taskType) {
    const benchmarks = {
      text_generation: {
        maxTime: 30000, // 30 seconds
        maxMemory: 8000, // 8GB
        maxCpu: 80 // 80%
      },
      image_generation: {
        maxTime: 60000, // 60 seconds
        maxMemory: 16000, // 16GB
        maxCpu: 90 // 90%
      },
      code_generation: {
        maxTime: 20000, // 20 seconds
        maxMemory: 4000, // 4GB
        maxCpu: 70 // 70%
      }
    };

    return benchmarks[taskType];
  }

  hasBasicCoherence(text) {
    // Simple coherence check
    const sentences = text.split(/[.!?]+/);
    return sentences.length >= 2 && sentences.some(s => s.trim().length > 20);
  }

  updateValidationStats(isValid, validationTime) {
    if (isValid) {
      this.validationStats.successfulValidations++;
    } else {
      this.validationStats.failedValidations++;
    }

    // Update average validation time
    const totalValidations = this.validationStats.totalValidations;
    this.validationStats.averageValidationTime =
      (this.validationStats.averageValidationTime * (totalValidations - 1) + validationTime) / totalValidations;
  }

  /**
   * Get validation statistics
   */
  getValidationStats() {
    return {
      ...this.validationStats,
      successRate: this.validationStats.totalValidations > 0
        ? this.validationStats.successfulValidations / this.validationStats.totalValidations
        : 0,
      cacheSize: this.validationCache.size
    };
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache() {
    const now = Date.now();
    let cleared = 0;

    for (const [key, value] of this.validationCache.entries()) {
      if (now - value.timestamp > value.ttl) {
        this.validationCache.delete(key);
        cleared++;
      }
    }

    if (cleared > 0) {
      logger.debug(`Cleared ${cleared} expired validation cache entries`);
    }
  }
}

module.exports = EnhancedAIValidator;
