-- REN-414: prove the database enforces sensitive-campaign sign-off, whoever
-- writes the row. Checks a database where
-- 20261021000000_email_sensitive_signoff.sql and its follow-up
-- 20261028000000_email_signoff_content_and_unflag.sql are already applied.
--
-- Run the whole file in the Supabase SQL editor (as postgres). Everything
-- happens inside one transaction that ends in ROLLBACK, so nothing is kept.
-- Pass: the run finishes without an error (the last result reads
-- "REN-414 sign-off checks passed"). Fail: it stops at an error starting
-- "FAIL" or "SETUP"; COMMIT is never reached, so nothing is saved.
--
-- People (one workspace):            Campaigns:
--   ...01 author     marketing_manager   ...c1 the sensitive campaign under test
--   ...02 submitter  marketing_manager   ...c2 never flagged (regression)
--   ...03 approver   marketing_manager   ...c3 already sent
--   ...04 senior     owner               ...c4 flagged by its own author
--   ...05 flagger    marketing_manager   ...c5 content edited after sign-off
--   ...06 member     member              ...c6 flagged by its own submitter
--   ...07 lead       leadership          Segment ...a1

BEGIN;

-- Switch the signed-in user. NULL means no user, which is what the
-- service-role worker looks like to auth.uid().
CREATE FUNCTION pg_temp.act_as(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', CASE WHEN p_user IS NULL THEN '{}' ELSE json_build_object('sub', p_user, 'role', 'authenticated')::text END, true);
  PERFORM set_config('request.jwt.claim.sub', COALESCE(p_user::text, ''), true);
END $$;

-- ============ MIGRATION STATE (as postgres) ============
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'email_campaigns_signoff_guard' AND tgrelid = 'public.email_campaigns'::regclass) THEN
    RAISE EXCEPTION 'FAIL 1: trigger email_campaigns_signoff_guard is missing';
  END IF;
  IF to_regclass('public.workspace_settings') IS NULL OR to_regclass('public.email_campaign_signoff_events') IS NULL THEN
    RAISE EXCEPTION 'FAIL 2: workspace_settings or email_campaign_signoff_events is missing';
  END IF;
  IF has_table_privilege('authenticated', 'public.email_campaign_signoff_events', 'INSERT, UPDATE, DELETE') THEN
    RAISE EXCEPTION 'FAIL 3: authenticated can write the sign-off history';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
      AND table_name = 'email_campaign_signoff_events' AND column_name = 'reason') THEN
    RAISE EXCEPTION 'FAIL 34: email_campaign_signoff_events.reason is missing; apply 20261028000000_email_signoff_content_and_unflag.sql';
  END IF;
END $$;

-- ============ FIXTURES (as postgres) ============
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('41400000-0000-4000-8000-000000000001', 'ren414-author@example.test', 'authenticated', 'authenticated'),
  ('41400000-0000-4000-8000-000000000002', 'ren414-submitter@example.test', 'authenticated', 'authenticated'),
  ('41400000-0000-4000-8000-000000000003', 'ren414-approver@example.test', 'authenticated', 'authenticated'),
  ('41400000-0000-4000-8000-000000000004', 'ren414-senior@example.test', 'authenticated', 'authenticated'),
  ('41400000-0000-4000-8000-000000000005', 'ren414-flagger@example.test', 'authenticated', 'authenticated'),
  ('41400000-0000-4000-8000-000000000006', 'ren414-member@example.test', 'authenticated', 'authenticated'),
  ('41400000-0000-4000-8000-000000000007', 'ren414-lead@example.test', 'authenticated', 'authenticated');
INSERT INTO organizations (id, name) VALUES ('41400000-0000-4000-8000-0000000000f0', 'REN-414 test workspace');
INSERT INTO organization_members (organization_id, user_id, role) VALUES
  ('41400000-0000-4000-8000-0000000000f0', '41400000-0000-4000-8000-000000000001', 'marketing_manager'),
  ('41400000-0000-4000-8000-0000000000f0', '41400000-0000-4000-8000-000000000002', 'marketing_manager'),
  ('41400000-0000-4000-8000-0000000000f0', '41400000-0000-4000-8000-000000000003', 'marketing_manager'),
  ('41400000-0000-4000-8000-0000000000f0', '41400000-0000-4000-8000-000000000004', 'owner'),
  ('41400000-0000-4000-8000-0000000000f0', '41400000-0000-4000-8000-000000000005', 'marketing_manager'),
  ('41400000-0000-4000-8000-0000000000f0', '41400000-0000-4000-8000-000000000006', 'member'),
  ('41400000-0000-4000-8000-0000000000f0', '41400000-0000-4000-8000-000000000007', 'leadership');
INSERT INTO email_campaigns (id, organization_id, name, subject, body, status, created_by) VALUES
  ('41400000-0000-4000-8000-0000000000c1', '41400000-0000-4000-8000-0000000000f0', 'REN-414 sensitive', 'Subject', 'Body copy for the test.', 'draft', '41400000-0000-4000-8000-000000000001'),
  ('41400000-0000-4000-8000-0000000000c2', '41400000-0000-4000-8000-0000000000f0', 'REN-414 ordinary', 'Subject', 'Body copy for the test.', 'draft', '41400000-0000-4000-8000-000000000001'),
  ('41400000-0000-4000-8000-0000000000c3', '41400000-0000-4000-8000-0000000000f0', 'REN-414 sent', 'Subject', 'Body copy for the test.', 'sent', '41400000-0000-4000-8000-000000000001'),
  ('41400000-0000-4000-8000-0000000000c4', '41400000-0000-4000-8000-0000000000f0', 'REN-414 author flag', 'Subject', 'Body copy for the test.', 'draft', '41400000-0000-4000-8000-000000000001'),
  ('41400000-0000-4000-8000-0000000000c5', '41400000-0000-4000-8000-0000000000f0', 'REN-414 content', 'Subject', 'Body copy for the test.', 'draft', '41400000-0000-4000-8000-000000000001'),
  ('41400000-0000-4000-8000-0000000000c6', '41400000-0000-4000-8000-0000000000f0', 'REN-414 submitter flag', 'Subject', 'Body copy for the test.', 'draft', '41400000-0000-4000-8000-000000000001');
INSERT INTO audience_segments (id, organization_id, name)
  VALUES ('41400000-0000-4000-8000-0000000000a1', '41400000-0000-4000-8000-0000000000f0', 'REN-414 segment');

DO $$ BEGIN
  INSERT INTO email_campaigns (organization_id, name, subject, body, is_sensitive)
    VALUES ('41400000-0000-4000-8000-0000000000f0', 'Pre-flagged', 'Subject', 'Body copy for the test.', true);
  RAISE EXCEPTION 'FAIL 4: a campaign could be created already flagged sensitive';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;

-- ============ SUBMIT (as submitter): the database records the submitter ============
RESET ROLE; SELECT pg_temp.act_as('41400000-0000-4000-8000-000000000002'); SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF auth.uid() IS DISTINCT FROM '41400000-0000-4000-8000-000000000002'::uuid THEN
    RAISE EXCEPTION 'SETUP: auth.uid() is %, expected the submitter; the JWT claims were not picked up', auth.uid();
  END IF;
  -- A forged submitter is ignored.
  UPDATE email_campaigns SET status = 'review', submitted_by = '41400000-0000-4000-8000-000000000003'
    WHERE id = '41400000-0000-4000-8000-0000000000c1';
  UPDATE email_campaigns SET submitted_by = '41400000-0000-4000-8000-000000000004'
    WHERE id = '41400000-0000-4000-8000-0000000000c1';
  IF NOT EXISTS (SELECT 1 FROM email_campaigns WHERE id = '41400000-0000-4000-8000-0000000000c1'
      AND submitted_by = '41400000-0000-4000-8000-000000000002' AND submitted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'FAIL 5: submitted_by is not the signed-in submitter, or a later client value replaced it';
  END IF;
END $$;

-- ============ FLAGGING PERMISSIONS ============
-- Flagging only adds restrictions, so the submitter may flag what they submitted.
DO $$ BEGIN
  UPDATE email_campaigns SET status = 'review' WHERE id = '41400000-0000-4000-8000-0000000000c6';
  UPDATE email_campaigns SET is_sensitive = true WHERE id = '41400000-0000-4000-8000-0000000000c6';
  IF NOT EXISTS (SELECT 1 FROM email_campaigns WHERE id = '41400000-0000-4000-8000-0000000000c6'
      AND is_sensitive AND submitted_by = '41400000-0000-4000-8000-000000000002'
      AND sensitive_flagged_by = '41400000-0000-4000-8000-000000000002') THEN
    RAISE EXCEPTION 'FAIL 6: the submitter could not flag the campaign they submitted';
  END IF;
END $$;

-- ...and so may the author.
RESET ROLE; SELECT pg_temp.act_as('41400000-0000-4000-8000-000000000001'); SET LOCAL ROLE authenticated;
DO $$ BEGIN
  UPDATE email_campaigns SET is_sensitive = true WHERE id = '41400000-0000-4000-8000-0000000000c4';
  IF NOT EXISTS (SELECT 1 FROM email_campaigns WHERE id = '41400000-0000-4000-8000-0000000000c4'
      AND is_sensitive AND sensitive_flagged_by = '41400000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'FAIL 7: the author could not flag their own campaign';
  END IF;
END $$;

RESET ROLE; SELECT pg_temp.act_as('41400000-0000-4000-8000-000000000006'); SET LOCAL ROLE authenticated;
DO $$ BEGIN
  UPDATE email_campaigns SET is_sensitive = true WHERE id = '41400000-0000-4000-8000-0000000000c1';
  RAISE EXCEPTION 'FAIL 8: a member (not a flagging role) could flag the campaign';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;

RESET ROLE; SELECT pg_temp.act_as('41400000-0000-4000-8000-000000000005'); SET LOCAL ROLE authenticated;
DO $$ BEGIN
  UPDATE email_campaigns SET is_sensitive = true, sensitive_flagged_by = '41400000-0000-4000-8000-000000000006'
    WHERE id = '41400000-0000-4000-8000-0000000000c1';
  IF NOT EXISTS (SELECT 1 FROM email_campaigns WHERE id = '41400000-0000-4000-8000-0000000000c1'
      AND is_sensitive AND sensitive_flagged_by = '41400000-0000-4000-8000-000000000005' AND sensitive_flagged_at IS NOT NULL) THEN
    RAISE EXCEPTION 'FAIL 9: an allowed flagger could not flag, or the flagger was not recorded as the signed-in user';
  END IF;
END $$;

DO $$ BEGIN
  UPDATE email_campaigns SET is_sensitive = true WHERE id = '41400000-0000-4000-8000-0000000000c3';
  RAISE EXCEPTION 'FAIL 10: a sent campaign could be flagged';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;

-- ============ FIRST APPROVAL (as approver), then the gate ============
RESET ROLE; SELECT pg_temp.act_as('41400000-0000-4000-8000-000000000003'); SET LOCAL ROLE authenticated;
DO $$ BEGIN
  UPDATE email_campaigns SET status = 'approved', approved_by = '41400000-0000-4000-8000-000000000003'
    WHERE id = '41400000-0000-4000-8000-0000000000c1';
  IF NOT EXISTS (SELECT 1 FROM email_campaigns WHERE id = '41400000-0000-4000-8000-0000000000c1' AND approved_at IS NOT NULL) THEN
    RAISE EXCEPTION 'FAIL 11: the first approval has no recorded time';
  END IF;
END $$;

RESET ROLE; SELECT pg_temp.act_as('41400000-0000-4000-8000-000000000007'); SET LOCAL ROLE authenticated;
DO $$ BEGIN
  UPDATE email_campaigns SET status = 'scheduled' WHERE id = '41400000-0000-4000-8000-0000000000c1';
  RAISE EXCEPTION 'FAIL 12: a sensitive campaign could be scheduled with only its first approval';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
DO $$ BEGIN
  UPDATE email_campaigns SET delivery_authorized_at = now() WHERE id = '41400000-0000-4000-8000-0000000000c1';
  RAISE EXCEPTION 'FAIL 13: a sensitive campaign could be authorized for delivery with only its first approval';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;

-- ============ SENIOR SIGN-OFF: role and different-person rules ============
RESET ROLE; SELECT pg_temp.act_as('41400000-0000-4000-8000-000000000005'); SET LOCAL ROLE authenticated;
DO $$ BEGIN
  UPDATE email_campaigns SET sensitive_approved_by = '41400000-0000-4000-8000-000000000005' WHERE id = '41400000-0000-4000-8000-0000000000c1';
  RAISE EXCEPTION 'FAIL 14: a marketing manager gave the senior sign-off under the default roles';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
DO $$ BEGIN
  INSERT INTO workspace_settings (organization_id, sensitive_approver_roles)
    VALUES ('41400000-0000-4000-8000-0000000000f0', ARRAY['marketing_manager']);
  RAISE EXCEPTION 'FAIL 15: a marketing manager could change the workspace approval roles';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;

RESET ROLE; SELECT pg_temp.act_as('41400000-0000-4000-8000-000000000004'); SET LOCAL ROLE authenticated;
DO $$ BEGIN
  UPDATE email_campaigns SET sensitive_approved_by = '41400000-0000-4000-8000-000000000007' WHERE id = '41400000-0000-4000-8000-0000000000c1';
  RAISE EXCEPTION 'FAIL 16: a senior approver could sign off in someone else''s name';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
DO $$ BEGIN
  INSERT INTO workspace_settings (organization_id, sensitive_approver_roles) VALUES ('41400000-0000-4000-8000-0000000000f0', ARRAY[]::text[]);
  RAISE EXCEPTION 'FAIL 17: the senior approver roles could be set to an empty list';
EXCEPTION WHEN check_violation THEN NULL;
END $$;
-- The owner changes the setting: only marketing managers may sign off now.
INSERT INTO workspace_settings (organization_id, sensitive_approver_roles)
  VALUES ('41400000-0000-4000-8000-0000000000f0', ARRAY['marketing_manager']);
DO $$ BEGIN
  UPDATE email_campaigns SET sensitive_approved_by = '41400000-0000-4000-8000-000000000004' WHERE id = '41400000-0000-4000-8000-0000000000c1';
  RAISE EXCEPTION 'FAIL 18: an owner could still sign off after owner was removed from the approver roles';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;

-- Author, submitter and first approver now hold an approver role, and are still refused.
RESET ROLE; SELECT pg_temp.act_as('41400000-0000-4000-8000-000000000001'); SET LOCAL ROLE authenticated;
DO $$ BEGIN
  UPDATE email_campaigns SET sensitive_approved_by = '41400000-0000-4000-8000-000000000001' WHERE id = '41400000-0000-4000-8000-0000000000c1';
  RAISE EXCEPTION 'FAIL 19: the author gave the senior sign-off';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
RESET ROLE; SELECT pg_temp.act_as('41400000-0000-4000-8000-000000000002'); SET LOCAL ROLE authenticated;
DO $$ BEGIN
  UPDATE email_campaigns SET sensitive_approved_by = '41400000-0000-4000-8000-000000000002' WHERE id = '41400000-0000-4000-8000-0000000000c1';
  RAISE EXCEPTION 'FAIL 20: the submitter gave the senior sign-off';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
RESET ROLE; SELECT pg_temp.act_as('41400000-0000-4000-8000-000000000003'); SET LOCAL ROLE authenticated;
DO $$ BEGIN
  UPDATE email_campaigns SET sensitive_approved_by = '41400000-0000-4000-8000-000000000003' WHERE id = '41400000-0000-4000-8000-0000000000c1';
  RAISE EXCEPTION 'FAIL 21: the first approver gave the senior sign-off';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;

-- The flagger, a fourth person and now an approver role, signs off.
RESET ROLE; SELECT pg_temp.act_as('41400000-0000-4000-8000-000000000005'); SET LOCAL ROLE authenticated;
DO $$ BEGIN
  UPDATE email_campaigns SET sensitive_approved_by = '41400000-0000-4000-8000-000000000005' WHERE id = '41400000-0000-4000-8000-0000000000c1';
  IF NOT EXISTS (SELECT 1 FROM email_campaigns WHERE id = '41400000-0000-4000-8000-0000000000c1' AND sensitive_approved_at IS NOT NULL) THEN
    RAISE EXCEPTION 'FAIL 22: the senior sign-off has no recorded time';
  END IF;
END $$;
DO $$ BEGIN
  UPDATE email_campaigns SET sensitive_approved_by = NULL WHERE id = '41400000-0000-4000-8000-0000000000c1';
  RAISE EXCEPTION 'FAIL 23: a senior sign-off could be withdrawn without unflagging';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;

-- ============ BOTH APPROVALS: schedule is allowed ============
RESET ROLE; SELECT pg_temp.act_as('41400000-0000-4000-8000-000000000007'); SET LOCAL ROLE authenticated;
UPDATE email_campaigns SET status = 'scheduled', delivery_authorized_at = now() WHERE id = '41400000-0000-4000-8000-0000000000c1';

-- ============ UNFLAG AND RE-FLAG MID-SEND ============
RESET ROLE; SELECT pg_temp.act_as('41400000-0000-4000-8000-000000000001'); SET LOCAL ROLE authenticated;
DO $$ BEGIN
  UPDATE email_campaigns SET is_sensitive = false WHERE id = '41400000-0000-4000-8000-0000000000c1';
  RAISE EXCEPTION 'FAIL 24: the author could clear the sensitive flag';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;

-- Clearing the flag takes a senior sign-off role (marketing_manager here), and
-- never the submitter or first approver, though both hold that role now.
RESET ROLE; SELECT pg_temp.act_as('41400000-0000-4000-8000-000000000007'); SET LOCAL ROLE authenticated;
DO $$ BEGIN
  UPDATE email_campaigns SET is_sensitive = false WHERE id = '41400000-0000-4000-8000-0000000000c1';
  RAISE EXCEPTION 'FAIL 35: a flagging role that is not a senior sign-off role cleared the sensitive flag';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
RESET ROLE; SELECT pg_temp.act_as('41400000-0000-4000-8000-000000000002'); SET LOCAL ROLE authenticated;
DO $$ BEGIN
  UPDATE email_campaigns SET is_sensitive = false WHERE id = '41400000-0000-4000-8000-0000000000c1';
  RAISE EXCEPTION 'FAIL 36: the submitter cleared the sensitive flag';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
RESET ROLE; SELECT pg_temp.act_as('41400000-0000-4000-8000-000000000003'); SET LOCAL ROLE authenticated;
DO $$ BEGIN
  UPDATE email_campaigns SET is_sensitive = false WHERE id = '41400000-0000-4000-8000-0000000000c1';
  RAISE EXCEPTION 'FAIL 37: the first approver cleared the sensitive flag';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;

-- The owner adds leadership to the senior roles; the lead can now clear it.
RESET ROLE; SELECT pg_temp.act_as('41400000-0000-4000-8000-000000000004'); SET LOCAL ROLE authenticated;
UPDATE workspace_settings SET sensitive_approver_roles = ARRAY['marketing_manager', 'leadership']
  WHERE organization_id = '41400000-0000-4000-8000-0000000000f0';

RESET ROLE; SELECT pg_temp.act_as('41400000-0000-4000-8000-000000000007'); SET LOCAL ROLE authenticated;
DO $$ BEGIN
  UPDATE email_campaigns SET is_sensitive = false WHERE id = '41400000-0000-4000-8000-0000000000c1';
  IF NOT EXISTS (SELECT 1 FROM email_campaigns WHERE id = '41400000-0000-4000-8000-0000000000c1'
      AND NOT is_sensitive AND sensitive_approved_by IS NULL AND sensitive_approved_at IS NULL AND sensitive_flagged_by IS NULL) THEN
    RAISE EXCEPTION 'FAIL 25: unflagging did not clear the senior sign-off';
  END IF;
  -- Flag it again while it is sending: it pauses and needs a fresh sign-off.
  UPDATE email_campaigns SET is_sensitive = true WHERE id = '41400000-0000-4000-8000-0000000000c1';
  IF NOT EXISTS (SELECT 1 FROM email_campaigns WHERE id = '41400000-0000-4000-8000-0000000000c1'
      AND status = 'paused' AND metadata->>'paused_from' = 'scheduled' AND sensitive_approved_by IS NULL) THEN
    RAISE EXCEPTION 'FAIL 26: flagging a sending campaign did not pause it';
  END IF;
END $$;
DO $$ BEGIN
  UPDATE email_campaigns SET status = 'scheduled' WHERE id = '41400000-0000-4000-8000-0000000000c1';
  RAISE EXCEPTION 'FAIL 27: a re-flagged campaign resumed without a fresh senior sign-off';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
DO $$ BEGIN
  INSERT INTO email_campaign_signoff_events (organization_id, campaign_id, event)
    VALUES ('41400000-0000-4000-8000-0000000000f0', '41400000-0000-4000-8000-0000000000c1', 'senior_approved');
  RAISE EXCEPTION 'FAIL 28: a member could write the sign-off history';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;

-- ============ NO SIGNED-IN USER (like the service-role worker) ============
RESET ROLE; SELECT pg_temp.act_as(NULL);
DO $$ BEGIN
  IF auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'SETUP: auth.uid() should be empty here, got %', auth.uid(); END IF;
  UPDATE email_campaigns SET status = 'scheduled' WHERE id = '41400000-0000-4000-8000-0000000000c1';
  RAISE EXCEPTION 'FAIL 29: a write without a user scheduled a sensitive campaign awaiting sign-off';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
DO $$ BEGIN
  UPDATE email_campaigns SET status = 'sent' WHERE id = '41400000-0000-4000-8000-0000000000c1';
  RAISE EXCEPTION 'FAIL 30: a write without a user marked a sensitive campaign awaiting sign-off as sent';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
DO $$ BEGIN
  UPDATE email_campaigns SET is_sensitive = true WHERE id = '41400000-0000-4000-8000-0000000000c2';
  RAISE EXCEPTION 'FAIL 31: a write without a user could flag a campaign';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;

-- ============ A CAMPAIGN THAT IS NEVER FLAGGED BEHAVES AS BEFORE ============
RESET ROLE; SELECT pg_temp.act_as('41400000-0000-4000-8000-000000000002'); SET LOCAL ROLE authenticated;
UPDATE email_campaigns SET status = 'review' WHERE id = '41400000-0000-4000-8000-0000000000c2';
RESET ROLE; SELECT pg_temp.act_as('41400000-0000-4000-8000-000000000003'); SET LOCAL ROLE authenticated;
UPDATE email_campaigns SET status = 'approved', approved_by = '41400000-0000-4000-8000-000000000003' WHERE id = '41400000-0000-4000-8000-0000000000c2';
RESET ROLE; SELECT pg_temp.act_as('41400000-0000-4000-8000-000000000007'); SET LOCAL ROLE authenticated;
UPDATE email_campaigns SET status = 'scheduled' WHERE id = '41400000-0000-4000-8000-0000000000c2';
RESET ROLE; SELECT pg_temp.act_as(NULL);
UPDATE email_campaigns SET delivery_authorized_at = now() WHERE id = '41400000-0000-4000-8000-0000000000c2';
UPDATE email_campaigns SET status = 'sent' WHERE id = '41400000-0000-4000-8000-0000000000c2';

-- ============ CONTENT CHANGED AFTER THE SENIOR SIGN-OFF ============
-- c5: submitted by 02, flagged by its author 01, approved by 03, signed off by
-- 07 (leadership is a senior role since the owner's change above). Edits come
-- from 06, a plain member, writing directly as RLS still allows.
RESET ROLE; SELECT pg_temp.act_as('41400000-0000-4000-8000-000000000002'); SET LOCAL ROLE authenticated;
UPDATE email_campaigns SET status = 'review' WHERE id = '41400000-0000-4000-8000-0000000000c5';
RESET ROLE; SELECT pg_temp.act_as('41400000-0000-4000-8000-000000000001'); SET LOCAL ROLE authenticated;
UPDATE email_campaigns SET is_sensitive = true WHERE id = '41400000-0000-4000-8000-0000000000c5';
RESET ROLE; SELECT pg_temp.act_as('41400000-0000-4000-8000-000000000003'); SET LOCAL ROLE authenticated;
UPDATE email_campaigns SET status = 'approved', approved_by = '41400000-0000-4000-8000-000000000003' WHERE id = '41400000-0000-4000-8000-0000000000c5';
RESET ROLE; SELECT pg_temp.act_as('41400000-0000-4000-8000-000000000007'); SET LOCAL ROLE authenticated;
UPDATE email_campaigns SET sensitive_approved_by = '41400000-0000-4000-8000-000000000007' WHERE id = '41400000-0000-4000-8000-0000000000c5';

RESET ROLE; SELECT pg_temp.act_as('41400000-0000-4000-8000-000000000006'); SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM email_campaigns WHERE id = '41400000-0000-4000-8000-0000000000c5' AND sensitive_approved_by IS NOT NULL AND sensitive_approved_at IS NOT NULL) THEN
    RAISE EXCEPTION 'SETUP: c5 should hold a senior sign-off before the content checks';
  END IF;
  -- Writing the same values, or a field outside the content, keeps it.
  UPDATE email_campaigns SET name = 'REN-414 content renamed', body = body, subject = subject WHERE id = '41400000-0000-4000-8000-0000000000c5';
  IF NOT EXISTS (SELECT 1 FROM email_campaigns WHERE id = '41400000-0000-4000-8000-0000000000c5' AND sensitive_approved_by IS NOT NULL AND sensitive_approved_at IS NOT NULL) THEN
    RAISE EXCEPTION 'FAIL 38: a change outside body, subject, preview text and audience cleared the senior sign-off';
  END IF;
  UPDATE email_campaigns SET body = 'Different body copy after the sign-off.' WHERE id = '41400000-0000-4000-8000-0000000000c5';
  IF EXISTS (SELECT 1 FROM email_campaigns WHERE id = '41400000-0000-4000-8000-0000000000c5' AND sensitive_approved_by IS NOT NULL AND sensitive_approved_at IS NOT NULL) THEN
    RAISE EXCEPTION 'FAIL 39: changing the body kept the senior sign-off';
  END IF;
END $$;

RESET ROLE; SELECT pg_temp.act_as('41400000-0000-4000-8000-000000000007'); SET LOCAL ROLE authenticated;
UPDATE email_campaigns SET sensitive_approved_by = '41400000-0000-4000-8000-000000000007' WHERE id = '41400000-0000-4000-8000-0000000000c5';
RESET ROLE; SELECT pg_temp.act_as('41400000-0000-4000-8000-000000000006'); SET LOCAL ROLE authenticated;
DO $$ BEGIN
  UPDATE email_campaigns SET subject = 'A different subject' WHERE id = '41400000-0000-4000-8000-0000000000c5';
  IF EXISTS (SELECT 1 FROM email_campaigns WHERE id = '41400000-0000-4000-8000-0000000000c5' AND sensitive_approved_by IS NOT NULL AND sensitive_approved_at IS NOT NULL) THEN
    RAISE EXCEPTION 'FAIL 40: changing the subject kept the senior sign-off';
  END IF;
END $$;

RESET ROLE; SELECT pg_temp.act_as('41400000-0000-4000-8000-000000000007'); SET LOCAL ROLE authenticated;
UPDATE email_campaigns SET sensitive_approved_by = '41400000-0000-4000-8000-000000000007' WHERE id = '41400000-0000-4000-8000-0000000000c5';
RESET ROLE; SELECT pg_temp.act_as('41400000-0000-4000-8000-000000000006'); SET LOCAL ROLE authenticated;
DO $$ BEGIN
  UPDATE email_campaigns SET preview_text = 'A different inbox preview' WHERE id = '41400000-0000-4000-8000-0000000000c5';
  IF EXISTS (SELECT 1 FROM email_campaigns WHERE id = '41400000-0000-4000-8000-0000000000c5' AND sensitive_approved_by IS NOT NULL AND sensitive_approved_at IS NOT NULL) THEN
    RAISE EXCEPTION 'FAIL 41: changing the preview text kept the senior sign-off';
  END IF;
END $$;

RESET ROLE; SELECT pg_temp.act_as('41400000-0000-4000-8000-000000000007'); SET LOCAL ROLE authenticated;
UPDATE email_campaigns SET sensitive_approved_by = '41400000-0000-4000-8000-000000000007' WHERE id = '41400000-0000-4000-8000-0000000000c5';
RESET ROLE; SELECT pg_temp.act_as('41400000-0000-4000-8000-000000000006'); SET LOCAL ROLE authenticated;
DO $$ BEGIN
  UPDATE email_campaigns SET audience_segment_id = '41400000-0000-4000-8000-0000000000a1' WHERE id = '41400000-0000-4000-8000-0000000000c5';
  IF EXISTS (SELECT 1 FROM email_campaigns WHERE id = '41400000-0000-4000-8000-0000000000c5' AND sensitive_approved_by IS NOT NULL AND sensitive_approved_at IS NOT NULL) THEN
    RAISE EXCEPTION 'FAIL 42: changing the audience kept the senior sign-off';
  END IF;
END $$;

-- Signed off and sending, then edited: the sign-off goes, the campaign pauses,
-- and it can't resume, be authorized or finish until a senior signs off again.
RESET ROLE; SELECT pg_temp.act_as('41400000-0000-4000-8000-000000000007'); SET LOCAL ROLE authenticated;
UPDATE email_campaigns SET sensitive_approved_by = '41400000-0000-4000-8000-000000000007' WHERE id = '41400000-0000-4000-8000-0000000000c5';
UPDATE email_campaigns SET status = 'scheduled' WHERE id = '41400000-0000-4000-8000-0000000000c5';
RESET ROLE; SELECT pg_temp.act_as('41400000-0000-4000-8000-000000000006'); SET LOCAL ROLE authenticated;
DO $$ BEGIN
  UPDATE email_campaigns SET subject = 'Edited while sending' WHERE id = '41400000-0000-4000-8000-0000000000c5';
  IF NOT EXISTS (SELECT 1 FROM email_campaigns WHERE id = '41400000-0000-4000-8000-0000000000c5'
      AND status = 'paused' AND metadata->>'paused_from' = 'scheduled' AND sensitive_approved_by IS NULL AND sensitive_approved_at IS NULL) THEN
    RAISE EXCEPTION 'FAIL 43: editing a sending campaign did not clear its senior sign-off and pause it';
  END IF;
END $$;
RESET ROLE; SELECT pg_temp.act_as(NULL);
DO $$ BEGIN
  UPDATE email_campaigns SET status = 'scheduled' WHERE id = '41400000-0000-4000-8000-0000000000c5';
  RAISE EXCEPTION 'FAIL 44: a campaign paused by an edit resumed without a fresh senior sign-off';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
DO $$ BEGIN
  UPDATE email_campaigns SET delivery_authorized_at = now() WHERE id = '41400000-0000-4000-8000-0000000000c5';
  RAISE EXCEPTION 'FAIL 44: a campaign paused by an edit could be authorized for delivery';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
DO $$ BEGIN
  UPDATE email_campaigns SET status = 'sent' WHERE id = '41400000-0000-4000-8000-0000000000c5';
  RAISE EXCEPTION 'FAIL 45: a campaign paused by an edit could be marked sent';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;

-- Paused, it takes a fresh senior sign-off and can then resume.
RESET ROLE; SELECT pg_temp.act_as('41400000-0000-4000-8000-000000000007'); SET LOCAL ROLE authenticated;
DO $$ BEGIN
  UPDATE email_campaigns SET sensitive_approved_by = '41400000-0000-4000-8000-000000000007' WHERE id = '41400000-0000-4000-8000-0000000000c5';
  UPDATE email_campaigns SET status = 'scheduled' WHERE id = '41400000-0000-4000-8000-0000000000c5';
  IF NOT EXISTS (SELECT 1 FROM email_campaigns WHERE id = '41400000-0000-4000-8000-0000000000c5' AND status = 'scheduled' AND sensitive_approved_by IS NOT NULL) THEN
    RAISE EXCEPTION 'FAIL 48: a campaign paused by an edit could not be signed off again and resumed';
  END IF;
END $$;

-- ============ HISTORY (as postgres) ============
DO $$
DECLARE got text[];
BEGIN
  IF (SELECT status FROM email_campaigns WHERE id = '41400000-0000-4000-8000-0000000000c2') <> 'sent' THEN
    RAISE EXCEPTION 'FAIL 32: the never-flagged campaign did not reach sent';
  END IF;
  got := ARRAY(SELECT event || ':' || right(COALESCE(actor_id::text, '-'), 2) FROM email_campaign_signoff_events
    WHERE campaign_id = '41400000-0000-4000-8000-0000000000c1' ORDER BY created_at, id);
  -- now() is fixed inside a transaction, so compare as a set.
  IF NOT (got @> ARRAY['submitted:02', 'flagged:05', 'approved:03', 'senior_approved:05', 'senior_approval_cleared:07', 'unflagged:07', 'flagged:07']
      AND cardinality(got) = 7) THEN
    RAISE EXCEPTION 'FAIL 33: unexpected sign-off history %', got;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM email_campaign_signoff_events WHERE campaign_id = '41400000-0000-4000-8000-0000000000c1'
      AND event = 'senior_approval_cleared' AND reason = 'sensitive flag changed') THEN
    RAISE EXCEPTION 'FAIL 47: unflagging did not record why the senior sign-off was cleared';
  END IF;
  got := ARRAY(SELECT reason || ':' || right(COALESCE(actor_id::text, '-'), 2) FROM email_campaign_signoff_events
    WHERE campaign_id = '41400000-0000-4000-8000-0000000000c5' AND event = 'senior_approval_cleared' ORDER BY created_at, id);
  IF NOT (got @> ARRAY['content changed: body:06', 'content changed: subject:06', 'content changed: preview_text:06', 'content changed: audience_segment_id:06']
      AND cardinality(got) = 5) THEN
    RAISE EXCEPTION 'FAIL 46: unexpected content-change history %', got;
  END IF;
  got := ARRAY(SELECT reason || ':' || right(COALESCE(actor_id::text, '-'), 2) FROM email_campaign_signoff_events
    WHERE campaign_id = '41400000-0000-4000-8000-0000000000c5' AND event = 'delivery_paused');
  IF got IS DISTINCT FROM ARRAY['content changed after senior sign-off:06'] THEN
    RAISE EXCEPTION 'FAIL 46: the pause after a mid-send edit was not recorded once, by the editor (%)', got;
  END IF;
END $$;

SELECT 'REN-414 sign-off checks passed' AS result;
ROLLBACK;
