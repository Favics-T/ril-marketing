-- activities.updated_at: the activity page shows when a record was last
-- changed, but the table only had created_at.
-- Existing rows start at created_at rather than now(), so old activities don't
-- all look edited on the day this ran. The trigger is created after the
-- backfill so the backfill itself doesn't stamp now(). Safe to re-run.
ALTER TABLE activities ADD COLUMN IF NOT EXISTS updated_at timestamptz;
UPDATE activities SET updated_at = created_at WHERE updated_at IS NULL;
ALTER TABLE activities
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;

DROP TRIGGER IF EXISTS activities_updated_at ON activities;
CREATE TRIGGER activities_updated_at BEFORE UPDATE ON activities
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
