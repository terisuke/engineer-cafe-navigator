-- Remove duplicate RAG data from knowledge_base table
-- This script keeps the oldest record for each unique content and removes all duplicates
-- Expected to remove 297 duplicate records, keeping 33 unique records

-- Step 1: Create a temporary table to identify records to keep
CREATE TEMP TABLE records_to_keep AS
WITH ranked_records AS (
  SELECT 
    id,
    content,
    ROW_NUMBER() OVER (
      PARTITION BY content 
      ORDER BY created_at ASC, id ASC
    ) as rn
  FROM knowledge_base
)
SELECT id
FROM ranked_records
WHERE rn = 1;

-- Step 2: Show statistics before deletion
SELECT 
  'Before deletion' as status,
  COUNT(*) as total_records,
  COUNT(DISTINCT content) as unique_content_count,
  COUNT(*) - COUNT(DISTINCT content) as duplicate_records
FROM knowledge_base;

-- Step 3: Delete duplicate records
DELETE FROM knowledge_base 
WHERE id NOT IN (SELECT id FROM records_to_keep);

-- Step 4: Show statistics after deletion
SELECT 
  'After deletion' as status,
  COUNT(*) as total_records,
  COUNT(DISTINCT content) as unique_content_count,
  COUNT(*) - COUNT(DISTINCT content) as duplicate_records
FROM knowledge_base;

-- Step 5: Verify no duplicates remain
SELECT 
  content,
  COUNT(*) as count
FROM knowledge_base
GROUP BY content
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- Step 6: Show deletion summary by source
SELECT 
  source,
  COUNT(*) as remaining_records
FROM knowledge_base
GROUP BY source
ORDER BY COUNT(*) DESC;

-- Clean up temporary table
DROP TABLE records_to_keep;