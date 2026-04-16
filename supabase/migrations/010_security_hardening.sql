-- ════════════════════════════════════════════════════════════════════════════
-- Migration 010 — Security hardening
-- ────────────────────────────────────────────────────────────────────────────
-- Addresses RLS audit findings before App Store submission:
--   • profiles SELECT was world-readable (leaked XP, streaks, push tokens)
--   • capsule-photos storage bucket was public + unscoped
--   • habits / habit_logs / profiles updates missing WITH CHECK (cross-user writes)
--   • user_badges had no INSERT policy (client-side awards were broken)
--   • orphaned circle_* helper functions + policies from dropped feature
--   • SECURITY DEFINER functions without explicit search_path
--   • proof-photos missing DELETE policy
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. profiles: lock SELECT to self only ────────────────────────────────────
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

-- profiles: add WITH CHECK to UPDATE so users cannot re-assign their own id.
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ── 2. habits: split FOR ALL into explicit policies with WITH CHECK ──────────
DROP POLICY IF EXISTS "Users can manage own habits" ON habits;
CREATE POLICY "Users can view own habits"
  ON habits FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own habits"
  ON habits FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own habits"
  ON habits FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own habits"
  ON habits FOR DELETE USING (user_id = auth.uid());

-- ── 3. habit_logs: same treatment ────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can manage own logs" ON habit_logs;
CREATE POLICY "Users can view own habit logs"
  ON habit_logs FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own habit logs"
  ON habit_logs FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own habit logs"
  ON habit_logs FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own habit logs"
  ON habit_logs FOR DELETE USING (user_id = auth.uid());

-- ── 4. user_badges: allow self-inserts (needed for client-side badge awards) ─
DROP POLICY IF EXISTS "Users can insert own badges" ON user_badges;
CREATE POLICY "Users can insert own badges"
  ON user_badges FOR INSERT WITH CHECK (user_id = auth.uid());

-- ── 5. Drop orphaned circle_* policy + helper functions (dropped in 005) ─────
DROP POLICY IF EXISTS "Users can view circle member badges" ON user_badges;
DROP FUNCTION IF EXISTS public.is_circle_member(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_circle_admin(uuid, uuid);

-- ── 6. capsule-photos bucket: make private + scope reads to owner folder ─────
UPDATE storage.buckets
   SET public = false
 WHERE id = 'capsule-photos';

DROP POLICY IF EXISTS "Users can view capsule photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload capsule photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete capsule photos" ON storage.objects;

CREATE POLICY "Users can view own capsule photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'capsule-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can upload own capsule photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'capsule-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own capsule photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'capsule-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ── 7. proof-photos bucket: add missing DELETE policy ────────────────────────
DROP POLICY IF EXISTS "Users can delete own proof photos" ON storage.objects;
CREATE POLICY "Users can delete own proof photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'proof-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ── 8. Harden SECURITY DEFINER functions with explicit search_path ───────────
-- Prevents search_path hijacking via a malicious schema shadowing public tables.
ALTER FUNCTION public.recompute_user_xp(uuid) SET search_path = public;
ALTER FUNCTION public.trg_recompute_xp() SET search_path = public;
ALTER FUNCTION public.trg_cleanup_habit_xp_events() SET search_path = public;
ALTER FUNCTION public.reset_my_data() SET search_path = public;
ALTER FUNCTION public.delete_my_account() SET search_path = public;
