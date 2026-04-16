-- ============================================
-- Habit tracking: optional numeric value per log
-- (e.g. "pushups: 50", "sleep: 7 hours")
-- ============================================

ALTER TABLE habits
  ADD COLUMN IF NOT EXISTS tracking_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tracking_unit TEXT,
  ADD COLUMN IF NOT EXISTS tracking_goal NUMERIC;

ALTER TABLE habit_logs
  ADD COLUMN IF NOT EXISTS tracking_value NUMERIC;
