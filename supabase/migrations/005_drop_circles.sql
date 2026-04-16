-- ============================================
-- Remove all circles functionality from the database.
-- Drops tables, related badges, and the circle_id column on habits.
-- ============================================

-- Drop policies that reference circle_id (must happen before the column drop)
DROP POLICY IF EXISTS "Circle members can view shared habits" ON habits;
DROP POLICY IF EXISTS "Circle members can view shared logs"   ON habit_logs;

-- Drop circle tables (order matters for FKs)
DROP TABLE IF EXISTS circle_feed         CASCADE;
DROP TABLE IF EXISTS circle_habit_members CASCADE;
DROP TABLE IF EXISTS circle_habits        CASCADE;
DROP TABLE IF EXISTS circle_members       CASCADE;
DROP TABLE IF EXISTS circles              CASCADE;

-- Remove the circle_id column from habits if it exists
ALTER TABLE habits DROP COLUMN IF EXISTS circle_id;

-- Remove circle-related badges from the catalog
DELETE FROM badges WHERE id IN ('first_circle', 'circle_creator');
