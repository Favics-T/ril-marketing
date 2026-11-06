-- Enforce the landing-page review gate for authenticated clients as well as server actions.
CREATE OR REPLACE FUNCTION public.guard_landing_page_workflow()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
  member_role text;
  content_changed boolean;
BEGIN
  -- Trusted service jobs can create automation drafts without a browser session.
  IF auth.role() = 'service_role' OR (actor IS NULL AND current_user IN ('postgres', 'supabase_admin')) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF actor IS NULL THEN RAISE EXCEPTION 'Sign in to manage landing pages'; END IF;
  SELECT role INTO member_role FROM public.organization_members
    WHERE organization_id = CASE WHEN TG_OP = 'DELETE' THEN OLD.organization_id ELSE NEW.organization_id END AND user_id = actor;
  IF member_role IS NULL OR member_role NOT IN ('owner', 'admin', 'marketing_manager', 'leadership') THEN
    RAISE EXCEPTION 'Landing pages require a marketing reviewer role';
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN RAISE EXCEPTION 'Only private drafts can be deleted'; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'A landing page cannot move between workspaces';
  END IF;
  IF NEW.campaign_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.campaigns WHERE id = NEW.campaign_id AND organization_id = NEW.organization_id) THEN
    RAISE EXCEPTION 'Choose a campaign in this workspace';
  END IF;
  IF NEW.activity_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.activities WHERE id = NEW.activity_id AND organization_id = NEW.organization_id) THEN
    RAISE EXCEPTION 'Choose an activity in this workspace';
  END IF;
  IF NEW.audience_segment_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.audience_segments WHERE id = NEW.audience_segment_id AND organization_id = NEW.organization_id) THEN
    RAISE EXCEPTION 'Choose a segment in this workspace';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'draft' THEN RAISE EXCEPTION 'New landing pages must start as drafts'; END IF;
    NEW.created_by := actor;
    NEW.approved_by := NULL;
    NEW.published_by := NULL;
    NEW.metadata := COALESCE(NEW.metadata, '{}'::jsonb) || jsonb_build_object('last_edited_by', actor);
    RETURN NEW;
  END IF;
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN RAISE EXCEPTION 'The page author cannot be changed'; END IF;
  content_changed := ROW(NEW.title, NEW.slug, NEW.headline, NEW.body, NEW.cta_label, NEW.registration_url, NEW.meta_description, NEW.campaign_id, NEW.activity_id, NEW.audience_segment_id, NEW.metadata)
    IS DISTINCT FROM ROW(OLD.title, OLD.slug, OLD.headline, OLD.body, OLD.cta_label, OLD.registration_url, OLD.meta_description, OLD.campaign_id, OLD.activity_id, OLD.audience_segment_id, OLD.metadata);
  IF content_changed THEN
    IF OLD.status <> 'draft' OR NEW.status <> 'draft' THEN RAISE EXCEPTION 'Return the page to Draft before editing'; END IF;
    NEW.metadata := COALESCE(NEW.metadata, '{}'::jsonb) || jsonb_build_object('last_edited_by', actor);
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT ((OLD.status = 'draft' AND NEW.status = 'review') OR
      (OLD.status = 'review' AND NEW.status IN ('draft', 'approved')) OR
      (OLD.status = 'approved' AND NEW.status IN ('review', 'published')) OR
      (OLD.status = 'published' AND NEW.status = 'paused') OR
      (OLD.status = 'paused' AND NEW.status IN ('draft', 'published'))) THEN
      RAISE EXCEPTION 'Invalid landing page status transition';
    END IF;
    IF NEW.status IN ('review', 'approved', 'published') AND NEW.campaign_id IS NULL THEN RAISE EXCEPTION 'Link a campaign before review'; END IF;
    IF NEW.status = 'approved' THEN
      IF actor = OLD.created_by OR actor::text = OLD.metadata->>'last_edited_by' THEN RAISE EXCEPTION 'A different reviewer must approve this copy'; END IF;
      NEW.approved_by := actor;
    ELSIF NEW.status = 'published' THEN
      IF member_role NOT IN ('owner', 'admin', 'leadership') THEN RAISE EXCEPTION 'An owner, admin or leader must publish'; END IF;
      IF OLD.approved_by IS NULL OR actor = OLD.approved_by THEN RAISE EXCEPTION 'A different publisher must release the approved page'; END IF;
      NEW.approved_by := OLD.approved_by;
      NEW.published_by := actor;
    END IF;
  END IF;
  IF NEW.status IN ('draft', 'review') THEN
    NEW.approved_by := NULL;
    NEW.published_by := NULL;
  ELSIF NEW.status = OLD.status THEN
    NEW.approved_by := OLD.approved_by;
    NEW.published_by := OLD.published_by;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS landing_pages_approval_guard ON public.landing_pages;
CREATE TRIGGER landing_pages_approval_guard BEFORE INSERT OR UPDATE OR DELETE ON public.landing_pages
  FOR EACH ROW EXECUTE FUNCTION public.guard_landing_page_workflow();
