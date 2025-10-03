-- Migration 009: Add pattern frequency tracking
-- Created: 2025-10-03
-- Purpose: Track pattern usage frequency to identify most common patterns and trends

BEGIN;

-- Create pattern_frequency table to aggregate pattern occurrences
CREATE TABLE IF NOT EXISTS pattern_frequency (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern TEXT NOT NULL,
  frequency INTEGER NOT NULL DEFAULT 1,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  improvement_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pattern)
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_pattern_frequency_pattern ON pattern_frequency(pattern);
CREATE INDEX IF NOT EXISTS idx_pattern_frequency_frequency ON pattern_frequency(frequency DESC);
CREATE INDEX IF NOT EXISTS idx_pattern_frequency_last_seen ON pattern_frequency(last_seen DESC);

-- Function to increment pattern frequency (called when feedback is added)
CREATE OR REPLACE FUNCTION increment_pattern_frequency()
RETURNS TRIGGER AS $$
BEGIN
  -- Only track if pattern field is not null
  IF NEW.pattern IS NOT NULL AND NEW.pattern != '' THEN
    INSERT INTO pattern_frequency (pattern, frequency, last_seen, first_seen, success_count, failure_count, improvement_count)
    VALUES (
      NEW.pattern,
      1,
      NOW(),
      NOW(),
      CASE WHEN NEW.type = 'success' THEN 1 ELSE 0 END,
      CASE WHEN NEW.type = 'failure' THEN 1 ELSE 0 END,
      CASE WHEN NEW.type = 'improvement' THEN 1 ELSE 0 END
    )
    ON CONFLICT (pattern) DO UPDATE
    SET
      frequency = pattern_frequency.frequency + 1,
      last_seen = NOW(),
      success_count = pattern_frequency.success_count + CASE WHEN NEW.type = 'success' THEN 1 ELSE 0 END,
      failure_count = pattern_frequency.failure_count + CASE WHEN NEW.type = 'failure' THEN 1 ELSE 0 END,
      improvement_count = pattern_frequency.improvement_count + CASE WHEN NEW.type = 'improvement' THEN 1 ELSE 0 END,
      updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically track pattern frequency when learnings are added
CREATE TRIGGER track_pattern_frequency
  AFTER INSERT ON learnings
  FOR EACH ROW
  EXECUTE FUNCTION increment_pattern_frequency();

-- Update trigger for updated_at timestamp
CREATE TRIGGER update_pattern_frequency_updated_at
  BEFORE UPDATE ON pattern_frequency
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Function to get top patterns by frequency
CREATE OR REPLACE FUNCTION get_top_patterns(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
  pattern TEXT,
  frequency INTEGER,
  success_rate NUMERIC,
  last_seen TIMESTAMPTZ,
  first_seen TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pf.pattern,
    pf.frequency,
    CASE
      WHEN pf.frequency > 0
      THEN ROUND((pf.success_count::NUMERIC / pf.frequency::NUMERIC) * 100, 2)
      ELSE 0
    END AS success_rate,
    pf.last_seen,
    pf.first_seen
  FROM pattern_frequency pf
  ORDER BY pf.frequency DESC, pf.last_seen DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get trending patterns (most used in last 7 days)
CREATE OR REPLACE FUNCTION get_trending_patterns(days INTEGER DEFAULT 7, limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
  pattern TEXT,
  recent_frequency BIGINT,
  total_frequency INTEGER,
  success_rate NUMERIC,
  last_seen TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pf.pattern,
    COUNT(l.id)::BIGINT AS recent_frequency,
    pf.frequency AS total_frequency,
    CASE
      WHEN pf.frequency > 0
      THEN ROUND((pf.success_count::NUMERIC / pf.frequency::NUMERIC) * 100, 2)
      ELSE 0
    END AS success_rate,
    pf.last_seen
  FROM pattern_frequency pf
  LEFT JOIN learnings l ON l.pattern = pf.pattern
    AND l.created_at >= NOW() - (days || ' days')::INTERVAL
  GROUP BY pf.pattern, pf.frequency, pf.success_count, pf.last_seen
  HAVING COUNT(l.id) > 0
  ORDER BY recent_frequency DESC, pf.last_seen DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Add column comments for documentation
COMMENT ON TABLE pattern_frequency IS 'Aggregated frequency tracking for patterns used in learnings/feedback';
COMMENT ON COLUMN pattern_frequency.pattern IS 'The pattern identifier being tracked';
COMMENT ON COLUMN pattern_frequency.frequency IS 'Total number of times this pattern has been used';
COMMENT ON COLUMN pattern_frequency.last_seen IS 'Timestamp of most recent usage';
COMMENT ON COLUMN pattern_frequency.first_seen IS 'Timestamp of first usage';
COMMENT ON COLUMN pattern_frequency.success_count IS 'Number of times pattern resulted in success';
COMMENT ON COLUMN pattern_frequency.failure_count IS 'Number of times pattern resulted in failure';
COMMENT ON COLUMN pattern_frequency.improvement_count IS 'Number of times pattern resulted in improvement';

COMMIT;
