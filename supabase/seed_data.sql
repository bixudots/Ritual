-- ============================================
-- THE RITUAL - 3 Weeks of Sample Data
-- ============================================
-- INSTRUCTIONS:
-- 1. Replace YOUR_USER_ID below with your actual auth.users UUID
-- 2. Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ============================================

-- Set your user ID here (run: SELECT id FROM auth.users LIMIT 1;)
DO $$
DECLARE
  uid UUID := '9b089b7c-6eb4-4461-bc08-64a2b8d10572';

  -- Habit UUIDs (deterministic so we can reference them)
  h_wake    UUID := gen_random_uuid();
  h_walk    UUID := gen_random_uuid();
  h_read    UUID := gen_random_uuid();
  h_weigh   UUID := gen_random_uuid();
  h_night   UUID := gen_random_uuid();
  h_cold    UUID := gen_random_uuid();
  h_workout UUID := gen_random_uuid();
  h_ball    UUID := gen_random_uuid();

BEGIN

-- ============================================
-- INSERT HABITS
-- ============================================
INSERT INTO habits (id, user_id, name, icon, color, xp_value, schedule_type, schedule_days, schedule_times_per_week, proof_required, current_streak, longest_streak, sort_order) VALUES
  (h_wake,    uid, 'Wake up at 5am',    '⏰', '#ff8c00', 15, 'specific_days', '{1,2,3,4,5}', 0, 'none', 9, 14, 0),
  (h_walk,    uid, 'Walk 10k steps',    '🚶', '#4ae183', 10, 'every_day',     '{}',          0, 'none', 5, 18, 1),
  (h_read,    uid, 'Read 20 mins',      '📖', '#ebb2ff', 10, 'every_day',     '{}',          0, 'none', 7, 21, 2),
  (h_weigh,   uid, 'Weigh in',          '⚖️', '#60a5fa',  5, 'specific_days', '{1}',         0, 'none', 3,  3, 3),
  (h_night,   uid, 'Night routine',     '🌙', '#818cf8', 10, 'every_day',     '{}',          0, 'none', 12, 12, 4),
  (h_cold,    uid, 'Cold shower',       '🥶', '#38bdf8', 15, 'every_day',     '{}',          0, 'none', 3, 11, 5),
  (h_workout, uid, 'Workout',           '💪', '#f87171', 20, 'specific_days', '{1,2,3,5,6}', 0, 'none', 4, 15, 6),
  (h_ball,    uid, 'Play basketball',   '🏀', '#fb923c', 15, 'days_per_week', '{}',          1, 'none', 2,  4, 7);

-- ============================================
-- INSERT HABIT LOGS (3 weeks: Apr 12 back to Mar 23)
-- ============================================
-- Legend: each row is one log entry
-- Pattern designed to feel realistic:
--   Wake up at 5am (M-F): strong but missed Wed Apr 2 and Thu Mar 27
--   Walk 10k steps (daily): mostly done, skip some weekends
--   Read 20 mins (daily): very consistent, current 7-day streak
--   Weigh in (Mon only): hit all 3 Mondays
--   Night routine (daily): beast mode, 12-day streak ongoing
--   Cold shower (daily): hardest habit, spotty first week, building up
--   Workout (M,T,W,F,S): solid but missed a couple
--   Basketball (1x/week): played each week

INSERT INTO habit_logs (habit_id, user_id, logged_date, completed, xp_awarded, xp_penalty, xp_recovered) VALUES

-- ===================== WEEK 3 (most recent): Apr 7 - Apr 12 =====================

-- Mon Apr 7
(h_wake,    uid, '2026-04-07', true,  15, 0, 0),
(h_walk,    uid, '2026-04-07', true,  10, 0, 0),
(h_read,    uid, '2026-04-07', true,  10, 0, 0),
(h_weigh,   uid, '2026-04-07', true,   5, 0, 0),
(h_night,   uid, '2026-04-07', true,  10, 0, 0),
(h_cold,    uid, '2026-04-07', true,  15, 0, 0),
(h_workout, uid, '2026-04-07', true,  20, 0, 0),

-- Tue Apr 8
(h_wake,    uid, '2026-04-08', true,  15, 0, 0),
(h_walk,    uid, '2026-04-08', true,  10, 0, 0),
(h_read,    uid, '2026-04-08', true,  10, 0, 0),
(h_night,   uid, '2026-04-08', true,  10, 0, 0),
(h_cold,    uid, '2026-04-08', true,  15, 0, 0),
(h_workout, uid, '2026-04-08', true,  20, 0, 0),

-- Wed Apr 9
(h_wake,    uid, '2026-04-09', true,  15, 0, 0),
(h_walk,    uid, '2026-04-09', true,  10, 0, 0),
(h_read,    uid, '2026-04-09', true,  10, 0, 0),
(h_night,   uid, '2026-04-09', true,  10, 0, 0),
(h_cold,    uid, '2026-04-09', false,  0, 15, 0),  -- missed cold shower
(h_workout, uid, '2026-04-09', true,  20, 0, 0),

-- Thu Apr 10
(h_wake,    uid, '2026-04-10', true,  15, 0, 0),
(h_walk,    uid, '2026-04-10', true,  10, 0, 0),
(h_read,    uid, '2026-04-10', true,  10, 0, 0),
(h_night,   uid, '2026-04-10', true,  10, 0, 0),
(h_cold,    uid, '2026-04-10', true,  15, 0, 15),  -- recovered yesterday's penalty
(h_ball,    uid, '2026-04-10', true,  15, 0, 0),   -- basketball this week

-- Fri Apr 11
(h_wake,    uid, '2026-04-11', true,  15, 0, 0),
(h_walk,    uid, '2026-04-11', true,  10, 0, 0),
(h_read,    uid, '2026-04-11', true,  10, 0, 0),
(h_night,   uid, '2026-04-11', true,  10, 0, 0),
(h_cold,    uid, '2026-04-11', true,  15, 0, 0),
(h_workout, uid, '2026-04-11', true,  20, 0, 0),

-- Sat Apr 12 (today — partial, morning habits done)
(h_walk,    uid, '2026-04-12', false,  0, 0, 0),  -- not yet
(h_read,    uid, '2026-04-12', false,  0, 0, 0),  -- not yet
(h_night,   uid, '2026-04-12', false,  0, 0, 0),  -- tonight
(h_cold,    uid, '2026-04-12', true,  15, 0, 0),  -- morning cold shower done
(h_workout, uid, '2026-04-12', true,  20, 0, 0),  -- morning workout done


-- ===================== WEEK 2: Mar 31 - Apr 6 =====================

-- Mon Mar 31
(h_wake,    uid, '2026-03-31', true,  15, 0, 0),
(h_walk,    uid, '2026-03-31', true,  10, 0, 0),
(h_read,    uid, '2026-03-31', true,  10, 0, 0),
(h_weigh,   uid, '2026-03-31', true,   5, 0, 0),
(h_night,   uid, '2026-03-31', true,  10, 0, 0),
(h_cold,    uid, '2026-03-31', true,  15, 0, 0),
(h_workout, uid, '2026-03-31', true,  20, 0, 0),

-- Tue Apr 1
(h_wake,    uid, '2026-04-01', true,  15, 0, 0),
(h_walk,    uid, '2026-04-01', true,  10, 0, 0),
(h_read,    uid, '2026-04-01', true,  10, 0, 0),
(h_night,   uid, '2026-04-01', true,  10, 0, 0),
(h_cold,    uid, '2026-04-01', false,  0, 15, 0),  -- missed
(h_workout, uid, '2026-04-01', true,  20, 0, 0),

-- Wed Apr 2
(h_wake,    uid, '2026-04-02', false,  0, 15, 0),  -- overslept
(h_walk,    uid, '2026-04-02', true,  10, 0, 0),
(h_read,    uid, '2026-04-02', false,  0, 10, 0),  -- missed reading too
(h_night,   uid, '2026-04-02', true,  10, 0, 0),
(h_cold,    uid, '2026-04-02', false,  0, 15, 0),  -- missed again — penalty permanent
(h_workout, uid, '2026-04-02', true,  20, 0, 0),

-- Thu Apr 3
(h_wake,    uid, '2026-04-03', true,  15, 0, 15),  -- recovered yesterday's wake penalty
(h_walk,    uid, '2026-04-03', true,  10, 0, 0),
(h_read,    uid, '2026-04-03', true,  10, 0, 10),  -- recovered reading penalty
(h_night,   uid, '2026-04-03', true,  10, 0, 0),
(h_cold,    uid, '2026-04-03', true,  15, 0, 0),   -- back on cold showers but 2-miss penalty stays
(h_ball,    uid, '2026-04-03', true,  15, 0, 0),

-- Fri Apr 4
(h_wake,    uid, '2026-04-04', true,  15, 0, 0),
(h_walk,    uid, '2026-04-04', true,  10, 0, 0),
(h_read,    uid, '2026-04-04', true,  10, 0, 0),
(h_night,   uid, '2026-04-04', true,  10, 0, 0),
(h_cold,    uid, '2026-04-04', true,  15, 0, 0),
(h_workout, uid, '2026-04-04', true,  20, 0, 0),

-- Sat Apr 5
(h_walk,    uid, '2026-04-05', false,  0, 10, 0),  -- lazy saturday
(h_read,    uid, '2026-04-05', true,  10, 0, 0),
(h_night,   uid, '2026-04-05', true,  10, 0, 0),
(h_cold,    uid, '2026-04-05', false,  0, 15, 0),  -- skipped
(h_workout, uid, '2026-04-05', true,  20, 0, 0),

-- Sun Apr 6
(h_walk,    uid, '2026-04-06', true,  10, 0, 10),  -- recovered saturday walk penalty
(h_read,    uid, '2026-04-06', true,  10, 0, 0),
(h_night,   uid, '2026-04-06', true,  10, 0, 0),
(h_cold,    uid, '2026-04-06', true,  15, 0, 15),  -- recovered saturday cold penalty


-- ===================== WEEK 1 (oldest): Mar 23 - Mar 30 =====================

-- Mon Mar 23
(h_wake,    uid, '2026-03-23', true,  15, 0, 0),
(h_walk,    uid, '2026-03-23', true,  10, 0, 0),
(h_read,    uid, '2026-03-23', true,  10, 0, 0),
(h_weigh,   uid, '2026-03-23', true,   5, 0, 0),
(h_night,   uid, '2026-03-23', false,  0, 10, 0),  -- missed night routine
(h_cold,    uid, '2026-03-23', false,  0, 15, 0),  -- missed
(h_workout, uid, '2026-03-23', true,  20, 0, 0),

-- Tue Mar 24
(h_wake,    uid, '2026-03-24', true,  15, 0, 0),
(h_walk,    uid, '2026-03-24', true,  10, 0, 0),
(h_read,    uid, '2026-03-24', true,  10, 0, 0),
(h_night,   uid, '2026-03-24', true,  10, 0, 10),  -- recovered night penalty
(h_cold,    uid, '2026-03-24', false,  0, 15, 0),   -- missed again — permanent penalty
(h_workout, uid, '2026-03-24', true,  20, 0, 0),

-- Wed Mar 25
(h_wake,    uid, '2026-03-25', true,  15, 0, 0),
(h_walk,    uid, '2026-03-25', false,  0, 10, 0),  -- missed
(h_read,    uid, '2026-03-25', true,  10, 0, 0),
(h_night,   uid, '2026-03-25', true,  10, 0, 0),
(h_cold,    uid, '2026-03-25', true,  15, 0, 0),
(h_workout, uid, '2026-03-25', false,  0, 20, 0),  -- skipped gym

-- Thu Mar 26
(h_wake,    uid, '2026-03-26', true,  15, 0, 0),
(h_walk,    uid, '2026-03-26', true,  10, 0, 10),  -- recovered walk penalty
(h_read,    uid, '2026-03-26', true,  10, 0, 0),
(h_night,   uid, '2026-03-26', true,  10, 0, 0),
(h_cold,    uid, '2026-03-26', true,  15, 0, 0),
(h_ball,    uid, '2026-03-26', true,  15, 0, 0),

-- Fri Mar 27
(h_wake,    uid, '2026-03-27', false,  0, 15, 0),  -- overslept friday
(h_walk,    uid, '2026-03-27', true,  10, 0, 0),
(h_read,    uid, '2026-03-27', true,  10, 0, 0),
(h_night,   uid, '2026-03-27', true,  10, 0, 0),
(h_cold,    uid, '2026-03-27', false,  0, 15, 0),
(h_workout, uid, '2026-03-27', true,  20, 0, 0),

-- Sat Mar 28
(h_walk,    uid, '2026-03-28', true,  10, 0, 0),
(h_read,    uid, '2026-03-28', false,  0, 10, 0),  -- skipped reading
(h_night,   uid, '2026-03-28', true,  10, 0, 0),
(h_cold,    uid, '2026-03-28', true,  15, 0, 15),  -- recovered friday cold penalty
(h_workout, uid, '2026-03-28', true,  20, 0, 0),

-- Sun Mar 29
(h_walk,    uid, '2026-03-29', false,  0, 10, 0),  -- rest day
(h_read,    uid, '2026-03-29', true,  10, 0, 10),  -- recovered sat reading penalty
(h_night,   uid, '2026-03-29', true,  10, 0, 0),
(h_cold,    uid, '2026-03-29', false,  0, 15, 0),

-- Mon Mar 30
(h_wake,    uid, '2026-03-30', true,  15, 0, 15),  -- recovered fri wake penalty
(h_walk,    uid, '2026-03-30', true,  10, 0, 0),
(h_read,    uid, '2026-03-30', true,  10, 0, 0),
(h_night,   uid, '2026-03-30', true,  10, 0, 0),
(h_cold,    uid, '2026-03-30', true,  15, 0, 15),  -- recovered sun cold penalty
(h_workout, uid, '2026-03-30', true,  20, 0, 0);


-- ============================================
-- XP EVENTS (ledger entries matching the logs)
-- ============================================
-- Totals from above:
--   Earned:    ~1080 XP
--   Penalties: ~270 XP
--   Recovered: ~140 XP
--   Net:       ~950 XP

INSERT INTO xp_events (user_id, event_type, xp_amount, reference_id, description) VALUES
  (uid, 'earned',       85, h_wake,    'Daily completions - Wake up at 5am'),
  (uid, 'earned',      170, h_walk,    'Daily completions - Walk 10k steps'),
  (uid, 'earned',      180, h_read,    'Daily completions - Read 20 mins'),
  (uid, 'earned',       15, h_weigh,   'Weekly completions - Weigh in'),
  (uid, 'earned',      180, h_night,   'Daily completions - Night routine'),
  (uid, 'earned',      180, h_cold,    'Daily completions - Cold shower'),
  (uid, 'earned',      300, h_workout, 'Daily completions - Workout'),
  (uid, 'earned',       45, h_ball,    'Weekly completions - Play basketball'),
  (uid, 'penalty',    -30,  h_wake,    'Missed days penalty - Wake up at 5am'),
  (uid, 'penalty',    -40,  h_walk,    'Missed days penalty - Walk 10k steps'),
  (uid, 'penalty',    -20,  h_read,    'Missed days penalty - Read 20 mins'),
  (uid, 'penalty',    -10,  h_night,   'Missed days penalty - Night routine'),
  (uid, 'penalty',   -120,  h_cold,    'Missed days penalty - Cold shower'),
  (uid, 'penalty',    -20,  h_workout, 'Missed days penalty - Workout'),
  (uid, 'recovered',   15,  h_wake,    'Recovery XP - Wake up at 5am'),
  (uid, 'recovered',   30,  h_walk,    'Recovery XP - Walk 10k steps'),
  (uid, 'recovered',   20,  h_read,    'Recovery XP - Read 20 mins'),
  (uid, 'recovered',   10,  h_night,   'Recovery XP - Night routine'),
  (uid, 'recovered',   45,  h_cold,    'Recovery XP - Cold shower'),
  (uid, 'streak_bonus', 25, NULL,      '7-day streak bonus (Week 2)'),
  (uid, 'streak_bonus', 25, NULL,      '7-day streak bonus (Night routine)');

-- ============================================
-- UPDATE PROFILE XP TOTAL
-- ============================================
UPDATE profiles
SET
  xp = 950,
  level = 5,
  current_streak = 3,
  longest_streak = 6
WHERE id = uid;

END $$;
