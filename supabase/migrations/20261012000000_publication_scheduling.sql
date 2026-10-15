-- Scheduled WordPress publishing (§6.9, §13): a Publication can now be a
-- future-dated WordPress post. WordPress (WP-Cron) does the actual publishing;
-- a sync job reads the post back and moves the row along:
--   queued    – attempt recorded, not yet sent
--   scheduled – WordPress holds it as "future" at scheduled_for
--   published – live on the site
--   missed    – scheduled_for passed but WordPress still reports "future"
--   failed    – the attempt errored
--   cancelled – unscheduled from the workspace (post set back to draft)

ALTER TABLE publications DROP CONSTRAINT IF EXISTS publications_status_valid;
ALTER TABLE publications ADD CONSTRAINT publications_status_valid
  CHECK (status IN ('queued', 'scheduled', 'published', 'missed', 'failed', 'cancelled'));

-- remote_status: the post status WordPress last reported (future, publish, draft, trash...).
ALTER TABLE publications
  ADD COLUMN IF NOT EXISTS remote_status text,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Existing rows were last touched when they were created. Runs before the
-- trigger exists so it isn't overwritten with now().
UPDATE publications SET updated_at = created_at WHERE updated_at <> created_at;

DROP TRIGGER IF EXISTS publications_updated_at ON publications;
CREATE TRIGGER publications_updated_at BEFORE UPDATE ON publications
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- One active WordPress record per asset. A retry after a failed status update
-- could already have recorded a second "published" row, so refuse to build the
-- index over duplicates instead of failing with a bare unique violation.
DO $$
DECLARE
  duplicate_assets int;
  sample text;
BEGIN
  WITH dupes AS (
    SELECT content_asset_id
    FROM publications
    WHERE channel = 'wordpress' AND status IN ('scheduled', 'missed', 'published')
    GROUP BY content_asset_id
    HAVING count(*) > 1
  )
  SELECT (SELECT count(*) FROM dupes),
         (SELECT string_agg(content_asset_id::text, ', ') FROM (SELECT content_asset_id FROM dupes ORDER BY 1 LIMIT 20) s)
    INTO duplicate_assets, sample;

  IF duplicate_assets > 0 THEN
    RAISE EXCEPTION 'publications has % content asset(s) with more than one active WordPress record (scheduled/missed/published). Resolve them before applying this migration. Asset ids (up to 20): %', duplicate_assets, sample
      USING HINT = 'Keep the newest row per asset and change the others to status ''failed'' with an error note, or delete them; then re-run.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS publications_wordpress_active_uniq
  ON publications(content_asset_id)
  WHERE channel = 'wordpress' AND status IN ('scheduled', 'missed', 'published');

-- The sync job's scan: WordPress rows still waiting on the site, soonest first.
CREATE INDEX IF NOT EXISTS publications_wordpress_sync_idx
  ON publications(scheduled_for)
  WHERE channel = 'wordpress' AND status IN ('scheduled', 'missed');
