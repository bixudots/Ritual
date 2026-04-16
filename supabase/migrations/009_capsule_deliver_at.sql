-- Optional exact delivery time for a capsule.
-- When set, readiness is evaluated against this timestamp (not the date).
ALTER TABLE time_capsules
  ADD COLUMN IF NOT EXISTS deliver_at TIMESTAMPTZ;
