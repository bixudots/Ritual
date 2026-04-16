-- ============================================
-- Time Capsules
-- Messages to your future self, locked until a delivery date.
-- ============================================

CREATE TABLE IF NOT EXISTS time_capsules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  photo_urls  TEXT[],
  deliver_on  DATE NOT NULL,
  opened_at   TIMESTAMPTZ,
  saved       BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS time_capsules_user_id_idx ON time_capsules(user_id);
CREATE INDEX IF NOT EXISTS time_capsules_deliver_on_idx ON time_capsules(deliver_on);

ALTER TABLE time_capsules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own capsules"
  ON time_capsules FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own capsules"
  ON time_capsules FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own capsules"
  ON time_capsules FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own capsules"
  ON time_capsules FOR DELETE
  USING (user_id = auth.uid());

-- Storage bucket for capsule photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('capsule-photos', 'capsule-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload own capsule photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'capsule-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can view capsule photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'capsule-photos');

CREATE POLICY "Users can delete own capsule photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'capsule-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
