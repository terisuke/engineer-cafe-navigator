-- Drop existing index first
DROP INDEX IF EXISTS idx_knowledge_base_embedding;

-- Alter column to 768 dimensions
ALTER TABLE knowledge_base 
ALTER COLUMN content_embedding TYPE vector(768);

-- Recreate index with correct dimensions
CREATE INDEX idx_knowledge_base_embedding 
ON knowledge_base 
USING ivfflat (content_embedding vector_cosine_ops)
WITH (lists = 100);

-- Verify the change
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'knowledge_base' 
AND column_name = 'content_embedding';