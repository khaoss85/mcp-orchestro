-- Event Queue for real-time updates
CREATE TABLE IF NOT EXISTS event_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'task_created',
    'task_updated',
    'feedback_received',
    'codebase_analyzed',
    'decision_made',
    'guardian_intervention',
    'code_changed',
    'status_transition'
  )),
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_event_queue_processed ON event_queue(processed, created_at);
CREATE INDEX idx_event_queue_type ON event_queue(event_type);

-- Auto-cleanup processed events older than 24 hours
CREATE OR REPLACE FUNCTION cleanup_old_events()
RETURNS void AS $$
BEGIN
  DELETE FROM event_queue
  WHERE processed = TRUE
  AND processed_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;
