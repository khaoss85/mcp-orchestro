-- Code Entities and Dependencies for Codebase Explorer
-- Extends existing resource_nodes system with code-level analysis

-- Code entities table (functions, classes, components, etc.)
CREATE TABLE IF NOT EXISTS code_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID REFERENCES resource_nodes(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('function', 'class', 'interface', 'component', 'type', 'variable', 'constant')),
  name TEXT NOT NULL,
  signature TEXT,
  location JSONB NOT NULL, -- { startLine, endLine, startColumn, endColumn }
  documentation TEXT,
  exported BOOLEAN DEFAULT false,
  metrics JSONB DEFAULT '{}', -- { cyclomatic, cognitive, maintainability, loc }
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(resource_id, name, type)
);

-- Code dependencies (entity → entity imports/uses)
CREATE TABLE IF NOT EXISTS code_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_entity_id UUID REFERENCES code_entities(id) ON DELETE CASCADE,
  to_entity_id UUID REFERENCES code_entities(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL CHECK (dependency_type IN ('import', 'call', 'extends', 'implements', 'type_reference')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_entity_id, to_entity_id, dependency_type)
);

-- File history from git
CREATE TABLE IF NOT EXISTS file_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID REFERENCES resource_nodes(id) ON DELETE CASCADE,
  commit_hash TEXT NOT NULL,
  author TEXT NOT NULL,
  date TIMESTAMPTZ NOT NULL,
  message TEXT,
  insertions INTEGER DEFAULT 0,
  deletions INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(resource_id, commit_hash)
);

-- Codebase analysis metadata
CREATE TABLE IF NOT EXISTS codebase_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  root_path TEXT NOT NULL,
  total_files INTEGER DEFAULT 0,
  total_entities INTEGER DEFAULT 0,
  total_dependencies INTEGER DEFAULT 0,
  analysis_duration_ms INTEGER,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_code_entities_resource ON code_entities(resource_id);
CREATE INDEX IF NOT EXISTS idx_code_entities_name ON code_entities(name);
CREATE INDEX IF NOT EXISTS idx_code_entities_type ON code_entities(type);
CREATE INDEX IF NOT EXISTS idx_code_entities_exported ON code_entities(exported) WHERE exported = true;
CREATE INDEX IF NOT EXISTS idx_code_entities_complexity ON code_entities(((metrics->>'cyclomatic')::INTEGER)) WHERE (metrics->>'cyclomatic')::INTEGER > 10;

CREATE INDEX IF NOT EXISTS idx_code_dependencies_from ON code_dependencies(from_entity_id);
CREATE INDEX IF NOT EXISTS idx_code_dependencies_to ON code_dependencies(to_entity_id);
CREATE INDEX IF NOT EXISTS idx_code_dependencies_type ON code_dependencies(dependency_type);

CREATE INDEX IF NOT EXISTS idx_file_history_resource ON file_history(resource_id);
CREATE INDEX IF NOT EXISTS idx_file_history_date ON file_history(date DESC);
CREATE INDEX IF NOT EXISTS idx_file_history_author ON file_history(author);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_code_entity_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_code_entity_updated_at
  BEFORE UPDATE ON code_entities
  FOR EACH ROW
  EXECUTE FUNCTION update_code_entity_updated_at();

-- Function to get entity health score (0-100)
CREATE OR REPLACE FUNCTION get_entity_health(entity_id UUID)
RETURNS INTEGER AS $$
DECLARE
  entity_metrics JSONB;
  complexity INTEGER;
  maintainability INTEGER;
  health_score INTEGER;
BEGIN
  SELECT metrics INTO entity_metrics FROM code_entities WHERE id = entity_id;

  complexity := COALESCE((entity_metrics->>'cyclomatic')::INTEGER, 1);
  maintainability := COALESCE((entity_metrics->>'maintainability')::INTEGER, 100);

  -- Health calculation:
  -- - Low complexity (1-5): 100-90
  -- - Medium complexity (6-10): 89-70
  -- - High complexity (11-20): 69-40
  -- - Very high complexity (21+): 39-0
  -- Adjusted by maintainability score

  IF complexity <= 5 THEN
    health_score := 100 - complexity;
  ELSIF complexity <= 10 THEN
    health_score := 90 - (complexity - 5) * 4;
  ELSIF complexity <= 20 THEN
    health_score := 70 - (complexity - 10) * 3;
  ELSE
    health_score := 40 - LEAST(complexity - 20, 40);
  END IF;

  -- Factor in maintainability (weighted 30%)
  health_score := (health_score * 7 + maintainability * 3) / 10;

  RETURN GREATEST(0, LEAST(100, health_score));
END;
$$ LANGUAGE plpgsql;

-- Function to detect impact of changing an entity
CREATE OR REPLACE FUNCTION get_entity_impact(entity_id UUID)
RETURNS TABLE(
  affected_entity_id UUID,
  affected_entity_name TEXT,
  affected_entity_type TEXT,
  impact_level TEXT,
  dependency_chain_length INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE impact_chain AS (
    -- Direct dependencies
    SELECT
      cd.from_entity_id as affected_id,
      1 as depth
    FROM code_dependencies cd
    WHERE cd.to_entity_id = entity_id

    UNION

    -- Transitive dependencies (up to 5 levels deep)
    SELECT
      cd.from_entity_id,
      ic.depth + 1
    FROM code_dependencies cd
    JOIN impact_chain ic ON cd.to_entity_id = ic.affected_id
    WHERE ic.depth < 5
  )
  SELECT
    ic.affected_id,
    ce.name,
    ce.type,
    CASE
      WHEN ic.depth = 1 THEN 'high'
      WHEN ic.depth = 2 THEN 'medium'
      ELSE 'low'
    END as impact_level,
    ic.depth
  FROM impact_chain ic
  JOIN code_entities ce ON ce.id = ic.affected_id
  ORDER BY ic.depth, ce.name;
END;
$$ LANGUAGE plpgsql;
