-- Leads: clients may only edit the CRM fields; consent and contact data are
-- written by the server.
--
-- leads_isolation (FOR ALL) let any workspace member write any column
-- directly, including marketing_consent, email_unsubscribed_at and
-- email_suppressed_at, so an unsubscribe or a bounce could be undone from the
-- browser. RLS WITH CHECK can't see the old value, so this uses privileges,
-- as 20261015000000_workspace_access_fix.sql does for profiles.
--
-- Writers that keep working:
--   - setLeadStage, saveLeadNotes, setLeadQualified (src/actions/leads.ts)
--     run as the user and only write the columns granted below.
--   - Lead capture, unsubscribe and the delivery jobs use the service role.
--   - record_resend_email_event() and replay_resend_email_events() are
--     SECURITY DEFINER.
--   - community_item_create_lead() becomes SECURITY DEFINER below.
--
-- leads_isolation stays as it is: it still scopes reads and the granted
-- updates to the caller's workspaces, and the REN-416 checks count it.
-- To let clients edit another column later, add it to the GRANT.
--
-- Safe to re-run.

-- ============ PRIVILEGES ============
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON leads FROM anon, authenticated;
GRANT UPDATE (funnel_stage, is_converted, is_qualified, score, score_reason, notes, owner_id)
  ON leads TO authenticated;

-- ============ COMMUNITY INBOX → LEAD ============
-- Members can no longer insert leads, so this runs as the table owner. The
-- caller_organization_ids() check is what keeps it to the caller's own
-- workspaces; RLS no longer applies inside it.
CREATE OR REPLACE FUNCTION community_item_create_lead(p_community_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE item community_items%ROWTYPE; new_lead_id uuid;
BEGIN
  SELECT * INTO item FROM community_items
    WHERE id = p_community_id
      AND organization_id IN (SELECT caller_organization_ids())
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Community item not found'; END IF;
  IF item.category <> 'lead' THEN RAISE EXCEPTION 'Only items classified as leads can be added to CRM'; END IF;
  IF item.lead_id IS NOT NULL THEN RETURN item.lead_id; END IF;
  INSERT INTO leads (organization_id, name, interest, source_platform, funnel_stage, marketing_consent)
    VALUES (item.organization_id, NULLIF(item.author_label, ''), item.body, item.platform, 'captured', false)
    RETURNING id INTO new_lead_id;
  UPDATE community_items SET lead_id = new_lead_id WHERE id = p_community_id;
  RETURN new_lead_id;
END;
$$;
REVOKE ALL ON FUNCTION community_item_create_lead(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION community_item_create_lead(uuid) TO authenticated;
