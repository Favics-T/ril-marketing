-- REN-414: sensitive email campaigns need a second, senior sign-off.
--
-- The rules live in a trigger, not only in RLS: RLS can't compare a row's old
-- and new values, and the delivery worker, nurture and automation jobs write
-- email_campaigns with the service role, which skips RLS but not triggers.
-- Who may flag and who may sign off are per-workspace settings, because the
-- business hasn't fixed those roles yet. Safe to re-run.
--
-- New policies use caller_workspace_role() rather than caller_organization_ids()
-- so the REN-416 isolation check's policy count stays unchanged.

-- ============ ROLE LOOKUP ============
CREATE OR REPLACE FUNCTION caller_workspace_role(p_organization_id uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM organization_members
    WHERE organization_id = p_organization_id AND user_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION caller_workspace_role(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION caller_workspace_role(uuid) TO authenticated, service_role;

-- ============ WORKSPACE SETTINGS ============
-- No row means the defaults below. Keep them in step with the trigger and
-- DEFAULT_SENSITIVITY_SETTINGS in src/lib/email/sensitivity.ts.
CREATE TABLE IF NOT EXISTS workspace_settings (
  organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  can_flag_sensitive text[] NOT NULL DEFAULT ARRAY['owner', 'admin', 'marketing_manager', 'leadership'],
  sensitive_approver_roles text[] NOT NULL DEFAULT ARRAY['owner', 'admin'],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Never empty, so a workspace can't lock every sensitive campaign out.
  CONSTRAINT workspace_settings_flag_roles_valid CHECK (
    cardinality(can_flag_sensitive) > 0
    AND can_flag_sensitive <@ ARRAY['owner', 'admin', 'marketing_manager', 'leadership', 'member']
  ),
  CONSTRAINT workspace_settings_approver_roles_valid CHECK (
    cardinality(sensitive_approver_roles) > 0
    AND sensitive_approver_roles <@ ARRAY['owner', 'admin', 'marketing_manager', 'leadership', 'member']
  )
);
DROP TRIGGER IF EXISTS workspace_settings_updated_at ON workspace_settings;
CREATE TRIGGER workspace_settings_updated_at BEFORE UPDATE ON workspace_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
ALTER TABLE workspace_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_settings_read ON workspace_settings;
DROP POLICY IF EXISTS workspace_settings_owner_write ON workspace_settings;
CREATE POLICY workspace_settings_read ON workspace_settings FOR SELECT
  USING (caller_workspace_role(organization_id) IS NOT NULL);
CREATE POLICY workspace_settings_owner_write ON workspace_settings FOR ALL
  USING (caller_workspace_role(organization_id) IN ('owner', 'admin'))
  WITH CHECK (caller_workspace_role(organization_id) IN ('owner', 'admin'));

-- ============ CAMPAIGN COLUMNS ============
ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS is_sensitive boolean NOT NULL DEFAULT false;
ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS sensitive_flagged_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS sensitive_flagged_at timestamptz;
ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS sensitive_approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS sensitive_approved_at timestamptz;
ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS submitted_at timestamptz;

-- The submitter used to live in metadata, which any member can edit. Copy it
-- across before the trigger exists, so the backfill isn't treated as a client
-- write. approved_at stays empty for old approvals: the time wasn't recorded.
UPDATE email_campaigns c SET submitted_by = (c.metadata->>'submitted_by')::uuid
  WHERE c.submitted_by IS NULL
    AND c.metadata->>'submitted_by' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = (c.metadata->>'submitted_by')::uuid);

-- ============ SIGN-OFF HISTORY ============
-- Append-only: members can read it, and only the trigger below writes it.
CREATE TABLE IF NOT EXISTS email_campaign_signoff_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  event text NOT NULL CHECK (event IN ('submitted', 'approved', 'flagged', 'unflagged', 'senior_approved', 'senior_approval_cleared')),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_signoff_events_campaign_idx ON email_campaign_signoff_events(campaign_id, created_at);
ALTER TABLE email_campaign_signoff_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS email_signoff_events_read ON email_campaign_signoff_events;
CREATE POLICY email_signoff_events_read ON email_campaign_signoff_events FOR SELECT
  USING (caller_workspace_role(organization_id) IS NOT NULL);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON email_campaign_signoff_events FROM anon, authenticated;

-- ============ GUARD ============
-- A user column may only be cleared by the user being deleted
-- (ON DELETE SET NULL); any other change to it is a client write.
CREATE OR REPLACE FUNCTION email_signoff_user_gone(p_user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_user IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user);
$$;
REVOKE ALL ON FUNCTION email_signoff_user_gone(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION email_campaigns_signoff_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  actor uuid := auth.uid();
  actor_role text;
  flaggers text[];
  approvers text[];
  events text[] := ARRAY[]::text[];
  evt text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_sensitive OR NEW.sensitive_approved_by IS NOT NULL THEN
      RAISE EXCEPTION 'A new email campaign can''t start flagged as sensitive or signed off; flag it once it exists.'
        USING ERRCODE = '42501';
    END IF;
    NEW.sensitive_flagged_by := NULL; NEW.sensitive_flagged_at := NULL; NEW.sensitive_approved_at := NULL;
    NEW.submitted_by := NULL; NEW.submitted_at := NULL;
    NEW.approved_at := CASE WHEN NEW.approved_by IS NOT NULL THEN now() END;
    RETURN NEW;
  END IF;

  SELECT s.can_flag_sensitive, s.sensitive_approver_roles INTO flaggers, approvers
    FROM workspace_settings s WHERE s.organization_id = NEW.organization_id;
  flaggers := COALESCE(flaggers, ARRAY['owner', 'admin', 'marketing_manager', 'leadership']);
  approvers := COALESCE(approvers, ARRAY['owner', 'admin']);
  IF actor IS NOT NULL THEN
    SELECT role INTO actor_role FROM organization_members
      WHERE organization_id = NEW.organization_id AND user_id = actor;
  END IF;

  -- Submitter: always the signed-in user at submit time, never a client value.
  IF NEW.status = 'review' AND OLD.status IS DISTINCT FROM 'review' THEN
    NEW.submitted_by := actor; NEW.submitted_at := now();
    events := array_append(events, 'submitted');
  ELSIF NEW.submitted_by IS NULL AND email_signoff_user_gone(OLD.submitted_by) THEN
    NEW.submitted_at := OLD.submitted_at;
  ELSE
    NEW.submitted_by := OLD.submitted_by; NEW.submitted_at := OLD.submitted_at;
  END IF;

  -- First approval: the time is the database's. A new first approver voids a
  -- senior sign-off that was given against the old one.
  IF NEW.approved_by IS DISTINCT FROM OLD.approved_by THEN
    NEW.approved_at := CASE WHEN NEW.approved_by IS NOT NULL THEN now() END;
    IF NEW.approved_by IS NOT NULL THEN events := array_append(events, 'approved'); END IF;
    IF OLD.sensitive_approved_by IS NOT NULL AND NOT email_signoff_user_gone(OLD.approved_by) THEN
      NEW.sensitive_approved_by := NULL; NEW.sensitive_approved_at := NULL;
      events := array_append(events, 'senior_approval_cleared');
    END IF;
  ELSE
    NEW.approved_at := OLD.approved_at;
  END IF;

  -- Flag and unflag.
  IF NEW.is_sensitive IS DISTINCT FROM OLD.is_sensitive THEN
    IF actor IS NULL THEN
      RAISE EXCEPTION 'Only a signed-in workspace member can flag or unflag a sensitive campaign.' USING ERRCODE = '42501';
    END IF;
    IF actor_role IS NULL OR NOT actor_role = ANY (flaggers) THEN
      RAISE EXCEPTION 'Your role can''t flag or unflag sensitive campaigns in this workspace.' USING ERRCODE = '42501';
    END IF;
    IF actor = OLD.created_by OR actor = OLD.submitted_by THEN
      RAISE EXCEPTION 'The campaign''s author or submitter can''t flag or unflag it.' USING ERRCODE = '42501';
    END IF;
    IF OLD.status = 'sent' THEN
      RAISE EXCEPTION 'A sent campaign can''t be flagged or unflagged.' USING ERRCODE = '42501';
    END IF;
    -- Either direction voids any senior sign-off.
    IF OLD.sensitive_approved_by IS NOT NULL THEN events := array_append(events, 'senior_approval_cleared'); END IF;
    NEW.sensitive_approved_by := NULL; NEW.sensitive_approved_at := NULL;
    IF NEW.is_sensitive THEN
      NEW.sensitive_flagged_by := actor; NEW.sensitive_flagged_at := now();
      events := array_append(events, 'flagged');
      -- Flagged mid-send: hold delivery until the senior sign-off.
      IF OLD.status = 'scheduled' THEN
        NEW.status := 'paused';
        NEW.metadata := COALESCE(NEW.metadata, '{}'::jsonb) || '{"paused_from": "scheduled"}'::jsonb;
      END IF;
    ELSE
      NEW.sensitive_flagged_by := NULL; NEW.sensitive_flagged_at := NULL;
      events := array_append(events, 'unflagged');
    END IF;
  ELSE
    IF NOT (NEW.sensitive_flagged_by IS NULL AND email_signoff_user_gone(OLD.sensitive_flagged_by)) THEN
      NEW.sensitive_flagged_by := OLD.sensitive_flagged_by;
    END IF;
    NEW.sensitive_flagged_at := OLD.sensitive_flagged_at;

    -- Senior sign-off, given by the signed-in user in their own name.
    IF NEW.sensitive_approved_by IS DISTINCT FROM OLD.sensitive_approved_by
       AND NOT 'senior_approval_cleared' = ANY (events) THEN
      IF NEW.sensitive_approved_by IS NULL THEN
        IF NOT email_signoff_user_gone(OLD.sensitive_approved_by) THEN
          RAISE EXCEPTION 'A senior sign-off is only withdrawn by unflagging the campaign.' USING ERRCODE = '42501';
        END IF;
        NEW.sensitive_approved_at := OLD.sensitive_approved_at;
      ELSE
        IF actor IS NULL OR NEW.sensitive_approved_by <> actor THEN
          RAISE EXCEPTION 'A senior sign-off must be given by the signed-in reviewer in their own name.' USING ERRCODE = '42501';
        END IF;
        IF NOT NEW.is_sensitive THEN
          RAISE EXCEPTION 'Only a sensitive campaign takes a senior sign-off.' USING ERRCODE = '42501';
        END IF;
        IF OLD.approved_by IS NULL OR NEW.approved_by IS DISTINCT FROM OLD.approved_by OR OLD.status NOT IN ('approved', 'paused') THEN
          RAISE EXCEPTION 'Give the senior sign-off after the campaign''s first approval.' USING ERRCODE = '42501';
        END IF;
        IF actor_role IS NULL OR NOT actor_role = ANY (approvers) THEN
          RAISE EXCEPTION 'Your role can''t give the senior sign-off in this workspace.' USING ERRCODE = '42501';
        END IF;
        IF actor = OLD.created_by OR actor = OLD.submitted_by OR actor = OLD.approved_by THEN
          RAISE EXCEPTION 'The senior sign-off must come from someone other than the author, submitter and first approver.' USING ERRCODE = '42501';
        END IF;
        NEW.sensitive_approved_at := now();
        events := array_append(events, 'senior_approved');
      END IF;
    ELSIF NEW.sensitive_approved_by IS NOT DISTINCT FROM OLD.sensitive_approved_by THEN
      NEW.sensitive_approved_at := OLD.sensitive_approved_at;
    END IF;
  END IF;

  -- The gate: no queuing, scheduling, delivery authorization or completion for
  -- a sensitive campaign without its senior sign-off. Applies to every caller.
  IF NEW.is_sensitive AND NEW.sensitive_approved_by IS NULL AND (
    (NEW.status IN ('scheduled', 'sent') AND NEW.status IS DISTINCT FROM OLD.status)
    OR (NEW.delivery_authorized_at IS NOT NULL AND NEW.delivery_authorized_at IS DISTINCT FROM OLD.delivery_authorized_at)
  ) THEN
    RAISE EXCEPTION 'This sensitive campaign is awaiting senior sign-off and can''t be queued, scheduled or sent.' USING ERRCODE = '42501';
  END IF;

  FOREACH evt IN ARRAY events LOOP
    INSERT INTO email_campaign_signoff_events (organization_id, campaign_id, event, actor_id)
      VALUES (NEW.organization_id, NEW.id, evt, actor);
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION email_campaigns_signoff_guard() FROM PUBLIC;

DROP TRIGGER IF EXISTS email_campaigns_signoff_guard ON email_campaigns;
CREATE TRIGGER email_campaigns_signoff_guard BEFORE INSERT OR UPDATE ON email_campaigns
  FOR EACH ROW EXECUTE FUNCTION email_campaigns_signoff_guard();
