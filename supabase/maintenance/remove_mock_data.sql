-- Run manually in the Supabase SQL editor as the database owner.
-- Only IDs/configuration fingerprints from the retired demo/dev seeds qualify.
-- Organizations, accounts, memberships, real credentials and settings stay intact.
-- Preview first: keep the final ROLLBACK. To apply, change it to COMMIT.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Keep the preflight and deletion consistent while the application is open.
DO $$ DECLARE item record; BEGIN
  FOR item IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p') ORDER BY c.relname
  LOOP EXECUTE format('LOCK TABLE public.%I IN SHARE ROW EXCLUSIVE MODE',item.relname); END LOOP;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.retired_seed_id(tag text) RETURNS uuid
LANGUAGE sql IMMUTABLE AS $$
  SELECT (substr(h,1,8)||'-'||substr(h,9,4)||'-4'||substr(h,14,3)||'-8'||substr(h,18,3)||'-'||substr(h,21,12))::uuid
  FROM (SELECT md5(tag) h) s;
$$;

CREATE TEMP TABLE cleanup_organizations (id uuid PRIMARY KEY) ON COMMIT DROP;
INSERT INTO cleanup_organizations VALUES
  ('5bb06ed8-c911-49af-9bc9-3709664ca147'),
  ('fb75265e-4de7-4293-b405-94b408875aea'),
  ('00000000-0000-4000-8000-000000000001');
CREATE TEMP TABLE cleanup_candidates (table_name text, id uuid, organization_id uuid, PRIMARY KEY(table_name,id)) ON COMMIT DROP;
CREATE TEMP TABLE cleanup_targets (table_name text, id uuid, PRIMARY KEY(table_name,id)) ON COMMIT DROP;
CREATE TEMP TABLE cleanup_counts (table_name text PRIMARY KEY, removed bigint NOT NULL) ON COMMIT DROP;
CREATE TEMP TABLE cleanup_preserved (table_name text, id uuid, reason text, PRIMARY KEY(table_name,id)) ON COMMIT DROP;

INSERT INTO cleanup_candidates
SELECT table_name, pg_temp.retired_seed_id(prefix||':'||label||':'||o.id), o.id
FROM (VALUES
  ('audience_segments','seg',ARRAY['founders','students','sme','tech']),
  ('programs','prog',ARRAY['bootcamp','accel','sme']),
  ('campaigns','camp',ARRAY['bootcamp','fundraising','campus']),
  ('activities','act',ARRAY['bootcamp','masterclass','webinar','challenge','partnership','ailab']),
  ('ai_generations','gen',ARRAY['bootcamp','partnership']),
  ('content_assets','asset',ARRAY['blog','newsletter','li','ig','x','yt','short','high','seo']),
  ('asset_approvals','approval',ARRAY['blog:gen','blog:edit','blog:rev','blog:appr','blog:pub','blog:pub2','high:appr']),
  ('publications','pub',ARRAY['blog','li','yt','fail']),
  ('registration_links','reg',ARRAY['blog','li','news','ig']),
  ('audience_insight_generation_runs','run',ARRAY['insights']),
  ('audience_insights','ins',ARRAY['topic','format','platform','hook','pending1','pending2','suppressed']),
  ('insight_approvals','insappr',ARRAY['topic','format','platform','hook','suppressed']),
  ('kpis','kpi',ARRAY['leads','attrib','conv','traffic','organic','social','email']),
  ('tasks','task',ARRAY['ins1','ins2','pub','fail','done']),
  ('landing_pages','lp',ARRAY['bootcamp','webinar']),
  ('leads','lead',ARRAY['hot','unsub']||(SELECT array_agg(g::text) FROM generate_series(1,20) g)),
  ('lead_follow_ups','fu',ARRAY['1','2','3','4']),
  ('trends','trend',ARRAY['1','2','3','4','5','6']),
  ('brand_knowledge','bk',ARRAY['voice','org','prog1','prog2','aud1','msg','term','pol']),
  ('email_campaigns','mail',ARRAY['recap','invite','draft']),
  ('email_campaign_deliveries','deliv',(SELECT array_agg(g::text) FROM generate_series(1,10) g)),
  ('email_provider_events','evt',ARRAY['1','2','3']),
  ('community_items','cm',ARRAY['1','2','3','4','5','6','7']),
  ('marketing_reports','report',ARRAY['monthly','weekly']),
  ('automation_events','auto',ARRAY['1','2','3','4'])
) AS seed(table_name,prefix,labels)
CROSS JOIN cleanup_organizations o CROSS JOIN LATERAL unnest(labels) label
WHERE o.id <> '00000000-0000-4000-8000-000000000001';

-- The development seed used fixed segment/campaign IDs and random record IDs.
INSERT INTO cleanup_candidates VALUES
  ('audience_segments','00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000001'),
  ('audience_segments','00000000-0000-4000-8000-000000000012','00000000-0000-4000-8000-000000000001'),
  ('audience_segments','00000000-0000-4000-8000-000000000013','00000000-0000-4000-8000-000000000001'),
  ('audience_segments','00000000-0000-4000-8000-000000000014','00000000-0000-4000-8000-000000000001'),
  ('campaigns','00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000001'),
  ('campaigns','00000000-0000-4000-8000-000000000022','00000000-0000-4000-8000-000000000001');

DO $$
DECLARE item record;
BEGIN
  FOR item IN SELECT DISTINCT table_name FROM cleanup_candidates LOOP
    IF to_regclass(format('public.%I',item.table_name)) IS NOT NULL THEN
      EXECUTE format('INSERT INTO cleanup_targets SELECT %L,t.id FROM public.%I t JOIN cleanup_candidates c ON c.table_name=%L AND c.id=t.id AND c.organization_id=t.organization_id ON CONFLICT DO NOTHING',item.table_name,item.table_name,item.table_name);
    END IF;
  END LOOP;
  FOR item IN SELECT * FROM (VALUES
    ('content_assets', $p$title ~ '^(How we raised pre-seed|General update) ([1-9]|10)$'$p$),
    ('leads', $p$email ~ '^(hq([1-9]|10)|junk([1-9]|[1-3][0-9]|40))@example\.com$'$p$),
    ('programs', $p$(name,slug) IN (('Founder Accelerator','founder-accelerator'),('Student Builders','student-builders'),('SME Growth Lab','sme-growth-lab'))$p$),
    ('activities', $p$title IN ('Founder stories batch','SME webinar series') AND source_type='manual'$p$),
    ('analytics_events', $p$metadata->>'seeded'='true'$p$)
  ) AS dev(table_name,condition) LOOP
    IF to_regclass(format('public.%I',item.table_name)) IS NOT NULL THEN
      EXECUTE format('INSERT INTO cleanup_targets SELECT %L,id FROM public.%I WHERE organization_id=''00000000-0000-4000-8000-000000000001'' AND (%s) ON CONFLICT DO NOTHING',item.table_name,item.table_name,item.condition);
    END IF;
  END LOOP;
  IF to_regclass('public.integrations') IS NOT NULL THEN
    INSERT INTO cleanup_targets SELECT 'integrations',id FROM public.integrations
    WHERE organization_id IN (SELECT id FROM cleanup_organizations)
      AND ((key='buffer' AND config->>'accessToken'='demo-buffer-access-token')
        OR (key='cms_wordpress' AND config->>'applicationPassword'='demo-not-a-real-password')
        OR (key='google_analytics' AND config->>'credentials'='{}' AND config->>'searchConsoleSiteUrl'='https://renaissance-labs.example/')
        OR (key='email_resend' AND config->>'apiKey'='re_demo_not_a_real_key'))
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- A generated draft whose source is a demo activity is also synthetic. Insights
-- containing demo evidence must be regenerated after cleanup, including mixed runs.
DO $$
DECLARE added integer; changed integer;
BEGIN
  LOOP
    changed := 0;
    IF to_regclass('public.content_assets') IS NOT NULL THEN
      INSERT INTO cleanup_targets
      SELECT 'content_assets',a.id FROM content_assets a
      JOIN cleanup_targets t ON (t.table_name='activities' AND t.id=a.source_activity_id)
        OR (t.table_name='ai_generations' AND t.id=a.generation_id)
      WHERE a.organization_id IN (SELECT id FROM cleanup_organizations)
      ON CONFLICT DO NOTHING;
      GET DIAGNOSTICS added=ROW_COUNT; changed:=changed+added;
    END IF;
    IF to_regclass('public.audience_insights') IS NOT NULL THEN
      INSERT INTO cleanup_targets
      SELECT 'audience_insights',i.id FROM audience_insights i
      WHERE i.organization_id IN (SELECT id FROM cleanup_organizations)
        AND EXISTS(SELECT 1 FROM cleanup_targets t WHERE
          t.table_name='content_assets' AND t.id=ANY(i.source_content_asset_ids)
          OR t.table_name='leads' AND t.id=ANY(i.source_lead_ids)
          OR t.table_name='analytics_events' AND t.id=ANY(i.source_event_ids))
      ON CONFLICT DO NOTHING;
      GET DIAGNOSTICS added=ROW_COUNT; changed:=changed+added;
    END IF;
    IF to_regclass('public.automation_events') IS NOT NULL THEN
      INSERT INTO cleanup_targets SELECT 'automation_events',e.id FROM automation_events e
      JOIN cleanup_targets t ON t.id=e.record_id AND t.table_name IN ('activities','leads')
      WHERE e.organization_id IN (SELECT id FROM cleanup_organizations)
      ON CONFLICT DO NOTHING;
      GET DIAGNOSTICS added=ROW_COUNT; changed:=changed+added;
    END IF;
    EXIT WHEN changed=0;
  END LOOP;
END $$;

-- Only dependent audit/delivery rows and junctions belong to the seed's history.
-- Records based on real sources and unrelated recurring plans are not swept up.
DO $$
DECLARE fk record; added integer; changed integer;
BEGIN
  LOOP
    changed := 0;
    FOR fk IN
      SELECT child.relname child_table, ca.attname child_column, parent.relname parent_table
      FROM pg_constraint c JOIN pg_class child ON child.oid=c.conrelid JOIN pg_namespace n ON n.oid=child.relnamespace
      JOIN pg_class parent ON parent.oid=c.confrelid JOIN pg_namespace pn ON pn.oid=parent.relnamespace
      JOIN pg_attribute ca ON ca.attrelid=c.conrelid AND ca.attnum=c.conkey[1]
      JOIN pg_attribute pa ON pa.attrelid=c.confrelid AND pa.attnum=c.confkey[1]
      WHERE c.contype='f' AND n.nspname='public' AND pn.nspname='public'
        AND cardinality(c.conkey)=1 AND pa.attname='id'
        AND child.relname IN ('asset_approvals','insight_approvals','publications','registration_links','content_signoffs','content_schedule_changes','publishing_alerts','lead_follow_ups','email_campaign_deliveries','tasks')
    LOOP
      EXECUTE format('INSERT INTO cleanup_targets SELECT %L,t.id FROM public.%I t JOIN cleanup_targets p ON p.table_name=%L AND p.id=t.%I WHERE t.organization_id IN (SELECT id FROM cleanup_organizations) ON CONFLICT DO NOTHING',fk.child_table,fk.child_table,fk.parent_table,fk.child_column);
      GET DIAGNOSTICS added = ROW_COUNT; changed := changed + added;
    END LOOP;
    EXIT WHEN changed=0;
  END LOOP;
END $$;

-- Audience groups adopted by real records are now workspace configuration.
-- Retaining them avoids changing or cascading away genuinely authored work.
DO $$
DECLARE fk record;
BEGIN
  FOR fk IN
    SELECT child.relname child_table,ca.attname child_column
    FROM pg_constraint c JOIN pg_class child ON child.oid=c.conrelid JOIN pg_namespace n ON n.oid=child.relnamespace
    JOIN pg_attribute ca ON ca.attrelid=c.conrelid AND ca.attnum=c.conkey[1]
    WHERE c.contype='f' AND n.nspname='public' AND cardinality(c.conkey)=1
      AND c.confrelid=to_regclass('public.audience_segments')
      AND child.relname IN ('activities','content_assets','leads','campaigns','audience_insights','landing_pages','email_campaigns','nurture_sequences')
  LOOP
    EXECUTE format('INSERT INTO cleanup_preserved SELECT p.table_name,p.id,%L FROM cleanup_targets p WHERE p.table_name=''audience_segments'' AND EXISTS(SELECT 1 FROM public.%I t WHERE t.%I=p.id AND NOT EXISTS(SELECT 1 FROM cleanup_targets x WHERE x.table_name=%L AND x.id=t.id)) ON CONFLICT DO NOTHING','Used by retained workspace records',fk.child_table,fk.child_column,fk.child_table);
  END LOOP;
  DELETE FROM cleanup_targets t USING cleanup_preserved p WHERE t.table_name=p.table_name AND t.id=p.id;
END $$;

-- Refuse any cascade/restrict that would remove or block unrelated records.
-- SET NULL keeps real records while detaching their retired demo association.
DO $$
DECLARE fk record; blocker boolean; exclusion text;
BEGIN
  FOR fk IN
    SELECT child.relname child_table, n.nspname child_schema, ca.attname child_column, parent.relname parent_table,
      EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=child.oid AND a.attname='id' AND NOT a.attisdropped) has_id
    FROM pg_constraint c JOIN pg_class child ON child.oid=c.conrelid JOIN pg_namespace n ON n.oid=child.relnamespace
    JOIN pg_class parent ON parent.oid=c.confrelid JOIN pg_namespace pn ON pn.oid=parent.relnamespace
    JOIN pg_attribute ca ON ca.attrelid=c.conrelid AND ca.attnum=c.conkey[1]
    JOIN pg_attribute pa ON pa.attrelid=c.confrelid AND pa.attnum=c.confkey[1]
    WHERE c.contype='f' AND pn.nspname='public' AND cardinality(c.conkey)=1 AND pa.attname='id'
      AND c.confdeltype <> 'n'
      AND NOT (n.nspname='public' AND child.relname IN ('content_asset_segments','audience_segment_programs'))
  LOOP
    exclusion := CASE WHEN fk.has_id AND fk.child_schema='public'
      THEN format('AND NOT EXISTS (SELECT 1 FROM cleanup_targets x WHERE x.table_name=%L AND x.id=t.id)',fk.child_table) ELSE '' END;
    EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I.%I t JOIN cleanup_targets p ON p.table_name=%L AND p.id=t.%I WHERE true %s)',fk.child_schema,fk.child_table,fk.parent_table,fk.child_column,exclusion) INTO blocker;
    IF blocker THEN
      RAISE EXCEPTION 'Cleanup stopped: non-demo records in %.% reference demo %. Reassign those records first; no changes were committed.',fk.child_schema,fk.child_table,fk.parent_table;
    END IF;
  END LOOP;
END $$;

INSERT INTO cleanup_counts SELECT table_name,count(*) FROM cleanup_targets GROUP BY table_name;

DO $$
DECLARE item record; remaining integer; removed_count integer; progress integer;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('content_asset_segments','content_asset_id','content_assets'),
    ('content_asset_segments','audience_segment_id','audience_segments'),
    ('audience_segment_programs','audience_segment_id','audience_segments'),
    ('audience_segment_programs','program_id','programs')
  ) AS links(table_name,column_name,parent_table) LOOP
    IF to_regclass(format('public.%I',item.table_name)) IS NOT NULL THEN
      EXECUTE format('DELETE FROM public.%I t USING cleanup_targets p WHERE p.table_name=%L AND p.id=t.%I',item.table_name,item.parent_table,item.column_name);
      GET DIAGNOSTICS removed_count=ROW_COUNT;
      INSERT INTO cleanup_counts VALUES(item.table_name,removed_count) ON CONFLICT(table_name) DO UPDATE SET removed=cleanup_counts.removed+excluded.removed;
    END IF;
  END LOOP;
  LOOP
    SELECT count(*) INTO remaining FROM cleanup_targets;
    EXIT WHEN remaining=0;
    progress := 0;
    FOR item IN SELECT DISTINCT table_name FROM cleanup_targets LOOP
      BEGIN
        EXECUTE format('DELETE FROM public.%I t USING cleanup_targets p WHERE p.table_name=%L AND p.id=t.id',item.table_name,item.table_name);
        DELETE FROM cleanup_targets WHERE table_name=item.table_name;
        progress := progress+1;
      EXCEPTION WHEN foreign_key_violation THEN
        -- A targeted child table still needs deleting; retry after that table.
        NULL;
      END;
    END LOOP;
    IF progress=0 THEN RAISE EXCEPTION 'Cleanup stopped on a foreign-key dependency; no changes were committed.'; END IF;
  END LOOP;
END $$;

SELECT table_name,removed,0::bigint retained FROM cleanup_counts WHERE removed>0
UNION ALL SELECT table_name,0,count(*) FROM cleanup_preserved GROUP BY table_name
ORDER BY table_name;
ROLLBACK;
