-- ============================================
-- SINGLE SOURCE OF TRUTH FOR XP
-- profiles.xp is authoritative, maintained by triggers
-- on habit_logs and xp_events.
-- ============================================

-- Recompute a single user's XP from scratch:
--   XP = SUM(habit_logs: awarded + recovered - penalty) + SUM(xp_events.xp_amount)
-- Clamped at 0.
CREATE OR REPLACE FUNCTION recompute_user_xp(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  log_xp   INTEGER;
  event_xp INTEGER;
  total    INTEGER;
BEGIN
  SELECT COALESCE(SUM(xp_awarded + xp_recovered - xp_penalty), 0)
    INTO log_xp
    FROM habit_logs
   WHERE user_id = p_user_id;

  SELECT COALESCE(SUM(xp_amount), 0)
    INTO event_xp
    FROM xp_events
   WHERE user_id = p_user_id;

  total := GREATEST(0, log_xp + event_xp);

  UPDATE profiles SET xp = total WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function — figures out which user to recompute for INSERT/UPDATE/DELETE
CREATE OR REPLACE FUNCTION trg_recompute_xp()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recompute_user_xp(OLD.user_id);
    RETURN OLD;
  ELSE
    PERFORM recompute_user_xp(NEW.user_id);
    -- If UPDATE changed user_id (shouldn't happen, but safe), recompute old owner too
    IF TG_OP = 'UPDATE' AND OLD.user_id IS DISTINCT FROM NEW.user_id THEN
      PERFORM recompute_user_xp(OLD.user_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach to habit_logs
DROP TRIGGER IF EXISTS habit_logs_xp_sync ON habit_logs;
CREATE TRIGGER habit_logs_xp_sync
AFTER INSERT OR UPDATE OR DELETE ON habit_logs
FOR EACH ROW EXECUTE FUNCTION trg_recompute_xp();

-- Attach to xp_events
DROP TRIGGER IF EXISTS xp_events_xp_sync ON xp_events;
CREATE TRIGGER xp_events_xp_sync
AFTER INSERT OR UPDATE OR DELETE ON xp_events
FOR EACH ROW EXECUTE FUNCTION trg_recompute_xp();

-- When a habit is deleted, nuke its xp_events first so they don't linger.
-- (habit_logs cascade via FK; xp_events.reference_id has no FK.)
CREATE OR REPLACE FUNCTION trg_cleanup_habit_xp_events()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM xp_events WHERE reference_id = OLD.id;
  PERFORM recompute_user_xp(OLD.user_id);
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS habits_cleanup_xp_events ON habits;
CREATE TRIGGER habits_cleanup_xp_events
BEFORE DELETE ON habits
FOR EACH ROW EXECUTE FUNCTION trg_cleanup_habit_xp_events();

-- ============================================
-- Backfill all existing profiles
-- ============================================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM profiles LOOP
    PERFORM recompute_user_xp(r.id);
  END LOOP;
END $$;
