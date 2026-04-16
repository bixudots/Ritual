-- ============================================
-- Account management RPC functions
--   reset_my_data()      — wipe habits/logs/xp but keep the account
--   delete_my_account()  — permanently delete the user and all data
-- Both run as SECURITY DEFINER so they can touch auth.users and
-- bypass RLS for the authenticated user's own rows.
-- ============================================

-- Wipe all habit/log/xp data for the current user.
-- profiles row is kept but xp/streaks are reset by the habit_logs
-- and xp_events triggers (or we reset explicitly below).
CREATE OR REPLACE FUNCTION reset_my_data()
RETURNS VOID AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- habits: BEFORE DELETE trigger cleans xp_events and recomputes profiles.xp
  -- habit_logs cascade via FK on habits
  DELETE FROM habits     WHERE user_id = uid;

  -- Anything left (e.g. xp_events without a habit ref) — nuke it
  DELETE FROM xp_events  WHERE user_id = uid;
  DELETE FROM habit_logs WHERE user_id = uid;

  -- Explicit reset so streaks / level also clear
  UPDATE profiles
     SET xp = 0,
         level = 1,
         current_streak = 0,
         longest_streak = 0
   WHERE id = uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION reset_my_data() TO authenticated;

-- Permanently delete the current user's account.
-- Deleting auth.users cascades into profiles (FK ON DELETE CASCADE),
-- which cascades into habits, habit_logs, xp_events, etc.
CREATE OR REPLACE FUNCTION delete_my_account()
RETURNS VOID AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM auth.users WHERE id = uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION delete_my_account() TO authenticated;
