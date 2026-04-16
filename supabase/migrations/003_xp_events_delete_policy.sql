-- Allow users to delete their own XP events (needed for cleanup of orphaned events)
CREATE POLICY "Users can delete own XP events" ON xp_events FOR DELETE USING (user_id = auth.uid());
