-- Make status transitions more flexible
-- Allow skipping intermediate steps (e.g., backlog → done)
-- Only block nonsensical transitions

CREATE OR REPLACE FUNCTION validate_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow same status (no transition)
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Allow any forward progression:
  -- backlog → todo | in_progress | done
  -- todo → in_progress | done
  -- in_progress → done

  -- Allow moving back to todo from any state (to reopen/reassess)
  IF NEW.status = 'todo' THEN
    RETURN NEW;
  END IF;

  -- Allow moving to backlog only from todo
  IF NEW.status = 'backlog' AND OLD.status = 'todo' THEN
    RETURN NEW;
  END IF;

  -- Validate forward transitions based on current status
  IF OLD.status = 'backlog' AND NEW.status IN ('todo', 'in_progress', 'done') THEN
    RETURN NEW;
  ELSIF OLD.status = 'todo' AND NEW.status IN ('in_progress', 'done') THEN
    RETURN NEW;
  ELSIF OLD.status = 'in_progress' AND NEW.status IN ('done') THEN
    RETURN NEW;
  ELSE
    RAISE EXCEPTION 'Invalid transition from % to %', OLD.status, NEW.status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
