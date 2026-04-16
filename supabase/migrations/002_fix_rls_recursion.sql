-- Fix infinite recursion in circle_members RLS policies
-- The SELECT policy on circle_members was querying circle_members itself

-- Drop the recursive policies
DROP POLICY IF EXISTS "Members can view circle members" ON circle_members;
DROP POLICY IF EXISTS "Admins can manage members" ON circle_members;

-- Recreate circle_members SELECT policy without self-reference
-- A user can see rows in circle_members if they themselves are a member of that circle
CREATE POLICY "Members can view circle members" ON circle_members FOR SELECT USING (
  circle_id IN (SELECT cm.circle_id FROM circle_members cm WHERE cm.user_id = auth.uid())
);
-- NOTE: The above still self-references. The correct fix for Postgres is to use a
-- security definer function that bypasses RLS.

-- Actually, the simplest Supabase-compatible fix: replace the self-referencing
-- policy with a direct user_id check combined with a security definer helper.

-- Drop again to redo properly
DROP POLICY IF EXISTS "Members can view circle members" ON circle_members;

-- Create a security definer function to check circle membership without triggering RLS
CREATE OR REPLACE FUNCTION public.is_circle_member(p_circle_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM circle_members WHERE circle_id = p_circle_id AND user_id = p_user_id
  );
$$;

-- Now recreate all policies that were self-referencing circle_members
-- using the security definer function instead

-- circle_members: SELECT
CREATE POLICY "Members can view circle members" ON circle_members FOR SELECT USING (
  public.is_circle_member(circle_id, auth.uid())
);

-- circle_members: DELETE (admins)
DROP POLICY IF EXISTS "Admins can manage members" ON circle_members;
CREATE POLICY "Admins can manage members" ON circle_members FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM circle_members cm
    WHERE cm.circle_id = circle_members.circle_id
      AND cm.user_id = auth.uid()
      AND cm.role = 'admin'
  )
);
-- The delete policy also self-references, fix it too:
DROP POLICY IF EXISTS "Admins can manage members" ON circle_members;

CREATE OR REPLACE FUNCTION public.is_circle_admin(p_circle_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM circle_members WHERE circle_id = p_circle_id AND user_id = p_user_id AND role = 'admin'
  );
$$;

CREATE POLICY "Admins can manage members" ON circle_members FOR DELETE USING (
  public.is_circle_admin(circle_id, auth.uid())
);

-- Also fix other policies that reference circle_members and could chain into recursion:

-- circles: SELECT
DROP POLICY IF EXISTS "Members can view their circles" ON circles;
CREATE POLICY "Members can view their circles" ON circles FOR SELECT USING (
  public.is_circle_member(id, auth.uid())
);

-- circles: UPDATE
DROP POLICY IF EXISTS "Admins can update circles" ON circles;
CREATE POLICY "Admins can update circles" ON circles FOR UPDATE USING (
  public.is_circle_admin(id, auth.uid())
);

-- circle_habits: SELECT
DROP POLICY IF EXISTS "Circle members can view circle habits" ON circle_habits;
CREATE POLICY "Circle members can view circle habits" ON circle_habits FOR SELECT USING (
  public.is_circle_member(circle_id, auth.uid())
);

-- circle_habits: INSERT
DROP POLICY IF EXISTS "Circle members can create circle habits" ON circle_habits;
CREATE POLICY "Circle members can create circle habits" ON circle_habits FOR INSERT WITH CHECK (
  public.is_circle_member(circle_id, auth.uid())
);

-- circle_feed: SELECT
DROP POLICY IF EXISTS "Circle members can view feed" ON circle_feed;
CREATE POLICY "Circle members can view feed" ON circle_feed FOR SELECT USING (
  public.is_circle_member(circle_id, auth.uid())
);

-- circle_feed: INSERT
DROP POLICY IF EXISTS "Circle members can post to feed" ON circle_feed;
CREATE POLICY "Circle members can post to feed" ON circle_feed FOR INSERT WITH CHECK (
  public.is_circle_member(circle_id, auth.uid())
);

-- habits: the "Circle members can view shared habits" policy chains through circle_members
DROP POLICY IF EXISTS "Circle members can view shared habits" ON habits;
CREATE POLICY "Circle members can view shared habits" ON habits FOR SELECT USING (
  circle_id IS NOT NULL AND public.is_circle_member(circle_id, auth.uid())
);

-- habit_logs: the circle policy chains through habits -> circle_members
DROP POLICY IF EXISTS "Circle members can view shared logs" ON habit_logs;
CREATE POLICY "Circle members can view shared logs" ON habit_logs FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM habits h
    WHERE h.id = habit_logs.habit_id
      AND h.circle_id IS NOT NULL
      AND public.is_circle_member(h.circle_id, auth.uid())
  )
);

-- user_badges: the circle member badges policy self-references circle_members
DROP POLICY IF EXISTS "Users can view circle member badges" ON user_badges;
CREATE POLICY "Users can view circle member badges" ON user_badges FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM circle_members cm
    WHERE cm.user_id = user_badges.user_id
      AND public.is_circle_member(cm.circle_id, auth.uid())
  )
);

-- circle_habit_members: chains through circle_habits -> circle_members
DROP POLICY IF EXISTS "Circle members can view" ON circle_habit_members;
CREATE POLICY "Circle members can view" ON circle_habit_members FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM circle_habits ch
    WHERE ch.id = circle_habit_members.circle_habit_id
      AND public.is_circle_member(ch.circle_id, auth.uid())
  )
);
