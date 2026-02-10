/**
 * OpenTelemetry Configuration for Distributed Tracing
 * Provides comprehensive observability across NeuroGrid services
 */

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');
const { PrometheusExporter } = require('@opentelemetry/exporter-prometheus');
const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');
const logger = require('./logger');

class TelemetryService {
  constructor() {
    this.sdk = null;
    this.initialized = false;
    this.serviceName = 'neurogrid-coordinator';
    this.serviceVersion = process.env.npm_package_version || '1.0.0';
    this.environment = process.env.NODE_ENV || 'development';
  }

  /**
   * Initialize OpenTelemetry SDK
   */
  initialize() {
    try {
      // Create resource with service information
      const resource = new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: this.serviceName,
        [SemanticResourceAttributes.SERVICE_VERSION]: this.serviceVersion,
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: this.environment,
        [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'neurogrid',
        // Add custom attributes
        'neurogrid.component': 'coordinator-server',
        'neurogrid.region': process.env.AWS_REGION || 'local'
      });

      // Configure exporters
      const exporters = this.getExporters();

      // Initialize SDK
      this.sdk = new NodeSDK({
        resource,
        traceExporter: exporters.traceExporter,
        metricReader: exporters.metricReader,
        instrumentations: [
          getNodeAutoInstrumentations({
            // Customize auto-instrumentation
            '@opentelemetry/instrumentation-fs': {
              enabled: false // Disable file system instrumentation to reduce noise
            },
            '@opentelemetry/instrumentation-http': {
              enabled: true,
              requestHook: (span, request) => {
                // Add custom attributes to HTTP spans
                span.setAttributes({
                  'http.user_agent': request.headers['user-agent'],
                  'http.x_forwarded_for': request.headers['x-forwarded-for']
                });
              },
              responseHook: (span, response) => {
                // Add response attributes
                span.setAttributes({
                  'http.response.content_type': response.headers['content-type']
                });
              }
            },
            '@opentelemetry/instrumentation-express': {
              enabled: true,
              requestHook: (span, request) => {
                // Add Express-specific attributes
                if (request.user) {
                  span.setAttributes({
                    'user.id': request.user.id,
                    'user.role': request.user.role
                  });
                }
              }
            },
            '@opentelemetry/instrumentation-pg': {
              enabled: true,
              enhancedDatabaseReporting: true
            },
            '@opentelemetry/instrumentation-redis': {
              enabled: true,
              dbStatementSerializer: (operation, args) => {
                // Sanitize Redis commands
                return `${operation} ${args.length > 0 ? '[ARGS]' : ''}`;
              }
            }
          })
        ]
      });

      // Start the SDK
      this.sdk.start();
      this.initialized = true;
      
      logger.info('OpenTelemetry SDK initialized successfully', {
        serviceName: this.serviceName,
        serviceVersion: this.serviceVersion,
        environment: this.environment
      });
      
    } catch (error) {
      logger.error('Failed to initialize OpenTelemetry SDK:', error);
    }
  }

  /**
   * Get configured exporters based on environment
   */
  getExporters() {
    const exporters = {
      traceExporter: null,
      metricReader: null
    };

    // Configure trace exporter
    if (process.env.JAEGER_ENDPOINT) {
      exporters.traceExporter = new JaegerExporter({
        endpoint: process.env.JAEGER_ENDPOINT,
        tags: [
          { key: 'service.version', value: this.serviceVersion },
          { key: 'deployment.environment', value: this.environment }
        ]
      });
    } else if (this.environment === 'development') {
      // Console exporter for development
      const { ConsoleSpanExporter } = require('@opentelemetry/sdk-tracing-base');
      exporters.traceExporter = new ConsoleSpanExporter();
    }

    // Configure metrics exporter
    const metricsPort = process.env.METRICS_PORT || 9464;
    
    try {
      exporters.metricReader = new PrometheusExporter({
        port: parseInt(metricsPort),
        endpoint: '/metrics',
        preventServerStart: false
      });
      
      logger.info(`Prometheus metrics available at http://localhost:${metricsPort}/metrics`);
    } catch (error) {
      logger.warn('Failed to start Prometheus metrics exporter:', error);
    }

    return exporters;
  }

  /**
   * Create custom span for manual instrumentation
   */
  createSpan(name, operation = 'internal', attributes = {}) {
    if (!this.initialized) {
      return null;
    }

    const { trace } = require('@opentelemetry/api');
    const tracer = trace.getTracer(this.serviceName, this.serviceVersion);
    
    return tracer.startSpan(name, {
      kind: operation,
      attributes: {
        'operation.name': name,
        'service.name': this.serviceName,
        ...attributes
      }
    });
  }

  /**
   * Add custom metrics
   */
  recordMetric(name, value, attributes = {}) {
    if (!this.initialized) {
      return;
    }

    const { metrics } = require('@opentelemetry/api');
    const meter = metrics.getMeter(this.serviceName, this.serviceVersion);
    
    const counter = meter.createCounter(name, {
      description: `Custom metric: ${name}`,
      unit: 'count'
    });
    
    counter.add(value, attributes);
  }

  /**
   * Record histogram metric
   */
  recordHistogram(name, value, attributes = {}) {
    if (!this.initialized) {
      return;
    }

    const { metrics } = require('@opentelemetry/api');
    const meter = metrics.getMeter(this.serviceName, this.serviceVersion);
    
    const histogram = meter.createHistogram(name, {
      description: `Histogram metric: ${name}`,
      boundaries: [0.1, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000]
    });
    
    histogram.record(value, attributes);
  }

  /**
   * Express middleware for automatic request tracing
   */
  middleware() {
    return (req, res, next) => {
      if (!this.initialized) {
        return next();
      }

      const span = this.createSpan(`${req.method} ${req.route?.path || req.path}`, 'server', {
        'http.method': req.method,
        'http.url': req.url,
        'http.route': req.route?.path,
        'user.id': req.user?.id,
        'user.role': req.user?.role
      });

      if (span) {
        res.on('finish', () => {
          span.setAttributes({
            'http.status_code': res.statusCode,
            'http.response.size': res.get('content-length') || 0
          });
          
          if (res.statusCode >= 400) {
            span.setStatus({ code: 2, message: `HTTP ${res.statusCode}` });
          }
          
          span.end();
        });
      }

      next();
    };
  }

  /**
   * Gracefully shutdown telemetry
   */
  async shutdown() {
    if (!this.initialized || !this.sdk) {
      return;
    }

    try {
      await this.sdk.shutdown();
      logger.info('OpenTelemetry SDK shutdown successfully');
    } catch (error) {
      logger.error('Error shutting down OpenTelemetry SDK:', error);
    }
  }
}

module.exports = new TelemetryService();