-- Migration: Schema Usage Tracking
-- Purpose: Track which tables/columns are actively used to detect obsolete schema elements
-- Created: 2025-10-04

-- Table to track schema element usage
CREATE TABLE IF NOT EXISTS schema_usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_type TEXT NOT NULL CHECK (schema_type IN ('table', 'column', 'function', 'view')),
  schema_name TEXT NOT NULL,
  parent_name TEXT, -- table name for columns
  last_accessed TIMESTAMPTZ DEFAULT NOW(),
  access_count INTEGER DEFAULT 1,
  accessed_by TEXT, -- which part of code accessed it
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(schema_type, schema_name, parent_name)
);

-- Track table deprecation
CREATE TABLE IF NOT EXISTS schema_deprecation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_type TEXT NOT NULL CHECK (schema_type IN ('table', 'column', 'function', 'view')),
  schema_name TEXT NOT NULL,
  parent_name TEXT,
  deprecated_at TIMESTAMPTZ DEFAULT NOW(),
  deprecation_reason TEXT,
  planned_removal_date TIMESTAMPTZ,
  migration_path TEXT, -- instructions for migration
  status TEXT DEFAULT 'deprecated' CHECK (status IN ('deprecated', 'removed', 'kept')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(schema_type, schema_name, parent_name)
);

-- Indexes
CREATE INDEX idx_schema_usage_last_accessed ON schema_usage_tracking(last_accessed DESC);
CREATE INDEX idx_schema_usage_type ON schema_usage_tracking(schema_type, schema_name);
CREATE INDEX idx_schema_deprecation_status ON schema_deprecation(status, planned_removal_date);

-- Function to record schema access
CREATE OR REPLACE FUNCTION record_schema_access(
  p_schema_type TEXT,
  p_schema_name TEXT,
  p_parent_name TEXT DEFAULT NULL,
  p_accessed_by TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO schema_usage_tracking (schema_type, schema_name, parent_name, last_accessed, access_count, accessed_by)
  VALUES (p_schema_type, p_schema_name, p_parent_name, NOW(), 1, p_accessed_by)
  ON CONFLICT (schema_type, schema_name, parent_name) DO UPDATE
  SET
    last_accessed = NOW(),
    access_count = schema_usage_tracking.access_count + 1,
    accessed_by = COALESCE(p_accessed_by, schema_usage_tracking.accessed_by),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to find unused schema elements (not accessed in N days)
CREATE OR REPLACE FUNCTION find_unused_schema_elements(days_threshold INTEGER DEFAULT 30)
RETURNS TABLE (
  schema_type TEXT,
  schema_name TEXT,
  parent_name TEXT,
  last_accessed TIMESTAMPTZ,
  days_since_access INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sut.schema_type,
    sut.schema_name,
    sut.parent_name,
    sut.last_accessed,
    EXTRACT(DAY FROM NOW() - sut.last_accessed)::INTEGER as days_since_access
  FROM schema_usage_tracking sut
  WHERE sut.last_accessed < NOW() - (days_threshold || ' days')::INTERVAL
  ORDER BY sut.last_accessed ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to get all tables in schema (for comparison)
CREATE OR REPLACE FUNCTION get_schema_tables()
RETURNS TABLE (
  table_name TEXT,
  tracked BOOLEAN,
  last_accessed TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.tablename::TEXT,
    EXISTS(
      SELECT 1 FROM schema_usage_tracking sut
      WHERE sut.schema_type = 'table'
      AND sut.schema_name = t.tablename
    ) as tracked,
    (
      SELECT sut.last_accessed FROM schema_usage_tracking sut
      WHERE sut.schema_type = 'table'
      AND sut.schema_name = t.tablename
    ) as last_accessed
  FROM pg_tables t
  WHERE t.schemaname = 'public'
  ORDER BY t.tablename;
END;
$$ LANGUAGE plpgsql;

-- View for schema health dashboard
CREATE OR REPLACE VIEW schema_health_dashboard AS
SELECT
  sut.schema_type,
  sut.schema_name,
  sut.parent_name,
  sut.last_accessed,
  sut.access_count,
  EXTRACT(DAY FROM NOW() - sut.last_accessed)::INTEGER as days_since_access,
  sd.status as deprecation_status,
  sd.planned_removal_date,
  CASE
    WHEN sd.status = 'deprecated' THEN 'DEPRECATED'
    WHEN sut.last_accessed < NOW() - INTERVAL '90 days' THEN 'UNUSED_90_DAYS'
    WHEN sut.last_accessed < NOW() - INTERVAL '30 days' THEN 'UNUSED_30_DAYS'
    WHEN sut.access_count < 10 THEN 'LOW_USAGE'
    ELSE 'ACTIVE'
  END as health_status
FROM schema_usage_tracking sut
LEFT JOIN schema_deprecation sd
  ON sd.schema_type = sut.schema_type
  AND sd.schema_name = sut.schema_name
  AND COALESCE(sd.parent_name, '') = COALESCE(sut.parent_name, '')
ORDER BY sut.last_accessed ASC;

-- Comments
COMMENT ON TABLE schema_usage_tracking IS 'Tracks access to database schema elements to identify unused tables/columns';
COMMENT ON TABLE schema_deprecation IS 'Manages deprecation lifecycle of schema elements before removal';
COMMENT ON FUNCTION record_schema_access IS 'Records when a schema element is accessed by application code';
COMMENT ON FUNCTION find_unused_schema_elements IS 'Returns schema elements not accessed within threshold days';
COMMENT ON VIEW schema_health_dashboard IS 'Dashboard view showing health status of all tracked schema elements';
