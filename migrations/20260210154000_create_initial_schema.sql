-- Migration: Create initial NeuroGrid schema
-- Created: 2026-02-10T15:40:00.000Z
-- Version: 20260210154000

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  username VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(255),
  password_hash VARCHAR(255) NOT NULL,
  is_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login_at TIMESTAMP WITH TIME ZONE
);

-- GPU Nodes table
CREATE TABLE gpu_nodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  node_name VARCHAR(255) NOT NULL,
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  gpu_model VARCHAR(255) NOT NULL,
  gpu_memory INTEGER NOT NULL, -- MB
  cpu_cores INTEGER NOT NULL,
  ram_memory INTEGER NOT NULL, -- MB
  storage_space INTEGER NOT NULL, -- GB
  bandwidth_upload INTEGER, -- Mbps
  bandwidth_download INTEGER, -- Mbps
  location_country VARCHAR(100),
  location_city VARCHAR(100),
  status VARCHAR(50) DEFAULT 'offline', -- offline, online, busy, maintenance
  is_verified BOOLEAN DEFAULT false,
  price_per_hour DECIMAL(10, 6), -- NEURO tokens per hour
  total_uptime INTEGER DEFAULT 0, -- seconds
  total_tasks_completed INTEGER DEFAULT 0,
  reputation_score DECIMAL(3, 2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen_at TIMESTAMP WITH TIME ZONE
);

-- AI Models table
CREATE TABLE ai_models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  model_type VARCHAR(100) NOT NULL, -- text, code, image, audio
  tier VARCHAR(50) DEFAULT 'free', -- free, standard, premium
  author VARCHAR(255),
  version VARCHAR(50),
  size_gb DECIMAL(8, 2),
  min_gpu_memory INTEGER, -- MB required
  parameters JSONB DEFAULT '{}',
  pricing JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI Tasks table
CREATE TABLE ai_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  model_id UUID REFERENCES ai_models(id),
  node_id UUID REFERENCES gpu_nodes(id),
  task_type VARCHAR(100) NOT NULL,
  input_data TEXT NOT NULL,
  output_data TEXT,
  status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed, cancelled
  priority VARCHAR(50) DEFAULT 'normal', -- low, normal, high
  parameters JSONB DEFAULT '{}',
  duration_ms INTEGER,
  cost_neuro DECIMAL(12, 8),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- NEURO Token Transactions table
CREATE TABLE neuro_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_user_id UUID REFERENCES users(id),
  to_user_id UUID REFERENCES users(id),
  task_id UUID REFERENCES ai_tasks(id),
  transaction_type VARCHAR(100) NOT NULL, -- payment, reward, stake, unstake, fee
  amount DECIMAL(18, 8) NOT NULL,
  balance_after DECIMAL(18, 8),
  description TEXT,
  blockchain_tx_hash VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending', -- pending, confirmed, failed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Balances table
CREATE TABLE user_balances (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  available_balance DECIMAL(18, 8) DEFAULT 0.00000000,
  staked_balance DECIMAL(18, 8) DEFAULT 0.00000000,
  total_earned DECIMAL(18, 8) DEFAULT 0.00000000,
  total_spent DECIMAL(18, 8) DEFAULT 0.00000000,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Node Performance Metrics table
CREATE TABLE node_performance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  node_id UUID REFERENCES gpu_nodes(id) ON DELETE CASCADE,
  cpu_usage DECIMAL(5, 2),
  memory_usage DECIMAL(5, 2),
  gpu_usage DECIMAL(5, 2),
  gpu_memory_usage DECIMAL(5, 2),
  temperature_celsius INTEGER,
  power_consumption_watts INTEGER,
  network_latency_ms INTEGER,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Platform Statistics table
CREATE TABLE platform_statistics (
  id SERIAL PRIMARY KEY,
  metric_name VARCHAR(255) NOT NULL,
  metric_value DECIMAL(18, 8),
  metric_data JSONB,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_created_at ON users(created_at);

CREATE INDEX idx_gpu_nodes_owner_id ON gpu_nodes(owner_id);
CREATE INDEX idx_gpu_nodes_status ON gpu_nodes(status);
CREATE INDEX idx_gpu_nodes_location ON gpu_nodes(location_country, location_city);
CREATE INDEX idx_gpu_nodes_created_at ON gpu_nodes(created_at);

CREATE INDEX idx_ai_models_type ON ai_models(model_type);
CREATE INDEX idx_ai_models_tier ON ai_models(tier);
CREATE INDEX idx_ai_models_active ON ai_models(is_active);

CREATE INDEX idx_ai_tasks_user_id ON ai_tasks(user_id);
CREATE INDEX idx_ai_tasks_model_id ON ai_tasks(model_id);
CREATE INDEX idx_ai_tasks_node_id ON ai_tasks(node_id);
CREATE INDEX idx_ai_tasks_status ON ai_tasks(status);
CREATE INDEX idx_ai_tasks_created_at ON ai_tasks(created_at);
CREATE INDEX idx_ai_tasks_priority ON ai_tasks(priority);

CREATE INDEX idx_neuro_transactions_from_user ON neuro_transactions(from_user_id);
CREATE INDEX idx_neuro_transactions_to_user ON neuro_transactions(to_user_id);
CREATE INDEX idx_neuro_transactions_task_id ON neuro_transactions(task_id);
CREATE INDEX idx_neuro_transactions_type ON neuro_transactions(transaction_type);
CREATE INDEX idx_neuro_transactions_created_at ON neuro_transactions(created_at);

CREATE INDEX idx_node_performance_node_id ON node_performance(node_id);
CREATE INDEX idx_node_performance_recorded_at ON node_performance(recorded_at);

CREATE INDEX idx_platform_statistics_metric_name ON platform_statistics(metric_name);
CREATE INDEX idx_platform_statistics_recorded_at ON platform_statistics(recorded_at);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gpu_nodes_updated_at BEFORE UPDATE ON gpu_nodes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_models_updated_at BEFORE UPDATE ON ai_models
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_tasks_updated_at BEFORE UPDATE ON ai_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_balances_updated_at BEFORE UPDATE ON user_balances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();