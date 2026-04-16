-- Add reminder_time column to habits (HH:mm string, nullable)
ALTER TABLE habits
  ADD COLUMN IF NOT EXISTS reminder_time TEXT;

COMMENT ON COLUMN habits.reminder_time IS 'Optional daily reminder in HH:mm (24h) format. NULL = no reminder.';
