-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Conversation sessions table
CREATE TABLE IF NOT EXISTS conversation_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id uuid,
  language varchar(2) DEFAULT 'ja' CHECK (language IN ('ja', 'en')),
  mode varchar(20) DEFAULT 'welcome',
  started_at timestamp with time zone DEFAULT now(),
  ended_at timestamp with time zone,
  status varchar(20) DEFAULT 'active',
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Conversation history table
CREATE TABLE IF NOT EXISTS conversation_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid REFERENCES conversation_sessions(id) ON DELETE CASCADE,
  role varchar(10) CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  audio_url text,
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now()
);

-- Knowledge base for RAG
CREATE TABLE IF NOT EXISTS knowledge_base (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  content text NOT NULL,
  content_embedding vector(1536),
  category varchar(50),
  subcategory varchar(50),
  language varchar(2) CHECK (language IN ('ja', 'en')),
  source varchar(255),
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Agent memory storage
CREATE TABLE IF NOT EXISTS agent_memory (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_name varchar(100) NOT NULL,
  key varchar(255) NOT NULL,
  value jsonb NOT NULL,
  expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(agent_name, key)
);

-- Analytics and metrics
CREATE TABLE IF NOT EXISTS conversation_analytics (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid REFERENCES conversation_sessions(id) ON DELETE CASCADE,
  metric_type varchar(50) NOT NULL,
  metric_value jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_conversation_sessions_visitor_id ON conversation_sessions(visitor_id);
CREATE INDEX idx_conversation_sessions_status ON conversation_sessions(status);
CREATE INDEX idx_conversation_history_session_id ON conversation_history(session_id);
CREATE INDEX idx_conversation_history_created_at ON conversation_history(created_at);
CREATE INDEX idx_knowledge_base_category ON knowledge_base(category, language);
CREATE INDEX idx_knowledge_base_embedding ON knowledge_base USING ivfflat (content_embedding vector_cosine_ops);
CREATE INDEX idx_agent_memory_agent_key ON agent_memory(agent_name, key);

-- Row Level Security (RLS) policies
ALTER TABLE conversation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_analytics ENABLE ROW LEVEL SECURITY;

-- Service role has full access (for backend)
CREATE POLICY "Service role has full access to sessions" ON conversation_sessions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to history" ON conversation_history
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to knowledge" ON knowledge_base
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to memory" ON agent_memory
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to analytics" ON conversation_analytics
  FOR ALL USING (auth.role() = 'service_role');

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_conversation_sessions_updated_at BEFORE UPDATE
  ON conversation_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_knowledge_base_updated_at BEFORE UPDATE
  ON knowledge_base FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_memory_updated_at BEFORE UPDATE
  ON agent_memory FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
