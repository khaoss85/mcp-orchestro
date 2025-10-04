-- Orchestro: Project Configuration System
-- Migration: 012_project_configuration_system
-- Created: 2025-01-04
-- Description: Complete project configuration system including tech stack, sub-agents, MCP tools, and guardians

-- ============================================
-- PROJECT CONFIGURATION TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS project_configuration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TECH STACK TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS tech_stack (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('frontend', 'backend', 'database', 'testing', 'deployment', 'other')),
  framework TEXT NOT NULL,
  version TEXT,
  is_primary BOOLEAN DEFAULT false,
  configuration JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, category, framework)
);

-- ============================================
-- SUB AGENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS sub_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  agent_type TEXT NOT NULL CHECK (agent_type IN (
    'architecture-guardian',
    'database-guardian',
    'test-maintainer',
    'api-guardian',
    'production-ready-code-reviewer',
    'general-purpose',
    'custom'
  )),
  enabled BOOLEAN DEFAULT true,
  triggers TEXT[] DEFAULT '{}',
  custom_prompt TEXT,
  rules JSONB DEFAULT '[]'::jsonb,
  priority INTEGER DEFAULT 5,
  configuration JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, name, agent_type)
);

-- ============================================
-- MCP TOOLS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS mcp_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tool_type TEXT NOT NULL CHECK (tool_type IN (
    'memory',
    'sequential-thinking',
    'github',
    'supabase',
    'claude-context',
    'orchestro',
    'custom'
  )),
  command TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  when_to_use TEXT[] DEFAULT '{}',
  priority INTEGER DEFAULT 5,
  url TEXT,
  api_key TEXT,
  fallback_tool TEXT,
  configuration JSONB DEFAULT '{}'::jsonb,
  usage_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, name)
);

-- ============================================
-- PROJECT GUIDELINES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS project_guidelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  guideline_type TEXT NOT NULL CHECK (guideline_type IN ('always', 'never', 'pattern', 'architecture', 'best_practice')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  example TEXT,
  category TEXT,
  priority INTEGER DEFAULT 5,
  tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CODE PATTERNS LIBRARY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS code_patterns_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  example_code TEXT,
  language TEXT,
  framework TEXT,
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  usage_count INTEGER DEFAULT 0,
  success_rate DECIMAL(5,2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, name, language)
);

-- ============================================
-- GUARDIAN AGENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS guardian_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  guardian_type TEXT NOT NULL CHECK (guardian_type IN (
    'database',
    'architecture',
    'duplication',
    'test',
    'security',
    'performance',
    'custom'
  )),
  enabled BOOLEAN DEFAULT true,
  can_auto_fix BOOLEAN DEFAULT false,
  rules JSONB DEFAULT '[]'::jsonb,
  configuration JSONB DEFAULT '{}'::jsonb,
  priority INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, name, guardian_type)
);

-- ============================================
-- GUARDIAN VALIDATIONS TABLE (audit log)
-- ============================================
CREATE TABLE IF NOT EXISTS guardian_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_id UUID REFERENCES guardian_agents(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  validation_type TEXT NOT NULL CHECK (validation_type IN ('warning', 'error', 'info', 'fixed')),
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  auto_fixed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CONFIGURATION VERSIONS TABLE (for rollback)
-- ============================================
CREATE TABLE IF NOT EXISTS configuration_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  configuration_snapshot JSONB NOT NULL,
  changes_description TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, version)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_project_configuration_project ON project_configuration(project_id);
CREATE INDEX idx_tech_stack_project ON tech_stack(project_id);
CREATE INDEX idx_tech_stack_category ON tech_stack(category);
CREATE INDEX idx_sub_agents_project ON sub_agents(project_id);
CREATE INDEX idx_sub_agents_enabled ON sub_agents(enabled);
CREATE INDEX idx_mcp_tools_project ON mcp_tools(project_id);
CREATE INDEX idx_mcp_tools_enabled ON mcp_tools(enabled);
CREATE INDEX idx_mcp_tools_type ON mcp_tools(tool_type);
CREATE INDEX idx_project_guidelines_project ON project_guidelines(project_id);
CREATE INDEX idx_project_guidelines_type ON project_guidelines(guideline_type);
CREATE INDEX idx_project_guidelines_tags ON project_guidelines USING GIN(tags);
CREATE INDEX idx_code_patterns_project ON code_patterns_library(project_id);
CREATE INDEX idx_code_patterns_tags ON code_patterns_library USING GIN(tags);
CREATE INDEX idx_guardian_agents_project ON guardian_agents(project_id);
CREATE INDEX idx_guardian_agents_enabled ON guardian_agents(enabled);
CREATE INDEX idx_guardian_validations_guardian ON guardian_validations(guardian_id);
CREATE INDEX idx_guardian_validations_task ON guardian_validations(task_id);
CREATE INDEX idx_configuration_versions_project ON configuration_versions(project_id);

-- ============================================
-- FUNCTIONS AND TRIGGERS
-- ============================================

-- Function to update MCP tool usage statistics
CREATE OR REPLACE FUNCTION update_mcp_tool_usage()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE mcp_tools
  SET
    usage_count = usage_count + 1,
    last_used_at = NOW()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to create configuration version snapshot
CREATE OR REPLACE FUNCTION create_configuration_snapshot()
RETURNS TRIGGER AS $$
DECLARE
  v_version INTEGER;
  v_snapshot JSONB;
BEGIN
  -- Get next version number
  SELECT COALESCE(MAX(version), 0) + 1 INTO v_version
  FROM configuration_versions
  WHERE project_id = NEW.project_id;

  -- Build complete configuration snapshot
  SELECT jsonb_build_object(
    'tech_stack', (SELECT jsonb_agg(to_jsonb(t.*)) FROM tech_stack t WHERE t.project_id = NEW.project_id),
    'sub_agents', (SELECT jsonb_agg(to_jsonb(sa.*)) FROM sub_agents sa WHERE sa.project_id = NEW.project_id),
    'mcp_tools', (SELECT jsonb_agg(to_jsonb(mt.*)) FROM mcp_tools mt WHERE mt.project_id = NEW.project_id),
    'guidelines', (SELECT jsonb_agg(to_jsonb(pg.*)) FROM project_guidelines pg WHERE pg.project_id = NEW.project_id),
    'patterns', (SELECT jsonb_agg(to_jsonb(cp.*)) FROM code_patterns_library cp WHERE cp.project_id = NEW.project_id),
    'guardians', (SELECT jsonb_agg(to_jsonb(ga.*)) FROM guardian_agents ga WHERE ga.project_id = NEW.project_id)
  ) INTO v_snapshot;

  -- Insert version snapshot
  INSERT INTO configuration_versions (project_id, version, configuration_snapshot, changes_description)
  VALUES (NEW.project_id, v_version, v_snapshot, 'Auto-snapshot on configuration update');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER snapshot_on_config_update
  AFTER UPDATE ON project_configuration
  FOR EACH ROW
  WHEN (OLD.configuration IS DISTINCT FROM NEW.configuration)
  EXECUTE FUNCTION create_configuration_snapshot();

-- Function to get active configuration for a project
CREATE OR REPLACE FUNCTION get_active_project_config(p_project_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_config JSONB;
BEGIN
  SELECT jsonb_build_object(
    'project_id', p_project_id,
    'tech_stack', (
      SELECT jsonb_agg(jsonb_build_object(
        'category', category,
        'framework', framework,
        'version', version,
        'is_primary', is_primary,
        'configuration', configuration
      ))
      FROM tech_stack
      WHERE project_id = p_project_id
    ),
    'sub_agents', (
      SELECT jsonb_agg(jsonb_build_object(
        'name', name,
        'agent_type', agent_type,
        'enabled', enabled,
        'triggers', triggers,
        'custom_prompt', custom_prompt,
        'rules', rules,
        'priority', priority
      ) ORDER BY priority ASC)
      FROM sub_agents
      WHERE project_id = p_project_id AND enabled = true
    ),
    'mcp_tools', (
      SELECT jsonb_agg(jsonb_build_object(
        'name', name,
        'tool_type', tool_type,
        'command', command,
        'when_to_use', when_to_use,
        'priority', priority,
        'fallback', fallback_tool
      ) ORDER BY priority ASC)
      FROM mcp_tools
      WHERE project_id = p_project_id AND enabled = true
    ),
    'guidelines', (
      SELECT jsonb_build_object(
        'always', (SELECT jsonb_agg(description) FROM project_guidelines WHERE project_id = p_project_id AND guideline_type = 'always' AND is_active = true),
        'never', (SELECT jsonb_agg(description) FROM project_guidelines WHERE project_id = p_project_id AND guideline_type = 'never' AND is_active = true),
        'patterns', (SELECT jsonb_agg(jsonb_build_object('name', name, 'description', description, 'example', example)) FROM code_patterns_library WHERE project_id = p_project_id)
      )
    ),
    'guardians', (
      SELECT jsonb_agg(jsonb_build_object(
        'name', name,
        'guardian_type', guardian_type,
        'enabled', enabled,
        'can_auto_fix', can_auto_fix,
        'rules', rules,
        'priority', priority
      ) ORDER BY priority ASC)
      FROM guardian_agents
      WHERE project_id = p_project_id AND enabled = true
    )
  ) INTO v_config;

  RETURN v_config;
END;
$$ LANGUAGE plpgsql;

-- Function to recommend tools for a task
CREATE OR REPLACE FUNCTION recommend_tools_for_task(
  p_task_description TEXT,
  p_project_id UUID,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  tool_name TEXT,
  tool_type TEXT,
  reason TEXT,
  confidence DECIMAL(3,2),
  priority INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH task_keywords AS (
    SELECT unnest(string_to_array(lower(p_task_description), ' ')) AS keyword
  ),
  tool_matches AS (
    SELECT
      mt.name,
      mt.tool_type,
      mt.priority,
      mt.when_to_use,
      COUNT(DISTINCT tk.keyword) AS match_count,
      CASE
        WHEN mt.success_count > 0
        THEN ROUND((mt.success_count::DECIMAL / NULLIF(mt.usage_count, 0))::DECIMAL, 2)
        ELSE 0.50
      END AS success_rate
    FROM mcp_tools mt
    CROSS JOIN task_keywords tk
    WHERE mt.project_id = p_project_id
      AND mt.enabled = true
      AND EXISTS (
        SELECT 1 FROM unnest(mt.when_to_use) AS wtu
        WHERE lower(wtu) LIKE '%' || tk.keyword || '%'
      )
    GROUP BY mt.id, mt.name, mt.tool_type, mt.priority, mt.when_to_use, mt.success_count, mt.usage_count
  )
  SELECT
    tm.name::TEXT,
    tm.tool_type::TEXT,
    array_to_string(tm.when_to_use, ', ')::TEXT AS reason,
    LEAST(0.99, (tm.match_count::DECIMAL / 10.0 + tm.success_rate) / 2.0)::DECIMAL(3,2) AS confidence,
    tm.priority
  FROM tool_matches tm
  ORDER BY confidence DESC, tm.priority ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to run guardians on a task
CREATE OR REPLACE FUNCTION run_guardians_on_task(
  p_task_id UUID,
  p_context JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  guardian_name TEXT,
  validation_type TEXT,
  message TEXT,
  details JSONB,
  can_block BOOLEAN
) AS $$
DECLARE
  v_project_id UUID;
BEGIN
  -- Get project_id from task
  SELECT project_id INTO v_project_id FROM tasks WHERE id = p_task_id;

  -- For now, return placeholder results
  -- In real implementation, this would execute guardian logic
  RETURN QUERY
  SELECT
    ga.name::TEXT,
    'info'::TEXT AS validation_type,
    'Guardian validation placeholder - implement specific logic per guardian type'::TEXT AS message,
    jsonb_build_object('guardian_type', ga.guardian_type, 'rules', ga.rules) AS details,
    false AS can_block
  FROM guardian_agents ga
  WHERE ga.project_id = v_project_id
    AND ga.enabled = true
  ORDER BY ga.priority ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to get guardian report for a task
CREATE OR REPLACE FUNCTION get_guardian_report(p_task_id UUID)
RETURNS TABLE (
  guardian_name TEXT,
  total_validations INTEGER,
  warnings INTEGER,
  errors INTEGER,
  fixes INTEGER,
  last_run TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ga.name::TEXT,
    COUNT(gv.id)::INTEGER AS total_validations,
    COUNT(CASE WHEN gv.validation_type = 'warning' THEN 1 END)::INTEGER AS warnings,
    COUNT(CASE WHEN gv.validation_type = 'error' THEN 1 END)::INTEGER AS errors,
    COUNT(CASE WHEN gv.validation_type = 'fixed' THEN 1 END)::INTEGER AS fixes,
    MAX(gv.created_at) AS last_run
  FROM guardian_agents ga
  LEFT JOIN guardian_validations gv ON gv.guardian_id = ga.id AND gv.task_id = p_task_id
  WHERE ga.enabled = true
  GROUP BY ga.id, ga.name
  ORDER BY last_run DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- INITIAL DATA (DEFAULT CONFIGURATION)
-- ============================================

-- Insert default MCP tools configuration (will be project-specific when projects are created)
-- This serves as a template/reference

COMMENT ON TABLE project_configuration IS 'Main project configuration settings';
COMMENT ON TABLE tech_stack IS 'Technology stack configuration for each project';
COMMENT ON TABLE sub_agents IS 'Claude Code sub-agents configuration';
COMMENT ON TABLE mcp_tools IS 'MCP tools registry and configuration';
COMMENT ON TABLE project_guidelines IS 'Project-specific guidelines (always/never rules, patterns)';
COMMENT ON TABLE code_patterns_library IS 'Reusable code patterns library';
COMMENT ON TABLE guardian_agents IS 'Guardian agents for code quality protection';
COMMENT ON TABLE guardian_validations IS 'Audit log of guardian validations';
COMMENT ON TABLE configuration_versions IS 'Configuration version history for rollback capability';
