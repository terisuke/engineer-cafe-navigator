-- Create metrics tables for RAG monitoring

-- RAG search metrics
CREATE TABLE IF NOT EXISTS rag_search_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query VARCHAR(255) NOT NULL,
  language VARCHAR(2) NOT NULL,
  results_count INTEGER NOT NULL,
  avg_similarity FLOAT NOT NULL,
  response_time_ms INTEGER NOT NULL,
  category VARCHAR(50),
  cached BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for time-based queries
CREATE INDEX idx_rag_search_metrics_created_at ON rag_search_metrics(created_at DESC);
CREATE INDEX idx_rag_search_metrics_query ON rag_search_metrics(query);

-- External API metrics
CREATE TABLE IF NOT EXISTS external_api_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source VARCHAR(50) NOT NULL, -- 'connpass', 'google_calendar', 'website'
  action VARCHAR(100) NOT NULL,
  success BOOLEAN NOT NULL,
  response_time_ms INTEGER NOT NULL,
  cached BOOLEAN DEFAULT false,
  error_message TEXT,
  items_returned INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_external_api_metrics_created_at ON external_api_metrics(created_at DESC);
CREATE INDEX idx_external_api_metrics_source ON external_api_metrics(source);

-- Knowledge base operation metrics
CREATE TABLE IF NOT EXISTS knowledge_base_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation VARCHAR(20) NOT NULL, -- 'insert', 'update', 'delete', 'batch_import'
  category VARCHAR(50) NOT NULL,
  record_count INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_knowledge_base_metrics_created_at ON knowledge_base_metrics(created_at DESC);
CREATE INDEX idx_knowledge_base_metrics_operation ON knowledge_base_metrics(operation);

-- System metrics (general purpose)
CREATE TABLE IF NOT EXISTS system_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type VARCHAR(50) NOT NULL,
  value FLOAT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index
CREATE INDEX idx_system_metrics_created_at ON system_metrics(created_at DESC);
CREATE INDEX idx_system_metrics_type ON system_metrics(metric_type);

-- Create views for analytics

-- Daily RAG search summary
CREATE OR REPLACE VIEW rag_search_daily_summary AS
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_searches,
  AVG(response_time_ms) as avg_response_time,
  AVG(results_count) as avg_results_count,
  AVG(avg_similarity) as avg_similarity_score,
  SUM(CASE WHEN cached THEN 1 ELSE 0 END)::FLOAT / COUNT(*) as cache_hit_rate
FROM rag_search_metrics
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- External API usage summary
CREATE OR REPLACE VIEW external_api_daily_summary AS
SELECT 
  DATE(created_at) as date,
  source,
  COUNT(*) as total_requests,
  SUM(CASE WHEN success THEN 1 ELSE 0 END)::FLOAT / COUNT(*) as success_rate,
  AVG(response_time_ms) as avg_response_time,
  SUM(CASE WHEN cached THEN 1 ELSE 0 END)::FLOAT / COUNT(*) as cache_hit_rate
FROM external_api_metrics
GROUP BY DATE(created_at), source
ORDER BY date DESC, source;

-- Grant permissions
GRANT ALL ON rag_search_metrics TO service_role;
GRANT ALL ON external_api_metrics TO service_role;
GRANT ALL ON knowledge_base_metrics TO service_role;
GRANT ALL ON system_metrics TO service_role;
GRANT SELECT ON rag_search_daily_summary TO service_role;
GRANT SELECT ON external_api_daily_summary TO service_role;