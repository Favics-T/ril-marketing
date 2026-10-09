-- Publish history (§6.9, §13): every publish attempt on a Content Asset is a
-- Publication row, shown on the asset page. Rows now carry the live URL and
-- who triggered the attempt.

ALTER TABLE publications
  ADD COLUMN IF NOT EXISTS url text,
  ADD COLUMN IF NOT EXISTS actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS publications_asset_created_idx
  ON publications(content_asset_id, created_at DESC);

-- WordPress and Strapi publishes used to be recorded only in asset metadata.
-- Backfill one Publication per linked CMS post so older assets show history.
INSERT INTO publications (organization_id, content_asset_id, channel, external_id, url, status, published_at, created_at)
SELECT ca.organization_id, ca.id, 'wordpress', ca.metadata->>'wordpress_post_id', ca.metadata->>'wordpress_url', 'published',
  COALESCE((ca.metadata->>'wordpress_published_at')::timestamptz, ca.published_at, ca.created_at),
  COALESCE((ca.metadata->>'wordpress_published_at')::timestamptz, ca.published_at, ca.created_at)
FROM content_assets ca
WHERE ca.metadata ? 'wordpress_url'
  AND NOT EXISTS (SELECT 1 FROM publications p WHERE p.content_asset_id = ca.id AND p.channel = 'wordpress');

INSERT INTO publications (organization_id, content_asset_id, channel, external_id, url, status, published_at, created_at)
SELECT ca.organization_id, ca.id, 'strapi', ca.metadata->>'strapi_entry_id', ca.metadata->>'strapi_url', 'published',
  COALESCE((ca.metadata->>'strapi_published_at')::timestamptz, ca.published_at, ca.created_at),
  COALESCE((ca.metadata->>'strapi_published_at')::timestamptz, ca.published_at, ca.created_at)
FROM content_assets ca
WHERE ca.metadata ? 'strapi_url'
  AND NOT EXISTS (SELECT 1 FROM publications p WHERE p.content_asset_id = ca.id AND p.channel = 'strapi');
