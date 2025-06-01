-- Migration tables for RAG V2 implementation

-- Implementation metrics for tracking V1 vs V2 performance
CREATE TABLE IF NOT EXISTS rag_implementation_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  implementation VARCHAR(10) NOT NULL, -- 'v1' or 'v2'
  query VARCHAR(255) NOT NULL,
  results_count INTEGER NOT NULL,
  avg_similarity FLOAT NOT NULL,
  response_time_ms INTEGER NOT NULL,
  category VARCHAR(50),
  language VARCHAR(2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_rag_impl_metrics_created_at ON rag_implementation_metrics(created_at DESC);
CREATE INDEX idx_rag_impl_metrics_implementation ON rag_implementation_metrics(implementation);

-- A/B test results for parallel comparison
CREATE TABLE IF NOT EXISTS rag_ab_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query VARCHAR(255) NOT NULL,
  v1_status VARCHAR(20) NOT NULL, -- 'fulfilled' or 'rejected'
  v2_status VARCHAR(20) NOT NULL,
  v1_response_time INTEGER,
  v2_response_time INTEGER,
  v1_results_count INTEGER,
  v2_results_count INTEGER,
  v1_avg_similarity FLOAT,
  v2_avg_similarity FLOAT,
  v1_error TEXT,
  v2_error TEXT,
  response_time_diff INTEGER, -- v2 - v1
  results_count_diff INTEGER,
  similarity_diff FLOAT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_rag_ab_test_created_at ON rag_ab_test_results(created_at DESC);

-- Migration status tracking
CREATE TABLE IF NOT EXISTS embedding_migration_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(50) NOT NULL,
  total_entries INTEGER NOT NULL,
  migrated_entries INTEGER NOT NULL,
  failed_entries INTEGER DEFAULT 0,
  status VARCHAR(20) NOT NULL, -- 'pending', 'in_progress', 'completed', 'failed'
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_migration_status_category ON embedding_migration_status(category);
CREATE INDEX idx_migration_status_status ON embedding_migration_status(status);

-- Create function to update migration status
CREATE OR REPLACE FUNCTION update_migration_status()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_migration_status_timestamp
BEFORE UPDATE ON embedding_migration_status
FOR EACH ROW
EXECUTE FUNCTION update_migration_status();

-- Grant permissions
GRANT ALL ON rag_implementation_metrics TO service_role;
GRANT ALL ON rag_ab_test_results TO service_role;
GRANT ALL ON embedding_migration_status TO service_role;