-- REN-414 follow-up to 20261021000000_email_sensitive_signoff.sql, which is
-- already applied, so the guard is replaced here rather than edited there.
--
-- 1. A senior sign-off covers the copy and audience it was given against.
--    Changing body, subject, preview_text or audience_segment_id afterwards
--    clears it and records why. A campaign that was sending is paused, as it
--    is when flagged mid-send, and the pause is recorded as delivery_paused.
-- 2. Clearing the sensitive flag removes the senior step, so it now takes a
--    senior sign-off role, and never the author, submitter or first approver.
--    Flagging only adds restrictions, so the author and submitter may now flag.
--
-- Safe to re-run.

ALTER TABLE email_campaign_signoff_events ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE email_campaign_signoff_events DROP CONSTRAINT IF EXISTS email_campaign_signoff_events_event_check;
ALTER TABLE email_campaign_signoff_events ADD CONSTRAINT email_campaign_signoff_events_event_check
  CHECK (event IN ('submitted', 'approved', 'flagged', 'unflagged', 'senior_approved', 'senior_approval_cleared', 'delivery_paused'));

CREATE OR REPLACE FUNCTION email_campaigns_signoff_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  actor uuid := auth.uid();
  actor_role text;
  flaggers text[];
  approvers text[];
  events text[] := ARRAY[]::text[];
  reasons text[] := ARRAY[]::text[];
  changed text[];
  i integer;
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
    events := array_append(events, 'submitted'); reasons := array_append(reasons, NULL::text);
  ELSIF NEW.submitted_by IS NULL AND email_signoff_user_gone(OLD.submitted_by) THEN
    NEW.submitted_at := OLD.submitted_at;
  ELSE
    NEW.submitted_by := OLD.submitted_by; NEW.submitted_at := OLD.submitted_at;
  END IF;

  -- First approval: the time is the database's. A new first approver voids a
  -- senior sign-off that was given against the old one.
  IF NEW.approved_by IS DISTINCT FROM OLD.approved_by THEN
    NEW.approved_at := CASE WHEN NEW.approved_by IS NOT NULL THEN now() END;
    IF NEW.approved_by IS NOT NULL THEN
      events := array_append(events, 'approved'); reasons := array_append(reasons, NULL::text);
    END IF;
    IF OLD.sensitive_approved_by IS NOT NULL AND NOT email_signoff_user_gone(OLD.approved_by) THEN
      NEW.sensitive_approved_by := NULL; NEW.sensitive_approved_at := NULL;
      events := array_append(events, 'senior_approval_cleared'); reasons := array_append(reasons, 'first approver changed');
    END IF;
  ELSE
    NEW.approved_at := OLD.approved_at;
  END IF;

  -- Flag and unflag.
  IF NEW.is_sensitive IS DISTINCT FROM OLD.is_sensitive THEN
    IF actor IS NULL THEN
      RAISE EXCEPTION 'Only a signed-in workspace member can flag or unflag a sensitive campaign.' USING ERRCODE = '42501';
    END IF;
    IF OLD.status = 'sent' THEN
      RAISE EXCEPTION 'A sent campaign can''t be flagged or unflagged.' USING ERRCODE = '42501';
    END IF;
    IF NEW.is_sensitive THEN
      -- Flagging only adds restrictions, so the author and submitter may flag.
      IF actor_role IS NULL OR NOT actor_role = ANY (flaggers) THEN
        RAISE EXCEPTION 'Your role can''t flag sensitive campaigns in this workspace.' USING ERRCODE = '42501';
      END IF;
    ELSE
      -- Unflagging removes the senior step, so it takes a senior role and a
      -- person outside the campaign's own approval chain.
      IF actor_role IS NULL OR NOT actor_role = ANY (approvers) THEN
        RAISE EXCEPTION 'Your role can''t clear the sensitive flag in this workspace; it needs a senior sign-off role.' USING ERRCODE = '42501';
      END IF;
      IF actor = OLD.created_by OR actor = OLD.submitted_by OR actor = OLD.approved_by THEN
        RAISE EXCEPTION 'The campaign''s author, submitter and first approver can''t clear the sensitive flag.' USING ERRCODE = '42501';
      END IF;
    END IF;
    -- Either direction voids any senior sign-off.
    IF OLD.sensitive_approved_by IS NOT NULL THEN
      events := array_append(events, 'senior_approval_cleared'); reasons := array_append(reasons, 'sensitive flag changed');
    END IF;
    NEW.sensitive_approved_by := NULL; NEW.sensitive_approved_at := NULL;
    IF NEW.is_sensitive THEN
      NEW.sensitive_flagged_by := actor; NEW.sensitive_flagged_at := now();
      events := array_append(events, 'flagged'); reasons := array_append(reasons, NULL::text);
      -- Flagged mid-send: hold delivery until the senior sign-off.
      IF OLD.status = 'scheduled' THEN
        NEW.status := 'paused';
        NEW.metadata := COALESCE(NEW.metadata, '{}'::jsonb) || '{"paused_from": "scheduled"}'::jsonb;
      END IF;
    ELSE
      NEW.sensitive_flagged_by := NULL; NEW.sensitive_flagged_at := NULL;
      events := array_append(events, 'unflagged'); reasons := array_append(reasons, NULL::text);
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
        events := array_append(events, 'senior_approved'); reasons := array_append(reasons, NULL::text);
      END IF;
    ELSIF NEW.sensitive_approved_by IS NOT DISTINCT FROM OLD.sensitive_approved_by THEN
      NEW.sensitive_approved_at := OLD.sensitive_approved_at;
    END IF;
  END IF;

  -- Content changed under a senior sign-off: the signer approved other copy or
  -- another audience, so the sign-off no longer stands. This includes a
  -- segment deletion setting audience_segment_id to NULL, which widens the
  -- audience to every opted-in contact.
  IF NEW.sensitive_approved_by IS NOT NULL THEN
    changed := ARRAY[]::text[];
    IF NEW.subject IS DISTINCT FROM OLD.subject THEN changed := array_append(changed, 'subject'); END IF;
    IF NEW.preview_text IS DISTINCT FROM OLD.preview_text THEN changed := array_append(changed, 'preview_text'); END IF;
    IF NEW.body IS DISTINCT FROM OLD.body THEN changed := array_append(changed, 'body'); END IF;
    IF NEW.audience_segment_id IS DISTINCT FROM OLD.audience_segment_id THEN changed := array_append(changed, 'audience_segment_id'); END IF;
    IF cardinality(changed) > 0 THEN
      NEW.sensitive_approved_by := NULL; NEW.sensitive_approved_at := NULL;
      events := array_append(events, 'senior_approval_cleared');
      reasons := array_append(reasons, 'content changed: ' || array_to_string(changed, ', '));
      -- Edited mid-send: hold delivery, as flagging mid-send does, so a
      -- senior can sign off again (only approved or paused campaigns take one).
      IF OLD.status = 'scheduled' AND NEW.status = 'scheduled' THEN
        NEW.status := 'paused';
        NEW.metadata := COALESCE(NEW.metadata, '{}'::jsonb) || '{"paused_from": "scheduled"}'::jsonb;
        events := array_append(events, 'delivery_paused');
        reasons := array_append(reasons, 'content changed after senior sign-off');
      END IF;
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

  FOR i IN 1 .. cardinality(events) LOOP
    INSERT INTO email_campaign_signoff_events (organization_id, campaign_id, event, actor_id, reason)
      VALUES (NEW.organization_id, NEW.id, events[i], actor, reasons[i]);
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION email_campaigns_signoff_guard() FROM PUBLIC;

-- The trigger from 20261021000000 already calls this function by name; it is
-- recreated so this file also stands on its own.
DROP TRIGGER IF EXISTS email_campaigns_signoff_guard ON email_campaigns;
CREATE TRIGGER email_campaigns_signoff_guard BEFORE INSERT OR UPDATE ON email_campaigns
  FOR EACH ROW EXECUTE FUNCTION email_campaigns_signoff_guard();
