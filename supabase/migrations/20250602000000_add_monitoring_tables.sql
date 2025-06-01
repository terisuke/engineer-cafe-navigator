-- Add tables for production monitoring and rollback system

-- Performance baselines table
CREATE TABLE IF NOT EXISTS performance_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  metrics JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_performance_baselines_created_at ON performance_baselines(created_at DESC);

-- System snapshots for rollback
CREATE TABLE IF NOT EXISTS system_snapshots (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  feature_flags JSONB NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_system_snapshots_created_at ON system_snapshots(created_at DESC);

-- Rollback history
CREATE TABLE IF NOT EXISTS rollback_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id VARCHAR(255) NOT NULL,
  rollback_type VARCHAR(50) NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_rollback_history_created_at ON rollback_history(created_at DESC);

-- System errors tracking
CREATE TABLE IF NOT EXISTS system_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_type VARCHAR(100) NOT NULL,
  error_message TEXT,
  stack_trace TEXT,
  endpoint VARCHAR(255),
  user_id VARCHAR(255),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_system_errors_created_at ON system_errors(created_at DESC);
CREATE INDEX idx_system_errors_type ON system_errors(error_type);

-- Production alerts
CREATE TABLE IF NOT EXISTS production_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  metric VARCHAR(100) NOT NULL,
  value FLOAT NOT NULL,
  threshold FLOAT NOT NULL,
  source VARCHAR(100),
  metadata JSONB,
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_by VARCHAR(255),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_production_alerts_created_at ON production_alerts(created_at DESC);
CREATE INDEX idx_production_alerts_severity ON production_alerts(severity);
CREATE INDEX idx_production_alerts_acknowledged ON production_alerts(acknowledged);

-- Grant permissions
GRANT ALL ON performance_baselines TO service_role;
GRANT ALL ON system_snapshots TO service_role;
GRANT ALL ON rollback_history TO service_role;
GRANT ALL ON system_errors TO service_role;
GRANT ALL ON production_alerts TO service_role;