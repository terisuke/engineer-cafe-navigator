-- Create a function to search the knowledge base using pgvector
CREATE OR REPLACE FUNCTION search_knowledge_base(
  query_embedding vector(1536),
  similarity_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  content text,
  category varchar(50),
  subcategory varchar(50),
  language varchar(2),
  source varchar(255),
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    kb.id,
    kb.content,
    kb.category,
    kb.subcategory,
    kb.language,
    kb.source,
    kb.metadata,
    1 - (kb.content_embedding <=> query_embedding) AS similarity
  FROM knowledge_base kb
  WHERE 
    kb.content_embedding IS NOT NULL
    AND 1 - (kb.content_embedding <=> query_embedding) >= similarity_threshold
  ORDER BY kb.content_embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Add an index for better performance on embedding searches
CREATE INDEX IF NOT EXISTS idx_knowledge_base_embedding_cosine 
ON knowledge_base 
USING ivfflat (content_embedding vector_cosine_ops)
WITH (lists = 100);

-- Add a function to insert knowledge with automatic embedding generation
-- This is a placeholder - actual embedding generation should be done in the application
CREATE OR REPLACE FUNCTION add_knowledge_base_entry(
  p_content text,
  p_category varchar(50) DEFAULT NULL,
  p_subcategory varchar(50) DEFAULT NULL,
  p_language varchar(2) DEFAULT 'ja',
  p_source varchar(255) DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  new_id uuid;
BEGIN
  INSERT INTO knowledge_base (
    content,
    category,
    subcategory,
    language,
    source,
    metadata
  ) VALUES (
    p_content,
    p_category,
    p_subcategory,
    p_language,
    p_source,
    p_metadata
  ) RETURNING id INTO new_id;
  
  RETURN new_id;
END;
$$;

-- Grant execute permissions to service role
GRANT EXECUTE ON FUNCTION search_knowledge_base TO service_role;
GRANT EXECUTE ON FUNCTION add_knowledge_base_entry TO service_role;