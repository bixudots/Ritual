-- ============================================
-- THE RITUAL - Full Database Schema
-- ============================================

-- ============================================
-- PROFILES
-- ============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  push_token TEXT,
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_profiles_username ON profiles(username);

-- ============================================
-- HABITS (all binary: done/not done)
-- ============================================
CREATE TYPE schedule_type AS ENUM ('specific_days', 'days_per_week', 'every_day');
CREATE TYPE proof_type AS ENUM ('none', 'photo', 'location', 'photo_or_location');

CREATE TABLE habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🎯',
  color TEXT DEFAULT '#ffb77d',
  xp_value INTEGER NOT NULL DEFAULT 10 CHECK (xp_value IN (5, 10, 15, 20)),

  -- Schedule
  schedule_type schedule_type NOT NULL DEFAULT 'every_day',
  schedule_days INTEGER[] DEFAULT '{}',          -- for specific_days: {0,1,2,3,4,5,6} (Sun=0)
  schedule_times_per_week INTEGER DEFAULT 0,     -- for days_per_week mode

  -- Proof
  proof_required proof_type DEFAULT 'none',
  proof_location_lat DOUBLE PRECISION,
  proof_location_lng DOUBLE PRECISION,
  proof_location_radius INTEGER DEFAULT 100,     -- meters

  -- Streaks
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,

  -- Metadata
  sort_order INTEGER DEFAULT 0,
  is_archived BOOLEAN DEFAULT false,
  circle_id UUID,                                -- if shared with a circle

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_habits_user_id ON habits(user_id);
CREATE INDEX idx_habits_circle_id ON habits(circle_id);

-- ============================================
-- HABIT LOGS (one per habit per scheduled day)
-- ============================================
CREATE TABLE habit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  logged_date DATE NOT NULL,
  completed BOOLEAN DEFAULT false,

  -- XP tracking per log
  xp_awarded INTEGER DEFAULT 0,
  xp_penalty INTEGER DEFAULT 0,
  xp_recovered INTEGER DEFAULT 0,

  -- Proof
  proof_photo_url TEXT,
  proof_location_lat DOUBLE PRECISION,
  proof_location_lng DOUBLE PRECISION,
  proof_verified BOOLEAN DEFAULT false,

  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(habit_id, logged_date)
);

CREATE INDEX idx_habit_logs_user_date ON habit_logs(user_id, logged_date);
CREATE INDEX idx_habit_logs_habit_date ON habit_logs(habit_id, logged_date);

-- ============================================
-- XP EVENTS (ledger of all XP changes)
-- ============================================
CREATE TABLE xp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('earned', 'penalty', 'recovered', 'streak_bonus', 'badge_reward')),
  xp_amount INTEGER NOT NULL,                    -- positive for gains, negative for losses
  reference_id UUID,                             -- habit_id, badge_id, etc.
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_xp_events_user ON xp_events(user_id, created_at DESC);

-- ============================================
-- BADGES
-- ============================================
CREATE TABLE badges (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('streak', 'consistency', 'proof', 'social', 'milestone')),
  xp_reward INTEGER DEFAULT 0
);

CREATE TABLE user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL REFERENCES badges(id),
  earned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

CREATE INDEX idx_user_badges_user ON user_badges(user_id);

-- ============================================
-- CIRCLES (invite-only groups)
-- ============================================
CREATE TABLE circles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  invite_code TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(6), 'hex'),
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  xp_multiplier NUMERIC(3,1) DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_circles_invite ON circles(invite_code);

CREATE TABLE circle_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(circle_id, user_id)
);

CREATE INDEX idx_circle_members_circle ON circle_members(circle_id);
CREATE INDEX idx_circle_members_user ON circle_members(user_id);

-- ============================================
-- CIRCLE HABITS (shared/mutual habits)
-- ============================================
CREATE TABLE circle_habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🎯',
  xp_value INTEGER NOT NULL DEFAULT 10 CHECK (xp_value IN (5, 10, 15, 20)),
  schedule_type schedule_type NOT NULL DEFAULT 'every_day',
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_circle_habits_circle ON circle_habits(circle_id);

CREATE TABLE circle_habit_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_habit_id UUID NOT NULL REFERENCES circle_habits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_days INTEGER[] DEFAULT '{}',
  UNIQUE(circle_habit_id, user_id)
);

-- ============================================
-- CIRCLE FEED (activity events within a circle)
-- ============================================
CREATE TABLE circle_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('habit_completed', 'streak_milestone', 'level_up', 'joined')),
  habit_name TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_circle_feed ON circle_feed(circle_id, created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view all profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (id = auth.uid());

-- Habits
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own habits" ON habits FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Circle members can view shared habits" ON habits FOR SELECT USING (
  circle_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM circle_members cm
    WHERE cm.circle_id = habits.circle_id AND cm.user_id = auth.uid()
  )
);

-- Habit Logs
ALTER TABLE habit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own logs" ON habit_logs FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Circle members can view shared logs" ON habit_logs FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM habits h
    JOIN circle_members cm ON cm.circle_id = h.circle_id
    WHERE h.id = habit_logs.habit_id AND cm.user_id = auth.uid()
  )
);

-- XP Events
ALTER TABLE xp_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own XP events" ON xp_events FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own XP events" ON xp_events FOR INSERT WITH CHECK (user_id = auth.uid());

-- Badges
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can view badges" ON badges FOR SELECT USING (true);

-- User Badges
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own badges" ON user_badges FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can view circle member badges" ON user_badges FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM circle_members cm1
    JOIN circle_members cm2 ON cm1.circle_id = cm2.circle_id
    WHERE cm1.user_id = auth.uid() AND cm2.user_id = user_badges.user_id
  )
);

-- Circles
ALTER TABLE circles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view their circles" ON circles FOR SELECT USING (
  EXISTS (SELECT 1 FROM circle_members cm WHERE cm.circle_id = circles.id AND cm.user_id = auth.uid())
);
CREATE POLICY "Anyone can view circles by invite code" ON circles FOR SELECT USING (true);
CREATE POLICY "Users can create circles" ON circles FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY "Admins can update circles" ON circles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM circle_members cm WHERE cm.circle_id = circles.id AND cm.user_id = auth.uid() AND cm.role = 'admin')
);

-- Circle Members
ALTER TABLE circle_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view circle members" ON circle_members FOR SELECT USING (
  EXISTS (SELECT 1 FROM circle_members cm WHERE cm.circle_id = circle_members.circle_id AND cm.user_id = auth.uid())
);
CREATE POLICY "Users can join circles" ON circle_members FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can manage members" ON circle_members FOR DELETE USING (
  EXISTS (SELECT 1 FROM circle_members cm WHERE cm.circle_id = circle_members.circle_id AND cm.user_id = auth.uid() AND cm.role = 'admin')
);

-- Circle Habits
ALTER TABLE circle_habits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Circle members can view circle habits" ON circle_habits FOR SELECT USING (
  EXISTS (SELECT 1 FROM circle_members cm WHERE cm.circle_id = circle_habits.circle_id AND cm.user_id = auth.uid())
);
CREATE POLICY "Circle members can create circle habits" ON circle_habits FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM circle_members cm WHERE cm.circle_id = circle_habits.circle_id AND cm.user_id = auth.uid())
);

-- Circle Habit Members
ALTER TABLE circle_habit_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Circle members can view" ON circle_habit_members FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM circle_habits ch
    JOIN circle_members cm ON cm.circle_id = ch.circle_id
    WHERE ch.id = circle_habit_members.circle_habit_id AND cm.user_id = auth.uid()
  )
);
CREATE POLICY "Users can manage own participation" ON circle_habit_members FOR ALL USING (user_id = auth.uid());

-- Circle Feed
ALTER TABLE circle_feed ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Circle members can view feed" ON circle_feed FOR SELECT USING (
  EXISTS (SELECT 1 FROM circle_members cm WHERE cm.circle_id = circle_feed.circle_id AND cm.user_id = auth.uid())
);
CREATE POLICY "Circle members can post to feed" ON circle_feed FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM circle_members cm WHERE cm.circle_id = circle_feed.circle_id AND cm.user_id = auth.uid())
);

-- ============================================
-- STORAGE BUCKET for proof photos
-- ============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('proof-photos', 'proof-photos', false);

CREATE POLICY "Users can upload own proofs" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'proof-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view own proofs" ON storage.objects FOR SELECT
  USING (bucket_id = 'proof-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================
-- SEED BADGE DEFINITIONS
-- ============================================
INSERT INTO badges (id, name, description, icon, category, xp_reward) VALUES
  ('streak_3', 'Getting Started', '3-day streak', 'local_fire_department', 'streak', 25),
  ('streak_7', 'One Week Strong', '7-day streak', 'local_fire_department', 'streak', 50),
  ('streak_14', 'Fortnight Focus', '14-day streak', 'local_fire_department', 'streak', 100),
  ('streak_30', 'Monthly Master', '30-day streak', 'workspace_premium', 'streak', 200),
  ('streak_100', 'Centurion', '100-day streak', 'military_tech', 'streak', 500),
  ('streak_365', 'Year of Ritual', '365-day streak', 'diamond', 'streak', 2000),
  ('first_habit', 'First Step', 'Complete your first habit', 'check_circle', 'consistency', 10),
  ('five_habits', 'Habit Builder', 'Create 5 habits', 'construction', 'consistency', 30),
  ('perfect_week', 'Perfect Week', '100% completion for 7 days', 'star', 'consistency', 100),
  ('perfect_month', 'Perfect Month', '100% completion for 30 days', 'auto_awesome', 'consistency', 500),
  ('first_photo', 'Pic or It Didn''t Happen', 'Submit first photo proof', 'photo_camera', 'proof', 15),
  ('first_checkin', 'On Location', 'First location check-in', 'location_on', 'proof', 15),
  ('first_circle', 'Circle Starter', 'Join your first circle', 'group_work', 'social', 20),
  ('circle_creator', 'Ring Leader', 'Create a circle', 'hub', 'social', 30),
  ('total_100', 'Century', '100 total completions', 'emoji_events', 'milestone', 100),
  ('total_500', 'Half Grand', '500 total completions', 'emoji_events', 'milestone', 300),
  ('total_1000', 'Grand Master', '1000 total completions', 'emoji_events', 'milestone', 1000),
  ('level_5', 'Apprentice', 'Reach level 5', 'bolt', 'milestone', 50),
  ('level_10', 'Adept', 'Reach level 10', 'bolt', 'milestone', 100),
  ('xp_1000', 'XP Hunter', 'Earn 1000 total XP', 'paid', 'milestone', 50);

-- ============================================
-- FUNCTION: Auto-create profile on signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)),
    COALESCE(new.raw_user_meta_data->>'display_name', 'Ritualist')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- FUNCTION: Update updated_at timestamp
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER habits_updated_at BEFORE UPDATE ON habits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER habit_logs_updated_at BEFORE UPDATE ON habit_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
