-- Orchestro: Notifications Table
-- Migration: 014_notifications_table
-- Created: 2025-01-04
-- Description: Real-time notifications system for project events and task updates

BEGIN;

-- ============================================
-- NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('info', 'warning', 'error', 'success')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Composite index for fetching unread notifications by project
-- Partial index only on unread notifications for optimal query performance
CREATE INDEX IF NOT EXISTS idx_notifications_unread_by_project
  ON notifications(project_id, is_read, created_at DESC)
  WHERE is_read = false;

-- GIN index for JSONB metadata queries
CREATE INDEX IF NOT EXISTS idx_notifications_metadata
  ON notifications USING GIN(metadata);

-- Standard indexes for common queries
CREATE INDEX IF NOT EXISTS idx_notifications_project_id
  ON notifications(project_id);

CREATE INDEX IF NOT EXISTS idx_notifications_task_id
  ON notifications(task_id);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at
  ON notifications(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_type
  ON notifications(type);

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp using existing function
CREATE TRIGGER update_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- TABLE COMMENTS
-- ============================================

COMMENT ON TABLE notifications IS 'Real-time notifications for project events, task updates, and system alerts';
COMMENT ON COLUMN notifications.id IS 'Unique notification identifier';
COMMENT ON COLUMN notifications.project_id IS 'Project this notification belongs to';
COMMENT ON COLUMN notifications.task_id IS 'Optional task reference (set to NULL if task deleted)';
COMMENT ON COLUMN notifications.type IS 'Notification severity: info, warning, error, success';
COMMENT ON COLUMN notifications.title IS 'Short notification title';
COMMENT ON COLUMN notifications.message IS 'Detailed notification message';
COMMENT ON COLUMN notifications.metadata IS 'Extensible JSON metadata for additional context';
COMMENT ON COLUMN notifications.is_read IS 'Whether user has read this notification';
COMMENT ON COLUMN notifications.created_at IS 'Timestamp when notification was created';
COMMENT ON COLUMN notifications.updated_at IS 'Timestamp when notification was last updated';

COMMIT;
