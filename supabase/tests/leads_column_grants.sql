-- Leads lockdown: prove a workspace member can edit only the CRM fields of a
-- lead, can't touch consent or create/delete leads directly, and can still
-- add a lead from the community inbox in their own workspace only.
--
-- Checks a database where 20261103000000_leads_column_grants.sql is already
-- applied.
--
-- Run the whole file in the Supabase SQL editor (as postgres), or with
-- psql -v ON_ERROR_STOP=1 -f. Everything happens inside one transaction that
-- ends in ROLLBACK, so nothing is kept.
-- Pass: the run finishes without an error (the last result reads
-- "Leads column-grant checks passed"). Fail: it stops at an error starting
-- "FAIL"; COMMIT is never reached, so nothing is saved.
-- Run before the migration, it stops at FAIL 1.
--
-- Fixtures (ids share the prefix 1ead5000-0000-4000-8000-0000000000):
--   ...0a member  'member' in workspace A
--   ...a0 workspace A    ...a1 lead in A (opted in)    ...ac community item in A
--   ...b0 workspace B    ...b1 lead in B               ...bc community item in B

BEGIN;

-- ============ MIGRATION STATE (as postgres) ============
DO $$ BEGIN
  IF has_table_privilege('authenticated', 'public.leads', 'INSERT')
     OR has_table_privilege('authenticated', 'public.leads', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.leads', 'DELETE')
     OR has_table_privilege('authenticated', 'public.leads', 'TRUNCATE') THEN
    RAISE EXCEPTION 'FAIL 1: authenticated still has table-level write privileges on leads; apply 20261103000000_leads_column_grants.sql';
  END IF;
  IF has_table_privilege('anon', 'public.leads', 'INSERT, UPDATE, DELETE, TRUNCATE')
     OR has_any_column_privilege('anon', 'public.leads', 'INSERT, UPDATE') THEN
    RAISE EXCEPTION 'FAIL 2: anon can write to leads';
  END IF;
  IF NOT (has_column_privilege('authenticated', 'public.leads', 'funnel_stage', 'UPDATE')
      AND has_column_privilege('authenticated', 'public.leads', 'is_converted', 'UPDATE')
      AND has_column_privilege('authenticated', 'public.leads', 'is_qualified', 'UPDATE')
      AND has_column_privilege('authenticated', 'public.leads', 'score', 'UPDATE')
      AND has_column_privilege('authenticated', 'public.leads', 'score_reason', 'UPDATE')
      AND has_column_privilege('authenticated', 'public.leads', 'notes', 'UPDATE')
      AND has_column_privilege('authenticated', 'public.leads', 'owner_id', 'UPDATE')) THEN
    RAISE EXCEPTION 'FAIL 3: authenticated is missing UPDATE on a CRM column';
  END IF;
  IF has_column_privilege('authenticated', 'public.leads', 'marketing_consent', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.leads', 'email_unsubscribed_at', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.leads', 'email_suppressed_at', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.leads', 'email', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.leads', 'organization_id', 'UPDATE') THEN
    RAISE EXCEPTION 'FAIL 4: authenticated can update a consent, contact or workspace column on leads';
  END IF;
  IF NOT has_table_privilege('authenticated', 'public.leads', 'SELECT') THEN
    RAISE EXCEPTION 'FAIL 5: authenticated lost SELECT on leads';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'leads' AND policyname = 'leads_isolation') THEN
    RAISE EXCEPTION 'FAIL 6: policy leads_isolation is missing';
  END IF;
  IF NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.community_item_create_lead(uuid)'::regprocedure) THEN
    RAISE EXCEPTION 'FAIL 7: community_item_create_lead() is not SECURITY DEFINER';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = 'public.community_item_create_lead(uuid)'::regprocedure
      AND proconfig @> ARRAY['search_path=public']) THEN
    RAISE EXCEPTION 'FAIL 8: community_item_create_lead() does not pin search_path';
  END IF;
  IF has_function_privilege('anon', 'public.community_item_create_lead(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.community_item_create_lead(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL 9: community_item_create_lead() should be callable by authenticated only';
  END IF;
END $$;

-- ============ FIXTURES (as postgres) ============
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('1ead5000-0000-4000-8000-00000000000a', 'leads-member@example.test', 'authenticated', 'authenticated');
INSERT INTO organizations (id, name) VALUES
  ('1ead5000-0000-4000-8000-0000000000a0', 'Leads test workspace A'),
  ('1ead5000-0000-4000-8000-0000000000b0', 'Leads test workspace B');
INSERT INTO organization_members (organization_id, user_id, role) VALUES
  ('1ead5000-0000-4000-8000-0000000000a0', '1ead5000-0000-4000-8000-00000000000a', 'member');
INSERT INTO leads (id, organization_id, email, marketing_consent, marketing_consent_at) VALUES
  ('1ead5000-0000-4000-8000-0000000000a1', '1ead5000-0000-4000-8000-0000000000a0', 'lead-a@example.test', true, now()),
  ('1ead5000-0000-4000-8000-0000000000b1', '1ead5000-0000-4000-8000-0000000000b0', 'lead-b@example.test', true, now());
INSERT INTO community_items (id, organization_id, platform, author_label, body, category) VALUES
  ('1ead5000-0000-4000-8000-0000000000ac', '1ead5000-0000-4000-8000-0000000000a0', 'linkedin', 'Ada', 'Interested in the next cohort.', 'lead'),
  ('1ead5000-0000-4000-8000-0000000000bc', '1ead5000-0000-4000-8000-0000000000b0', 'linkedin', 'Bola', 'Interested too.', 'lead');

-- ============ ACT AS THE MEMBER ============
SELECT set_config('request.jwt.claims', '{"sub":"1ead5000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
SELECT set_config('request.jwt.claim.sub', '1ead5000-0000-4000-8000-00000000000a', true);
SET LOCAL ROLE authenticated;

DO $$ BEGIN
  IF auth.uid() IS DISTINCT FROM '1ead5000-0000-4000-8000-00000000000a'::uuid THEN
    RAISE EXCEPTION 'SETUP: auth.uid() is %, expected the member; the JWT claims were not picked up', auth.uid();
  END IF;
END $$;

-- ============ CRM EDITS THAT MUST WORK ============
DO $$ BEGIN
  UPDATE leads SET funnel_stage = 'engagement', notes = 'Called on Monday.'
    WHERE id = '1ead5000-0000-4000-8000-0000000000a1';
  IF NOT EXISTS (SELECT 1 FROM leads WHERE id = '1ead5000-0000-4000-8000-0000000000a1'
      AND funnel_stage = 'engagement' AND notes = 'Called on Monday.') THEN
    RAISE EXCEPTION 'FAIL 10: the member could not update funnel_stage and notes';
  END IF;
  UPDATE leads SET is_qualified = true, is_converted = true, score = 'hot', score_reason = 'Converted.',
      owner_id = '1ead5000-0000-4000-8000-00000000000a'
    WHERE id = '1ead5000-0000-4000-8000-0000000000a1';
  IF NOT EXISTS (SELECT 1 FROM leads WHERE id = '1ead5000-0000-4000-8000-0000000000a1'
      AND is_qualified AND is_converted AND score = 'hot' AND owner_id = '1ead5000-0000-4000-8000-00000000000a') THEN
    RAISE EXCEPTION 'FAIL 11: the member could not update the other CRM columns';
  END IF;
  -- Granted columns are still limited to the member's own workspace; RLS
  -- matches no rows here, and FAIL 12 below checks that as postgres.
  UPDATE leads SET notes = 'Not yours.' WHERE id = '1ead5000-0000-4000-8000-0000000000b1';
END $$;

-- ============ WRITES THAT MUST BE REFUSED ============
-- Each block expects permission denied (SQLSTATE 42501). Any other outcome
-- raises a FAIL that is not caught.
DO $$ BEGIN
  UPDATE leads SET marketing_consent = true WHERE id = '1ead5000-0000-4000-8000-0000000000a1';
  RAISE EXCEPTION 'FAIL 13: the member could update marketing_consent';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;

DO $$ BEGIN
  UPDATE leads SET email_unsubscribed_at = NULL WHERE id = '1ead5000-0000-4000-8000-0000000000a1';
  RAISE EXCEPTION 'FAIL 14: the member could update email_unsubscribed_at';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;

DO $$ BEGIN
  UPDATE leads SET email_suppressed_at = NULL WHERE id = '1ead5000-0000-4000-8000-0000000000a1';
  RAISE EXCEPTION 'FAIL 15: the member could update email_suppressed_at';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;

DO $$ BEGIN
  -- A granted column alongside a refused one: the whole statement fails.
  UPDATE leads SET notes = 'Sneaky', marketing_consent = true WHERE id = '1ead5000-0000-4000-8000-0000000000a1';
  RAISE EXCEPTION 'FAIL 16: the member could update marketing_consent alongside a granted column';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;

DO $$ BEGIN
  INSERT INTO leads (organization_id, email, marketing_consent)
    VALUES ('1ead5000-0000-4000-8000-0000000000a0', 'direct@example.test', true);
  RAISE EXCEPTION 'FAIL 17: the member could insert a lead directly';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;

DO $$ BEGIN
  DELETE FROM leads WHERE id = '1ead5000-0000-4000-8000-0000000000a1';
  RAISE EXCEPTION 'FAIL 18: the member could delete a lead';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;

-- ============ COMMUNITY INBOX → LEAD ============
DO $$
DECLARE new_lead uuid; again uuid;
BEGIN
  new_lead := community_item_create_lead('1ead5000-0000-4000-8000-0000000000ac');
  IF new_lead IS NULL OR NOT EXISTS (SELECT 1 FROM leads WHERE id = new_lead
      AND organization_id = '1ead5000-0000-4000-8000-0000000000a0'
      AND name = 'Ada' AND funnel_stage = 'captured' AND NOT marketing_consent) THEN
    RAISE EXCEPTION 'FAIL 19: community_item_create_lead() did not create an unconsented lead in workspace A';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM community_items WHERE id = '1ead5000-0000-4000-8000-0000000000ac' AND lead_id = new_lead) THEN
    RAISE EXCEPTION 'FAIL 20: the community item was not linked to its new lead';
  END IF;
  again := community_item_create_lead('1ead5000-0000-4000-8000-0000000000ac');
  IF again IS DISTINCT FROM new_lead THEN
    RAISE EXCEPTION 'FAIL 21: a second call created another lead instead of returning the first';
  END IF;
END $$;

DO $$ BEGIN
  PERFORM community_item_create_lead('1ead5000-0000-4000-8000-0000000000bc');
  RAISE EXCEPTION 'FAIL 22: the member created a lead from another workspace''s community item';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM <> 'Community item not found' THEN RAISE; END IF;
END $$;

-- ============ STATE AFTER THE ATTEMPTS (as postgres) ============
RESET ROLE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM leads WHERE id = '1ead5000-0000-4000-8000-0000000000b1' AND notes IS NOT NULL) THEN
    RAISE EXCEPTION 'FAIL 12: the member updated a lead in another workspace';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM leads WHERE id = '1ead5000-0000-4000-8000-0000000000a1'
      AND marketing_consent AND email_unsubscribed_at IS NULL AND email_suppressed_at IS NULL AND notes = 'Called on Monday.') THEN
    RAISE EXCEPTION 'FAIL 23: lead A changed in a way the refused writes should have prevented';
  END IF;
  IF EXISTS (SELECT 1 FROM leads WHERE organization_id = '1ead5000-0000-4000-8000-0000000000b0' AND id <> '1ead5000-0000-4000-8000-0000000000b1')
     OR EXISTS (SELECT 1 FROM community_items WHERE id = '1ead5000-0000-4000-8000-0000000000bc' AND lead_id IS NOT NULL) THEN
    RAISE EXCEPTION 'FAIL 24: workspace B gained a lead from the member''s calls';
  END IF;
END $$;

SELECT 'Leads column-grant checks passed' AS result;

ROLLBACK;
