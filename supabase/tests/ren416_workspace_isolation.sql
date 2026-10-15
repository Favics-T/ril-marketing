-- REN-416: prove a user in workspace A can't read or join workspace B.
--
-- Run the whole file in the Supabase SQL editor (as postgres) on staging,
-- after applying 20261015000000_workspace_access_fix.sql. Everything happens
-- inside one transaction that ends in ROLLBACK, so no test data is kept.
-- Success: the last statement prints "REN-416 isolation checks passed".
-- Failure: the run stops with an error starting "FAIL"; nothing is saved.
-- Running it before the migration should fail at FAIL 1, which shows the
-- test detects the original bug.

BEGIN;

-- ============ FIXTURES (as postgres) ============
-- User A owns workspace A, user B owns workspace B. B has a lead and a page.
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('41600000-0000-4000-8000-00000000000a', 'ren416-a@example.test', 'authenticated', 'authenticated'),
  ('41600000-0000-4000-8000-00000000000b', 'ren416-b@example.test', 'authenticated', 'authenticated');
INSERT INTO organizations (id, name) VALUES
  ('41600000-0000-4000-8000-0000000000a0', 'REN-416 test workspace A'),
  ('41600000-0000-4000-8000-0000000000b0', 'REN-416 test workspace B');
INSERT INTO organization_members (organization_id, user_id, role) VALUES
  ('41600000-0000-4000-8000-0000000000a0', '41600000-0000-4000-8000-00000000000a', 'owner'),
  ('41600000-0000-4000-8000-0000000000b0', '41600000-0000-4000-8000-00000000000b', 'owner');
-- handle_new_user() created both profiles; point B at its workspace.
UPDATE profiles SET organization_id = '41600000-0000-4000-8000-0000000000b0'
  WHERE id = '41600000-0000-4000-8000-00000000000b';
INSERT INTO leads (organization_id, email) VALUES
  ('41600000-0000-4000-8000-0000000000b0', 'ren416-b-lead@example.test');
INSERT INTO landing_pages (organization_id, slug, title, headline) VALUES
  ('41600000-0000-4000-8000-0000000000b0', 'ren416-b-page', 'REN-416 B page', 'Workspace B headline');

-- The original attack, already done: A's profile points at workspace B.
-- The fix must ignore this pointer entirely.
UPDATE profiles SET organization_id = '41600000-0000-4000-8000-0000000000b0'
  WHERE id = '41600000-0000-4000-8000-00000000000a';

-- ============ ACT AS USER A ============
SELECT set_config('request.jwt.claims', '{"sub":"41600000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
SELECT set_config('request.jwt.claim.sub', '41600000-0000-4000-8000-00000000000a', true);
SET LOCAL ROLE authenticated;

-- ============ READS ============
DO $$
DECLARE
  org_a uuid := '41600000-0000-4000-8000-0000000000a0';
  org_b uuid := '41600000-0000-4000-8000-0000000000b0';
  user_a uuid := '41600000-0000-4000-8000-00000000000a';
  n int;
BEGIN
  IF auth.uid() IS DISTINCT FROM user_a THEN
    RAISE EXCEPTION 'SETUP: auth.uid() is %, expected user A; the JWT claims were not picked up', auth.uid();
  END IF;
  IF ARRAY(SELECT x FROM caller_organization_ids() x) <> ARRAY[org_a] THEN
    RAISE EXCEPTION 'FAIL 1: caller_organization_ids() returned %, expected only workspace A', ARRAY(SELECT x FROM caller_organization_ids() x);
  END IF;
  SELECT count(*) INTO n FROM organizations WHERE id = org_b;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL 2: user A can read workspace B'; END IF;
  SELECT count(*) INTO n FROM leads WHERE organization_id = org_b;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL 3: user A can read workspace B leads'; END IF;
  SELECT count(*) INTO n FROM landing_pages WHERE organization_id = org_b;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL 4: user A can read workspace B landing pages'; END IF;
  SELECT count(*) INTO n FROM organization_members WHERE organization_id = org_b;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL 5: user A can read workspace B memberships'; END IF;
  -- A still sees their own workspace and profile.
  SELECT count(*) INTO n FROM organizations WHERE id = org_a;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL 6: user A can no longer read workspace A'; END IF;
  SELECT count(*) INTO n FROM profiles WHERE id = user_a;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL 7: user A can no longer read their own profile'; END IF;
END $$;

-- ============ WRITES THAT MUST BE REFUSED ============
-- Each block expects permission denied (SQLSTATE 42501, which also covers
-- RLS violations). Any other outcome raises a FAIL that is not caught.
DO $$ BEGIN
  UPDATE profiles SET organization_id = '41600000-0000-4000-8000-0000000000a0'
    WHERE id = '41600000-0000-4000-8000-00000000000a';
  RAISE EXCEPTION 'FAIL 8: user A could update their profile';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;

DO $$ BEGIN
  DELETE FROM profiles WHERE id = '41600000-0000-4000-8000-00000000000a';
  RAISE EXCEPTION 'FAIL 9: user A could delete their profile';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;

DO $$ BEGIN
  INSERT INTO profiles (id, organization_id)
    VALUES ('41600000-0000-4000-8000-00000000000a', '41600000-0000-4000-8000-0000000000b0');
  RAISE EXCEPTION 'FAIL 10: user A could insert a profile';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;

DO $$ BEGIN
  TRUNCATE profiles;
  RAISE EXCEPTION 'FAIL 11: user A could truncate profiles';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;

DO $$ BEGIN
  INSERT INTO organization_members (organization_id, user_id, role)
    VALUES ('41600000-0000-4000-8000-0000000000b0', '41600000-0000-4000-8000-00000000000a', 'owner');
  RAISE EXCEPTION 'FAIL 12: user A could add themselves to workspace B as owner';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;

DO $$ BEGIN
  INSERT INTO organization_members (organization_id, user_id, role)
    VALUES ('41600000-0000-4000-8000-0000000000b0', '41600000-0000-4000-8000-00000000000a', 'member');
  RAISE EXCEPTION 'FAIL 13: user A could add themselves to workspace B as member';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;

-- ============ STILL ISOLATED AFTER THE ATTEMPTS ============
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM leads WHERE organization_id = '41600000-0000-4000-8000-0000000000b0';
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL 14: user A can read workspace B leads after the write attempts'; END IF;
END $$;

-- ============ ONBOARDING STILL WORKS ============
DO $$
DECLARE new_org uuid; n int;
BEGIN
  new_org := create_organization_with_owner('REN-416 test workspace C');
  IF NOT EXISTS (SELECT 1 FROM caller_organization_ids() x WHERE x = new_org) THEN
    RAISE EXCEPTION 'FAIL 15: create_organization_with_owner() did not make user A a member';
  END IF;
  SELECT count(*) INTO n FROM profiles
    WHERE id = '41600000-0000-4000-8000-00000000000a' AND organization_id = new_org;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL 16: create_organization_with_owner() did not update the profile'; END IF;
END $$;

RESET ROLE;
SELECT 'REN-416 isolation checks passed' AS result;

ROLLBACK;
