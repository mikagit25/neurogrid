const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const yaml = require('yamljs');
const path = require('path');

// Load OpenAPI specification from YAML file
let openApiSpec = {};
try {
  openApiSpec = yaml.load(path.join(__dirname, '../../docs/api/openapi.yaml'));
} catch (error) {
  console.warn('Could not load OpenAPI YAML file:', error.message);
}

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'NeuroGrid API',
      version: '1.0.0',
      description: `
        NeuroGrid - Distributed AI Computing Platform API
        
        This API provides comprehensive endpoints for:
        - User authentication and authorization
        - Node registration and management  
        - AI model operations (text, image, audio)
        - Task distribution and monitoring
        - Real-time WebSocket events
        - System metrics and analytics
        
        ## Base URLs
        - Production: https://api.neurogrid.io/api/v1
        - Development: http://localhost:3001/api/v1
        
        ## Authentication
        All endpoints require authentication via JWT tokens or API keys.
        
        ## Rate Limiting
        API endpoints are rate-limited to ensure fair usage.
        
        ## WebSocket
        Real-time updates available at: wss://api.neurogrid.io/ws
        
        ## Support
        For support, contact: support@neurogrid.io
      `,
      contact: {
        name: 'NeuroGrid Support',
        email: 'support@neurogrid.io',
        url: 'https://neurogrid.io/support'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production' ? 'https://api.neurogrid.io/api/v1' : 'http://localhost:3001/api/v1',
        description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server'
      },
      {
        url: 'https://api.neurogrid.io/api/v1',
        description: 'Production server'
      },
      {
        url: 'https://api-dev.neurogrid.io/api/v1',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token for user authentication'
        },
        apiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key for node and service authentication'
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'session',
          description: 'Session cookie for web interface'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Unique user identifier'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address'
            },
            username: {
              type: 'string',
              description: 'Unique username'
            },
            role: {
              type: 'string',
              enum: ['user', 'admin', 'node_operator'],
              description: 'User role and permissions level'
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Account creation timestamp'
            },
            last_login: {
              type: 'string',
              format: 'date-time',
              description: 'Last login timestamp'
            },
            is_verified: {
              type: 'boolean',
              description: 'Email verification status'
            },
            profile: {
              type: 'object',
              properties: {
                full_name: { type: 'string' },
                company: { type: 'string' },
                bio: { type: 'string' }
              }
            }
          },
          required: ['id', 'email', 'username', 'role']
        },
        Node: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Unique node identifier'
            },
            name: {
              type: 'string',
              description: 'Human-readable node name'
            },
            owner_id: {
              type: 'integer',
              description: 'ID of the user who owns this node'
            },
            status: {
              type: 'string',
              enum: ['online', 'offline', 'busy', 'maintenance'],
              description: 'Current node status'
            },
            location: {
              type: 'object',
              properties: {
                region: { type: 'string' },
                country: { type: 'string' },
                city: { type: 'string' },
                coordinates: {
                  type: 'object',
                  properties: {
                    lat: { type: 'number' },
                    lng: { type: 'number' }
                  }
                }
              }
            },
            specifications: {
              type: 'object',
              properties: {
                gpu_model: { type: 'string' },
                gpu_memory: { type: 'integer' },
                cpu_cores: { type: 'integer' },
                ram_gb: { type: 'integer' },
                storage_gb: { type: 'integer' }
              }
            },
            supported_models: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of AI models this node can run'
            },
            pricing: {
              type: 'object',
              properties: {
                per_hour: { type: 'number' },
                per_token: { type: 'number' },
                currency: { type: 'string' }
              }
            },
            metrics: {
              type: 'object',
              properties: {
                uptime: { type: 'number' },
                tasks_completed: { type: 'integer' },
                avg_response_time: { type: 'number' },
                rating: { type: 'number' }
              }
            }
          },
          required: ['id', 'name', 'owner_id', 'status']
        },
        Task: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Unique task identifier'
            },
            user_id: {
              type: 'integer',
              description: 'ID of the user who created this task'
            },
            node_id: {
              type: 'string',
              format: 'uuid',
              description: 'ID of the assigned node'
            },
            type: {
              type: 'string',
              enum: ['inference', 'training', 'embedding', 'generation'],
              description: 'Type of AI task'
            },
            model: {
              type: 'string',
              description: 'AI model to use for this task'
            },
            status: {
              type: 'string',
              enum: ['pending', 'assigned', 'running', 'completed', 'failed', 'cancelled'],
              description: 'Current task status'
            },
            priority: {
              type: 'integer',
              minimum: 1,
              maximum: 10,
              description: 'Task priority (1=lowest, 10=highest)'
            },
            parameters: {
              type: 'object',
              description: 'Task-specific parameters and configuration'
            },
            input_data: {
              type: 'object',
              description: 'Input data for the AI task'
            },
            output_data: {
              type: 'object',
              description: 'Results from the completed task'
            },
            estimated_cost: {
              type: 'number',
              description: 'Estimated cost in USD'
            },
            actual_cost: {
              type: 'number',
              description: 'Actual cost charged in USD'
            },
            created_at: {
              type: 'string',
              format: 'date-time'
            },
            started_at: {
              type: 'string',
              format: 'date-time'
            },
            completed_at: {
              type: 'string',
              format: 'date-time'
            }
          },
          required: ['id', 'user_id', 'type', 'model', 'status']
        },
        ApiError: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error type or code'
            },
            message: {
              type: 'string',
              description: 'Human-readable error message'
            },
            details: {
              type: 'object',
              description: 'Additional error details'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'When the error occurred'
            }
          },
          required: ['error', 'message']
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: {},
              description: 'Array of result items'
            },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'integer' },
                limit: { type: 'integer' },
                total: { type: 'integer' },
                pages: { type: 'integer' }
              }
            }
          }
        }
      },
      responses: {
        UnauthorizedError: {
          description: 'Authentication information is missing or invalid',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApiError'
              }
            }
          }
        },
        ForbiddenError: {
          description: 'Access forbidden - insufficient permissions',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApiError'
              }
            }
          }
        },
        NotFoundError: {
          description: 'The requested resource was not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApiError'
              }
            }
          }
        },
        ValidationError: {
          description: 'Request validation failed',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApiError'
              }
            }
          }
        },
        RateLimitError: {
          description: 'Rate limit exceeded',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApiError'
              }
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization'
      },
      {
        name: 'Users',
        description: 'User account management'
      },
      {
        name: 'Nodes',
        description: 'Node registration and management'
      },
      {
        name: 'Tasks',
        description: 'Task creation, distribution, and monitoring'
      },
      {
        name: 'Payments',
        description: 'Payment processing and billing'
      },
      {
        name: 'Analytics',
        description: 'System metrics and analytics'
      },
      {
        name: 'Files',
        description: 'File upload and management'
      },
      {
        name: 'Admin',
        description: 'Administrative functions'
      }
    ]
  },
  apis: [
    './src/api/routes/*.js',
    './src/api/controllers/*.js',
    './docs/api/*.yaml'
  ]
};

// Generate Swagger specification from JSDoc comments
const jsdocSpecs = swaggerJsdoc(options);

// Merge JSDoc specs with OpenAPI YAML file
const specs = {
  ...openApiSpec,
  ...jsdocSpecs,
  paths: {
    ...(openApiSpec.paths || {}),
    ...(jsdocSpecs.paths || {})
  },
  components: {
    ...(openApiSpec.components || {}),
    ...(jsdocSpecs.components || {}),
    schemas: {
      ...(openApiSpec.components?.schemas || {}),
      ...(jsdocSpecs.components?.schemas || {})
    }
  }
};

// Enhanced Swagger UI options
const swaggerUiOptions = {
  explorer: true,
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info { margin: 20px 0 }
    .swagger-ui .scheme-container { background: #f7f7f7; padding: 15px; border-radius: 5px; }
    .swagger-ui .info hgroup.main h2 { color: #2c3e50; }
    .swagger-ui .btn.authorize { background-color: #3498db; border-color: #3498db; }
    .swagger-ui .btn.authorize:hover { background-color: #2980b9; border-color: #2980b9; }
  `,
  customSiteTitle: 'NeuroGrid API Documentation',
  customfavIcon: '/favicon.ico',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: 'list',
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
    defaultModelsExpandDepth: 2,
    tryItOutEnabled: true,
    requestInterceptor: (req) => {
      // Add custom headers if needed
      if (process.env.NODE_ENV === 'development') {
        req.headers['X-Debug-Mode'] = 'true';
      }
      return req;
    }
  }
};

/**
 * Setup API documentation routes
 * @param {Express} app - Express application instance
 */
function setupApiDocs(app) {
  // Serve OpenAPI JSON specification
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });

  // Main Swagger UI route
  app.use('/api-docs', swaggerUi.serve);
  app.get('/api-docs', swaggerUi.setup(specs, swaggerUiOptions));

  // Alternative documentation routes
  app.use('/docs', swaggerUi.serve);
  app.get('/docs', swaggerUi.setup(specs, swaggerUiOptions));

  // API documentation info endpoint
  app.get('/api/v1/docs/info', (req, res) => {
    res.json({
      success: true,
      data: {
        title: specs.info?.title || 'NeuroGrid API',
        version: specs.info?.version || '1.0.0',
        description: specs.info?.description || '',
        documentation_url: `${req.protocol}://${req.get('host')}/api-docs`,
        openapi_spec_url: `${req.protocol}://${req.get('host')}/api-docs.json`,
        contact: specs.info?.contact,
        license: specs.info?.license,
        servers: specs.servers || []
      }
    });
  });

  // API health check with documentation links
  app.get('/api/v1/health', (req, res) => {
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: specs.info?.version || '1.0.0',
      documentation: {
        interactive: `${req.protocol}://${req.get('host')}/api-docs`,
        openapi_spec: `${req.protocol}://${req.get('host')}/api-docs.json`,
        guides: `${req.protocol}://${req.get('host')}/docs/api/`
      }
    });
  });

  console.log('📚 API Documentation available at:');
  console.log(`   📖 Interactive docs: ${process.env.NODE_ENV === 'production' ? 'https://api.neurogrid.io' : 'http://localhost:3001'}/api-docs`);
  console.log(`   📋 OpenAPI spec: ${process.env.NODE_ENV === 'production' ? 'https://api.neurogrid.io' : 'http://localhost:3001'}/api-docs.json`);
  console.log(`   ℹ️  API info: ${process.env.NODE_ENV === 'production' ? 'https://api.neurogrid.io' : 'http://localhost:3001'}/api/v1/docs/info`);
}

module.exports = {
  specs,
  swaggerUi,
  setupApiDocs,
  swaggerUiOptions,
  setup: swaggerUi.setup(specs, swaggerUiOptions)
};