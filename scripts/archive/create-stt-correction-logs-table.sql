-- Create table for STT correction logs
CREATE TABLE IF NOT EXISTS stt_correction_logs (
  id SERIAL PRIMARY KEY,
  original_text TEXT NOT NULL,
  corrected_text TEXT NOT NULL,
  language VARCHAR(10) DEFAULT 'ja',
  confidence FLOAT,
  corrections_applied TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_stt_corrections_created_at ON stt_correction_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stt_corrections_language ON stt_correction_logs(language);
CREATE INDEX IF NOT EXISTS idx_stt_corrections_original ON stt_correction_logs(original_text);

-- Add a view for common misrecognition patterns
CREATE OR REPLACE VIEW stt_misrecognition_patterns AS
SELECT 
  original_text,
  COUNT(*) as occurrence_count,
  MAX(created_at) as last_seen,
  MIN(created_at) as first_seen,
  ARRAY_AGG(DISTINCT corrected_text) as corrections
FROM stt_correction_logs
GROUP BY original_text
ORDER BY occurrence_count DESC;

-- Add RLS policies
ALTER TABLE stt_correction_logs ENABLE ROW LEVEL SECURITY;

-- Policy for service role (full access)
CREATE POLICY "Service role can manage STT correction logs" ON stt_correction_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy for authenticated users (read-only)
CREATE POLICY "Authenticated users can view STT correction logs" ON stt_correction_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- Comment on table
COMMENT ON TABLE stt_correction_logs IS 'Logs of STT (Speech-to-Text) corrections applied to fix common misrecognitions';
COMMENT ON COLUMN stt_correction_logs.original_text IS 'The original text from STT before correction';
COMMENT ON COLUMN stt_correction_logs.corrected_text IS 'The text after applying corrections';
COMMENT ON COLUMN stt_correction_logs.corrections_applied IS 'Array of correction rule descriptions that were applied';
COMMENT ON COLUMN stt_correction_logs.confidence IS 'The confidence score from STT (0-1)';