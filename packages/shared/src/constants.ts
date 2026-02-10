/**
 * Shared constants for NeuroGrid platform
 */

// API Version and Endpoints
export const API_VERSION = 'v1';
export const API_BASE_PATH = `/api/${API_VERSION}`;

export const ENDPOINTS = {
  // Authentication
  AUTH_LOGIN: `${API_BASE_PATH}/auth/login`,
  AUTH_REGISTER: `${API_BASE_PATH}/auth/register`,
  AUTH_LOGOUT: `${API_BASE_PATH}/auth/logout`,
  AUTH_REFRESH: `${API_BASE_PATH}/auth/refresh`,
  AUTH_VERIFY: `${API_BASE_PATH}/auth/verify`,
  
  // Users
  USERS: `${API_BASE_PATH}/users`,
  USER_PROFILE: `${API_BASE_PATH}/users/profile`,
  USER_BALANCE: `${API_BASE_PATH}/users/balance`,
  
  // Nodes
  NODES: `${API_BASE_PATH}/nodes`,
  NODE_REGISTER: `${API_BASE_PATH}/nodes/register`,
  NODE_METRICS: `${API_BASE_PATH}/nodes/:id/metrics`,
  NODE_TASKS: `${API_BASE_PATH}/nodes/:id/tasks`,
  
  // Tasks
  TASKS: `${API_BASE_PATH}/tasks`,
  TASK_SUBMIT: `${API_BASE_PATH}/tasks/submit`,
  TASK_STATUS: `${API_BASE_PATH}/tasks/:id/status`,
  TASK_CANCEL: `${API_BASE_PATH}/tasks/:id/cancel`,
  TASK_RESULTS: `${API_BASE_PATH}/tasks/:id/results`,
  
  // Models
  MODELS: `${API_BASE_PATH}/models`,
  MODEL_INFO: `${API_BASE_PATH}/models/:id`,
  
  // Payments
  PAYMENTS: `${API_BASE_PATH}/payments`,
  PAYMENT_DEPOSIT: `${API_BASE_PATH}/payments/deposit`,
  PAYMENT_WITHDRAW: `${API_BASE_PATH}/payments/withdraw`,
  
  // Analytics
  ANALYTICS: `${API_BASE_PATH}/analytics`,
  ANALYTICS_DASHBOARD: `${API_BASE_PATH}/analytics/dashboard`,
  
  // System
  HEALTH: `${API_BASE_PATH}/health`,
  METRICS: `${API_BASE_PATH}/metrics`,
  STATUS: `${API_BASE_PATH}/status`
};

// WebSocket Event Types
export const WS_EVENTS = {
  // Connection events
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  AUTHENTICATE: 'authenticate',
  AUTH_RESPONSE: 'auth_response',
  AUTH_ERROR: 'auth_error',
  
  // Room management
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',
  ROOM_JOINED: 'room_joined',
  ROOM_LEFT: 'room_left',
  
  // Task events
  TASK_UPDATE: 'task_update',
  TASK_PROGRESS: 'task_progress',
  TASK_ASSIGNED: 'task_assigned',
  TASK_COMPLETED: 'task_completed',
  TASK_FAILED: 'task_failed',
  TASK_CANCELLED: 'task_cancelled',
  
  // Node events
  NODE_STATUS: 'node_status',
  NODE_METRICS: 'node_metrics',
  NODE_REGISTERED: 'node_registered',
  NODE_OFFLINE: 'node_offline',
  
  // System events
  SYSTEM_NOTIFICATION: 'system_notification',
  ANALYTICS_UPDATE: 'analytics_update',
  BALANCE_UPDATE: 'balance_update',
  PAYMENT_CONFIRMED: 'payment_confirmed',
  
  // Error events
  ERROR: 'error',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded'
};

// WebSocket Room Names
export const WS_ROOMS = {
  TASKS: 'tasks',
  NODES: 'nodes',
  ANALYTICS: 'analytics',
  USER_UPDATES: 'user_updates',
  SYSTEM: 'system',
  GENERAL: 'general'
};

// Default Configurations
export const DEFAULT_CONFIG = {
  // Pagination
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  
  // Rate Limiting
  RATE_LIMIT: {
    AUTH: { windowMs: 15 * 60 * 1000, max: 5 }, // 5 requests per 15 minutes
    API: { windowMs: 60 * 1000, max: 100 }, // 100 requests per minute
    WEBSOCKET: { windowMs: 60 * 1000, max: 1000 }, // 1000 messages per minute
    UPLOAD: { windowMs: 60 * 1000, max: 10 } // 10 uploads per minute
  },
  
  // Task Configuration
  TASK: {
    MAX_RETRIES: 3,
    DEFAULT_TIMEOUT: 300000, // 5 minutes
    MAX_INPUT_SIZE: 10 * 1024 * 1024, // 10MB
    PRIORITY_LEVELS: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    DEFAULT_PRIORITY: 5
  },
  
  // Node Configuration
  NODE: {
    HEARTBEAT_INTERVAL: 30000, // 30 seconds
    OFFLINE_THRESHOLD: 120000, // 2 minutes
    MIN_GPU_MEMORY: 4, // 4GB
    MAX_CONCURRENT_TASKS: 10
  },
  
  // WebSocket Configuration
  WEBSOCKET: {
    PING_INTERVAL: 30000, // 30 seconds
    PONG_TIMEOUT: 5000, // 5 seconds
    RECONNECT_ATTEMPTS: 10,
    RECONNECT_DELAY: 1000, // 1 second
    MAX_CONNECTIONS_PER_IP: 100
  },
  
  // Security
  SECURITY: {
    JWT_EXPIRES_IN: '1h',
    REFRESH_TOKEN_EXPIRES_IN: '7d',
    PASSWORD_MIN_LENGTH: 8,
    API_KEY_LENGTH: 64,
    SESSION_SECRET_LENGTH: 32
  },
  
  // File Upload
  FILE_UPLOAD: {
    MAX_SIZE: 100 * 1024 * 1024, // 100MB
    ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'text/plain', 'application/json'],
    STORAGE_PATH: './uploads'
  }
};

// Error Codes
export const ERROR_CODES = {
  // Authentication errors
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  REFRESH_TOKEN_INVALID: 'REFRESH_TOKEN_INVALID',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  
  // Authorization errors
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  ACCESS_DENIED: 'ACCESS_DENIED',
  RESOURCE_FORBIDDEN: 'RESOURCE_FORBIDDEN',
  
  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',
  DATA_TOO_LARGE: 'DATA_TOO_LARGE',
  
  // Resource errors
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS: 'RESOURCE_ALREADY_EXISTS',
  RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',
  RESOURCE_LOCKED: 'RESOURCE_LOCKED',
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // Task errors
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',
  TASK_ALREADY_ASSIGNED: 'TASK_ALREADY_ASSIGNED',
  TASK_EXECUTION_FAILED: 'TASK_EXECUTION_FAILED',
  TASK_TIMEOUT: 'TASK_TIMEOUT',
  TASK_CANCELLED: 'TASK_CANCELLED',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  NO_AVAILABLE_NODES: 'NO_AVAILABLE_NODES',
  
  // Node errors
  NODE_NOT_FOUND: 'NODE_NOT_FOUND',
  NODE_OFFLINE: 'NODE_OFFLINE',
  NODE_BUSY: 'NODE_BUSY',
  NODE_MAINTENANCE: 'NODE_MAINTENANCE',
  NODE_REGISTRATION_FAILED: 'NODE_REGISTRATION_FAILED',
  INSUFFICIENT_RESOURCES: 'INSUFFICIENT_RESOURCES',
  
  // Payment errors
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  PAYMENT_PROCESSING: 'PAYMENT_PROCESSING',
  INVALID_PAYMENT_METHOD: 'INVALID_PAYMENT_METHOD',
  WALLET_CONNECTION_FAILED: 'WALLET_CONNECTION_FAILED',
  BLOCKCHAIN_ERROR: 'BLOCKCHAIN_ERROR',
  
  // System errors
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  REDIS_ERROR: 'REDIS_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  MAINTENANCE_MODE: 'MAINTENANCE_MODE',
  
  // File upload errors
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  UPLOAD_FAILED: 'UPLOAD_FAILED',
  STORAGE_QUOTA_EXCEEDED: 'STORAGE_QUOTA_EXCEEDED'
};

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504
};

// AI Model Configurations
export const AI_MODELS = {
  // Text Models
  'gpt-3.5-turbo': {
    type: 'text',
    provider: 'openai',
    max_tokens: 4096,
    cost_per_1k_tokens: 0.002,
    context_window: 16385
  },
  'gpt-4': {
    type: 'text',
    provider: 'openai',
    max_tokens: 8192,
    cost_per_1k_tokens: 0.03,
    context_window: 8192
  },
  'claude-v1': {
    type: 'text',
    provider: 'anthropic',
    max_tokens: 8192,
    cost_per_1k_tokens: 0.025,
    context_window: 100000
  },
  
  // Image Models
  'stable-diffusion-xl': {
    type: 'image',
    provider: 'huggingface',
    cost_per_generation: 0.05,
    max_resolution: '1024x1024',
    min_gpu_memory: 8
  },
  'dall-e-3': {
    type: 'image',
    provider: 'openai',
    cost_per_generation: 0.08,
    max_resolution: '1024x1024'
  },
  
  // Open Source Models
  'llama2:7b': {
    type: 'text',
    provider: 'meta',
    max_tokens: 4096,
    context_window: 4096,
    min_gpu_memory: 14,
    open_source: true
  },
  'llama2:13b': {
    type: 'text',
    provider: 'meta',
    max_tokens: 4096,
    context_window: 4096,
    min_gpu_memory: 26,
    open_source: true
  }
};

// GPU Specifications
export const GPU_SPECS = {
  'RTX 4090': { memory: 24, compute_capability: '8.9', power: 450 },
  'RTX 4080': { memory: 16, compute_capability: '8.9', power: 320 },
  'RTX 4070': { memory: 12, compute_capability: '8.9', power: 200 },
  'RTX 3090': { memory: 24, compute_capability: '8.6', power: 350 },
  'RTX 3080': { memory: 10, compute_capability: '8.6', power: 320 },
  'RTX 3070': { memory: 8, compute_capability: '8.6', power: 220 },
  'A100': { memory: 40, compute_capability: '8.0', power: 400 },
  'H100': { memory: 80, compute_capability: '9.0', power: 700 }
};

// Blockchain Configuration
export const BLOCKCHAIN = {
  NETWORKS: {
    ETHEREUM_MAINNET: { chainId: 1, name: 'Ethereum' },
    ETHEREUM_SEPOLIA: { chainId: 11155111, name: 'Sepolia Testnet' },
    POLYGON_MAINNET: { chainId: 137, name: 'Polygon' },
    POLYGON_MUMBAI: { chainId: 80001, name: 'Mumbai Testnet' },
    ARBITRUM_ONE: { chainId: 42161, name: 'Arbitrum One' },
    OPTIMISM: { chainId: 10, name: 'Optimism' }
  },
  
  CONTRACTS: {
    NEURO_TOKEN: '0x...',
    ESCROW: '0x...',
    STAKING: '0x...',
    GOVERNANCE: '0x...'
  },
  
  GAS_LIMITS: {
    TRANSFER: 21000,
    CONTRACT_CALL: 100000,
    CONTRACT_DEPLOY: 2000000
  }
};

// Time Constants
export const TIME = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
  MONTH: 30 * 24 * 60 * 60 * 1000
};

// Data Size Constants
export const DATA_SIZE = {
  KB: 1024,
  MB: 1024 * 1024,
  GB: 1024 * 1024 * 1024,
  TB: 1024 * 1024 * 1024 * 1024
};

// Regular Expressions
export const REGEX = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  API_KEY: /^ng_[a-f0-9]{64}$/,
  WALLET_ADDRESS: /^0x[a-fA-F0-9]{40}$/,
  IPV4: /^(\d{1,3}\.){3}\d{1,3}$/,
  IPV6: /^([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}$/i
};

// User Roles and Permissions
export const ROLES = {
  USER: 'user',
  ADMIN: 'admin',
  NODE_OPERATOR: 'node_operator',
  MODERATOR: 'moderator'
};

export const PERMISSIONS = {
  // Task permissions
  TASK_CREATE: 'task:create',
  TASK_READ: 'task:read',
  TASK_UPDATE: 'task:update',
  TASK_DELETE: 'task:delete',
  TASK_CANCEL: 'task:cancel',
  
  // Node permissions
  NODE_REGISTER: 'node:register',
  NODE_READ: 'node:read',
  NODE_UPDATE: 'node:update',
  NODE_DELETE: 'node:delete',
  NODE_MANAGE: 'node:manage',
  
  // User permissions
  USER_READ: 'user:read',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
  USER_MANAGE: 'user:manage',
  
  // System permissions
  SYSTEM_READ: 'system:read',
  SYSTEM_WRITE: 'system:write',
  SYSTEM_ADMIN: 'system:admin',
  
  // Analytics permissions
  ANALYTICS_READ: 'analytics:read',
  ANALYTICS_ADMIN: 'analytics:admin'
};

// Role-Permission Mappings
export const ROLE_PERMISSIONS = {
  [ROLES.USER]: [
    PERMISSIONS.TASK_CREATE,
    PERMISSIONS.TASK_READ,
    PERMISSIONS.TASK_CANCEL,
    PERMISSIONS.NODE_READ,
    PERMISSIONS.USER_UPDATE
  ],
  [ROLES.NODE_OPERATOR]: [
    PERMISSIONS.TASK_READ,
    PERMISSIONS.NODE_REGISTER,
    PERMISSIONS.NODE_READ,
    PERMISSIONS.NODE_UPDATE,
    PERMISSIONS.NODE_MANAGE,
    PERMISSIONS.USER_UPDATE,
    PERMISSIONS.ANALYTICS_READ
  ],
  [ROLES.MODERATOR]: [
    PERMISSIONS.TASK_READ,
    PERMISSIONS.TASK_UPDATE,
    PERMISSIONS.NODE_READ,
    PERMISSIONS.USER_READ,
    PERMISSIONS.SYSTEM_READ,
    PERMISSIONS.ANALYTICS_READ
  ],
  [ROLES.ADMIN]: [
    ...Object.values(PERMISSIONS)
  ]
};

// Environment Variables
export const ENV_VARS = {
  NODE_ENV: 'NODE_ENV',
  PORT: 'PORT',
  
  // Database
  POSTGRES_HOST: 'POSTGRES_HOST',
  POSTGRES_PORT: 'POSTGRES_PORT',
  POSTGRES_DB: 'POSTGRES_DB',
  POSTGRES_USER: 'POSTGRES_USER',
  POSTGRES_PASSWORD: 'POSTGRES_PASSWORD',
  
  // Redis
  REDIS_URL: 'REDIS_URL',
  REDIS_PASSWORD: 'REDIS_PASSWORD',
  
  // JWT
  JWT_SECRET: 'JWT_SECRET',
  JWT_EXPIRES_IN: 'JWT_EXPIRES_IN',
  
  // External APIs
  OPENAI_API_KEY: 'OPENAI_API_KEY',
  HUGGINGFACE_API_KEY: 'HUGGINGFACE_API_KEY',
  ANTHROPIC_API_KEY: 'ANTHROPIC_API_KEY',
  
  // Blockchain
  WEB3_PROVIDER_URL: 'WEB3_PROVIDER_URL',
  PRIVATE_KEY: 'PRIVATE_KEY',
  
  // Storage
  AWS_ACCESS_KEY_ID: 'AWS_ACCESS_KEY_ID',
  AWS_SECRET_ACCESS_KEY: 'AWS_SECRET_ACCESS_KEY',
  AWS_S3_BUCKET: 'AWS_S3_BUCKET',
  
  // Monitoring
  SENTRY_DSN: 'SENTRY_DSN',
  DISCORD_WEBHOOK_URL: 'DISCORD_WEBHOOK_URL'
};