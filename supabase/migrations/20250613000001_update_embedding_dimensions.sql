-- Update embedding column to use 768 dimensions (Google text-embedding-004 model)
ALTER TABLE knowledge_base DROP COLUMN IF EXISTS content_embedding;
ALTER TABLE knowledge_base ADD COLUMN content_embedding vector(768);

-- Update index for new embedding dimensions
DROP INDEX IF EXISTS idx_knowledge_base_embedding;
CREATE INDEX idx_knowledge_base_embedding ON knowledge_base USING ivfflat (content_embedding vector_cosine_ops);