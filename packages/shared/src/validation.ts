/**
 * Validation utilities using Zod
 */

import { z } from 'zod';

// User validation schemas
export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  username: z.string().min(3).max(50),
  role: z.enum(['user', 'admin', 'node_operator']),
  created_at: z.date(),
  last_login: z.date().optional(),
  is_verified: z.boolean(),
  profile: z.object({
    full_name: z.string().optional(),
    company: z.string().optional(),
    bio: z.string().max(500).optional(),
    avatar_url: z.string().url().optional(),
    timezone: z.string().optional(),
    preferences: z.record(z.any()).optional()
  }).optional()
});

// Node validation schemas
export const NodeSpecsSchema = z.object({
  gpu_model: z.string(),
  gpu_memory: z.number().positive(),
  cpu_cores: z.number().positive(),
  ram_gb: z.number().positive(),
  storage_gb: z.number().positive(),
  network_speed: z.number().positive(),
  compute_capability: z.string().optional()
});

export const NodeSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  owner_id: z.string().uuid(),
  status: z.enum(['online', 'offline', 'busy', 'maintenance']),
  location: z.object({
    region: z.string(),
    country: z.string(),
    city: z.string().optional(),
    coordinates: z.object({
      lat: z.number(),
      lng: z.number()
    }).optional()
  }),
  specifications: NodeSpecsSchema,
  supported_models: z.array(z.string()),
  pricing: z.object({
    per_hour: z.number().nonnegative(),
    per_token: z.number().nonnegative().optional(),
    currency: z.enum(['USD', 'NEURO']),
    discount_bulk: z.number().min(0).max(100).optional(),
    discount_long_term: z.number().min(0).max(100).optional()
  }),
  metrics: z.object({
    uptime: z.number().min(0).max(100),
    tasks_completed: z.number().nonnegative(),
    avg_response_time: z.number().nonnegative(),
    success_rate: z.number().min(0).max(100),
    rating: z.number().min(0).max(5),
    total_earnings: z.number().nonnegative()
  }),
  reputation_score: z.number().min(0).max(100),
  created_at: z.date(),
  last_seen: z.date().optional()
});

// Task validation schemas
export const TaskParametersSchema = z.object({
  max_tokens: z.number().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  timeout: z.number().positive().optional(),
  model_config: z.record(z.any()).optional(),
  requirements: z.object({
    min_gpu_memory: z.number().positive().optional(),
    preferred_regions: z.array(z.string()).optional(),
    max_cost: z.number().positive().optional()
  }).optional()
});

export const TaskSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  node_id: z.string().uuid().optional(),
  type: z.enum(['inference', 'training', 'embedding', 'generation']),
  model: z.string(),
  status: z.enum(['pending', 'assigned', 'running', 'completed', 'failed', 'cancelled']),
  priority: z.number().int().min(1).max(10),
  parameters: TaskParametersSchema,
  input_data: z.any(),
  output_data: z.any().optional(),
  estimated_cost: z.number().nonnegative(),
  actual_cost: z.number().nonnegative().optional(),
  created_at: z.date(),
  started_at: z.date().optional(),
  completed_at: z.date().optional(),
  error_message: z.string().optional(),
  retry_count: z.number().nonnegative()
});

// API validation schemas
export const APIResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  message: z.string().optional(),
  error: z.string().optional(),
  code: z.string().optional()
});

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc')
});

// WebSocket message validation
export const WebSocketMessageSchema = z.object({
  type: z.string(),
  room: z.string().optional(),
  data: z.any(),
  timestamp: z.string().optional(),
  user_id: z.string().uuid().optional()
});

// Authentication validation
export const AuthCredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const RegisterDataSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(50),
  password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character'
  })
});

// Node registration validation
export const NodeRegistrationSchema = z.object({
  name: z.string().min(1).max(100),
  location: z.object({
    region: z.string(),
    country: z.string(),
    city: z.string().optional()
  }),
  specifications: NodeSpecsSchema,
  supported_models: z.array(z.string()).min(1),
  pricing: z.object({
    per_hour: z.number().nonnegative(),
    per_token: z.number().nonnegative().optional(),
    currency: z.enum(['USD', 'NEURO'])
  }),
  api_key: z.string().optional()
});

// Task creation validation
export const TaskCreationSchema = z.object({
  type: z.enum(['inference', 'training', 'embedding', 'generation']),
  model: z.string().min(1),
  priority: z.number().int().min(1).max(10).default(5),
  parameters: TaskParametersSchema.default({}),
  input_data: z.any(),
  requirements: z.object({
    min_gpu_memory: z.number().positive().optional(),
    preferred_regions: z.array(z.string()).optional(),
    max_cost: z.number().positive().optional()
  }).optional()
});

// Payment validation
export const PaymentSchema = z.object({
  amount: z.number().positive(),
  currency: z.enum(['USD', 'NEURO', 'ETH', 'BTC']),
  type: z.enum(['task_payment', 'node_earning', 'deposit', 'withdrawal', 'refund']),
  metadata: z.record(z.any()).optional()
});

// Configuration validation
export const DatabaseConfigSchema = z.object({
  host: z.string(),
  port: z.number().int().positive(),
  database: z.string(),
  username: z.string(),
  password: z.string(),
  ssl: z.boolean().optional(),
  pool_size: z.number().positive().optional()
});

export const ServerConfigSchema = z.object({
  port: z.number().int().positive(),
  host: z.string(),
  cors_origin: z.array(z.string()),
  jwt_secret: z.string().min(32),
  rate_limit: z.object({
    window_ms: z.number().positive(),
    max_requests: z.number().positive()
  }).optional()
});

// Utility validation functions
export function validateEmail(email: string): boolean {
  return z.string().email().safeParse(email).success;
}

export function validateUUID(id: string): boolean {
  return z.string().uuid().safeParse(id).success;
}

export function validateTaskType(type: string): boolean {
  return z.enum(['inference', 'training', 'embedding', 'generation']).safeParse(type).success;
}

export function validateNodeStatus(status: string): boolean {
  return z.enum(['online', 'offline', 'busy', 'maintenance']).safeParse(status).success;
}

export function validateTaskStatus(status: string): boolean {
  return z.enum(['pending', 'assigned', 'running', 'completed', 'failed', 'cancelled']).safeParse(status).success;
}

// Generic validation helper
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, errors: result.error };
  }
}

// Validation middleware helper for Express
export function createValidationMiddleware<T>(schema: z.ZodSchema<T>) {
  return (req: any, res: any, next: any) => {
    const result = validate(schema, req.body);
    if (result.success) {
      req.validatedData = result.data;
      next();
    } else {
      res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: result.errors.format()
      });
    }
  };
}