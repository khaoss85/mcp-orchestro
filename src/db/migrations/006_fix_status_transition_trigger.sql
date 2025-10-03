-- Fix status transition trigger to allow same-status updates
-- This fixes a bug where updating metadata would fail if status didn't change

CREATE OR REPLACE FUNCTION validate_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow same status (no transition)
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Validate transitions between different statuses
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
