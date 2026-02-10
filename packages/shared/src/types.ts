/**
 * Shared types and interfaces for NeuroGrid platform
 */

export interface User {
  id: string;
  email: string;
  username: string;
  role: 'user' | 'admin' | 'node_operator';
  created_at: Date;
  last_login?: Date;
  is_verified: boolean;
  profile?: UserProfile;
}

export interface UserProfile {
  full_name?: string;
  company?: string;
  bio?: string;
  avatar_url?: string;
  timezone?: string;
  preferences?: Record<string, any>;
}

export interface Node {
  id: string;
  name: string;
  owner_id: string;
  status: NodeStatus;
  location: NodeLocation;
  specifications: NodeSpecs;
  supported_models: string[];
  pricing: NodePricing;
  metrics: NodeMetrics;
  reputation_score: number;
  created_at: Date;
  last_seen?: Date;
}

export type NodeStatus = 'online' | 'offline' | 'busy' | 'maintenance';

export interface NodeLocation {
  region: string;
  country: string;
  city?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface NodeSpecs {
  gpu_model: string;
  gpu_memory: number; // GB
  cpu_cores: number;
  ram_gb: number;
  storage_gb: number;
  network_speed: number; // Mbps
  compute_capability?: string;
}

export interface NodePricing {
  per_hour: number;
  per_token?: number;
  currency: 'USD' | 'NEURO';
  discount_bulk?: number;
  discount_long_term?: number;
}

export interface NodeMetrics {
  uptime: number; // percentage
  tasks_completed: number;
  avg_response_time: number;
  success_rate: number;
  rating: number;
  total_earnings: number;
}

export interface Task {
  id: string;
  user_id: string;
  node_id?: string;
  type: TaskType;
  model: string;
  status: TaskStatus;
  priority: number; // 1-10
  parameters: TaskParameters;
  input_data: any;
  output_data?: any;
  estimated_cost: number;
  actual_cost?: number;
  created_at: Date;
  started_at?: Date;
  completed_at?: Date;
  error_message?: string;
  retry_count: number;
}

export type TaskType = 'inference' | 'training' | 'embedding' | 'generation';
export type TaskStatus = 'pending' | 'assigned' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface TaskParameters {
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  timeout?: number;
  model_config?: Record<string, any>;
  requirements?: {
    min_gpu_memory?: number;
    preferred_regions?: string[];
    max_cost?: number;
  };
}

export interface Payment {
  id: string;
  user_id: string;
  task_id?: string;
  node_id?: string;
  amount: number;
  currency: 'USD' | 'NEURO' | 'ETH' | 'BTC';
  type: PaymentType;
  status: PaymentStatus;
  blockchain_tx?: string;
  created_at: Date;
  confirmed_at?: Date;
  metadata?: Record<string, any>;
}

export type PaymentType = 'task_payment' | 'node_earning' | 'deposit' | 'withdrawal' | 'refund';
export type PaymentStatus = 'pending' | 'confirmed' | 'failed' | 'cancelled';

export interface TokenBalance {
  user_id: string;
  balances: Record<string, {
    total: number;
    available: number;
    locked: number;
  }>;
  updated_at: Date;
}

// WebSocket Event Types
export interface WebSocketMessage<T = any> {
  type: string;
  room?: string;
  data: T;
  timestamp?: string;
  user_id?: string;
}

export interface TaskUpdateEvent {
  task_id: string;
  status: TaskStatus;
  previous_status: TaskStatus;
  node_id?: string;
  updated_at: string;
  result?: any;
  cost?: {
    amount: number;
    currency: string;
  };
}

export interface NodeStatusEvent {
  node_id: string;
  status: NodeStatus;
  previous_status: NodeStatus;
  current_task?: string;
  updated_at: string;
  metrics?: {
    gpu_utilization: number;
    memory_usage: number;
    temperature: number;
    power_draw: number;
  };
}

// API Response Types
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  code?: string;
}

export interface PaginatedResponse<T = any> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface APIError {
  error: string;
  message: string;
  details?: any;
  timestamp: string;
}

// Configuration Types
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  pool_size?: number;
}

export interface RedisConfig {
  url: string;
  password?: string;
  db?: number;
  retry_attempts?: number;
}

export interface ServerConfig {
  port: number;
  host: string;
  cors_origin: string[];
  jwt_secret: string;
  rate_limit?: {
    window_ms: number;
    max_requests: number;
  };
}

// Utility Types
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
export type Partial<T> = {
  [P in keyof T]?: T[P];
};
export type Required<T> = {
  [P in keyof T]-?: T[P];
};

// Model Types
export interface AIModel {
  id: string;
  name: string;
  type: 'text' | 'image' | 'audio' | 'multimodal';
  provider: 'openai' | 'huggingface' | 'anthropic' | 'custom';
  version: string;
  description: string;
  capabilities: string[];
  requirements: {
    min_gpu_memory: number;
    estimated_vram: number;
    supported_precisions: ('fp16' | 'fp32' | 'int8' | 'int4')[];
  };
  pricing: {
    per_token?: number;
    per_image?: number;
    per_second?: number;
    base_cost: number;
  };
  metadata: Record<string, any>;
}