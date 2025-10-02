-- MCP Coder Expert: Initial Database Schema
-- Migration: 001_initial_schema
-- Created: 2025-10-01

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROJECTS TABLE
-- ============================================
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TASKS TABLE
-- ============================================
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('backlog', 'todo', 'in_progress', 'done')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TASK DEPENDENCIES (many-to-many join table)
-- ============================================
CREATE TABLE task_dependencies (
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, depends_on_task_id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT no_self_dependency CHECK (task_id != depends_on_task_id)
);

-- ============================================
-- TEMPLATES TABLE
-- ============================================
CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('prompt', 'code', 'architecture', 'review')),
  content TEXT NOT NULL,
  variables TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PATTERNS TABLE
-- ============================================
CREATE TABLE patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  examples TEXT[] NOT NULL DEFAULT '{}',
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- LEARNINGS TABLE (includes feedback)
-- ============================================
CREATE TABLE learnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  context TEXT NOT NULL,
  action TEXT NOT NULL,
  result TEXT NOT NULL,
  lesson TEXT NOT NULL,
  type TEXT CHECK (type IN ('success', 'failure', 'improvement')),
  pattern TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RESOURCE NODES TABLE (for dependency graph)
-- ============================================
CREATE TABLE resource_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('file', 'component', 'api', 'model')),
  name TEXT NOT NULL,
  path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(type, name)
);

-- ============================================
-- RESOURCE EDGES TABLE (task -> resource relationships)
-- ============================================
CREATE TABLE resource_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  resource_id UUID REFERENCES resource_nodes(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('uses', 'modifies', 'creates')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(task_id, resource_id, action_type)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_task_dependencies_task ON task_dependencies(task_id);
CREATE INDEX idx_task_dependencies_depends ON task_dependencies(depends_on_task_id);
CREATE INDEX idx_learnings_task_id ON learnings(task_id);
CREATE INDEX idx_learnings_tags ON learnings USING GIN(tags);
CREATE INDEX idx_patterns_tags ON patterns USING GIN(tags);
CREATE INDEX idx_resource_edges_task ON resource_edges(task_id);
CREATE INDEX idx_resource_edges_resource ON resource_edges(resource_id);

-- ============================================
-- FUNCTIONS AND TRIGGERS
-- ============================================

-- Function to prevent circular dependencies
CREATE OR REPLACE FUNCTION check_circular_dependency()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    WITH RECURSIVE dep_chain AS (
      SELECT depends_on_task_id AS task_id
      FROM task_dependencies
      WHERE task_id = NEW.depends_on_task_id

      UNION ALL

      SELECT td.depends_on_task_id
      FROM task_dependencies td
      INNER JOIN dep_chain dc ON td.task_id = dc.task_id
    )
    SELECT 1 FROM dep_chain WHERE task_id = NEW.task_id
  ) THEN
    RAISE EXCEPTION 'Circular dependency detected';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_circular_dependencies
  BEFORE INSERT OR UPDATE ON task_dependencies
  FOR EACH ROW
  EXECUTE FUNCTION check_circular_dependency();

-- Function to validate status transitions
CREATE OR REPLACE FUNCTION validate_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'backlog' AND NEW.status NOT IN ('todo') THEN
    RAISE EXCEPTION 'Invalid transition from backlog to %', NEW.status;
  ELSIF OLD.status = 'todo' AND NEW.status NOT IN ('in_progress', 'backlog') THEN
    RAISE EXCEPTION 'Invalid transition from todo to %', NEW.status;
  ELSIF OLD.status = 'in_progress' AND NEW.status NOT IN ('done', 'todo') THEN
    RAISE EXCEPTION 'Invalid transition from in_progress to %', NEW.status;
  ELSIF OLD.status = 'done' AND NEW.status NOT IN ('todo') THEN
    RAISE EXCEPTION 'Invalid transition from done to %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_status_transitions
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION validate_status_transition();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_templates_updated_at
  BEFORE UPDATE ON templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_patterns_updated_at
  BEFORE UPDATE ON patterns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Function to detect conflicts for a task
CREATE OR REPLACE FUNCTION detect_conflicts(target_task_id UUID)
RETURNS TABLE (
  conflict_task_id UUID,
  conflict_task_title TEXT,
  resource_id UUID,
  resource_name TEXT,
  conflict_type TEXT,
  severity TEXT,
  description TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id AS conflict_task_id,
    t.title AS conflict_task_title,
    rn.id AS resource_id,
    rn.name AS resource_name,
    CASE
      WHEN re1.action_type IN ('modifies', 'creates')
        AND re2.action_type IN ('modifies', 'creates') THEN 'concurrent_write'
      WHEN (re1.action_type = 'modifies' AND re2.action_type = 'uses')
        OR (re1.action_type = 'uses' AND re2.action_type = 'modifies') THEN 'concurrent_modify'
      ELSE 'potential_collision'
    END AS conflict_type,
    CASE
      WHEN re1.action_type IN ('modifies', 'creates')
        AND re2.action_type IN ('modifies', 'creates') THEN 'high'
      WHEN (re1.action_type = 'modifies' AND re2.action_type = 'uses')
        OR (re1.action_type = 'uses' AND re2.action_type = 'modifies') THEN 'medium'
      ELSE 'low'
    END AS severity,
    CASE
      WHEN re1.action_type IN ('modifies', 'creates')
        AND re2.action_type IN ('modifies', 'creates')
        THEN 'Both tasks are modifying "' || rn.name || '" concurrently'
      WHEN re1.action_type = 'modifies' AND re2.action_type = 'uses'
        THEN '"' || rn.name || '" being modified while in use'
      WHEN re1.action_type = 'uses' AND re2.action_type = 'modifies'
        THEN '"' || rn.name || '" being modified while in use'
      ELSE 'Both tasks reading "' || rn.name || '" (usually safe)'
    END AS description
  FROM tasks t
  INNER JOIN resource_edges re1 ON re1.task_id = t.id
  INNER JOIN resource_edges re2 ON re2.resource_id = re1.resource_id
    AND re2.task_id = target_task_id
  INNER JOIN resource_nodes rn ON rn.id = re1.resource_id
  WHERE t.id != target_task_id
    AND t.status IN ('in_progress', 'todo');
END;
$$ LANGUAGE plpgsql;
