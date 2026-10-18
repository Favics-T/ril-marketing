BEGIN;
-- Content approval is revision-bound. Existing approvals are not fabricated:
-- legacy approved assets must return to Editing and pass the recorded review.


ALTER TABLE public.content_assets
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approval_category text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS approval_revision integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS second_reviewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.content_assets ADD CONSTRAINT content_approval_category_valid CHECK
  (approval_category IN ('standard','paid_advertising','external_communications','partnership_announcement','leadership_communications','crisis'));
ALTER TABLE public.asset_approvals
  ADD COLUMN IF NOT EXISTS actor_name text,
  ADD COLUMN IF NOT EXISTS actor_role text,
  ADD COLUMN IF NOT EXISTS approval_revision integer,
  ADD COLUMN IF NOT EXISTS previous_scheduled_for timestamptz,
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz;
UPDATE public.content_assets a SET created_by=g.created_by FROM public.ai_generations g WHERE a.generation_id=g.id AND a.organization_id=g.organization_id AND a.created_by IS NULL;
UPDATE public.content_assets SET approval_category=CASE WHEN channel='paid_ads' THEN 'paid_advertising' ELSE 'external_communications' END,sensitivity='high' WHERE channel IN ('paid_ads','pr') OR format='press release';

CREATE TABLE public.content_signoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  content_asset_id uuid NOT NULL REFERENCES public.content_assets(id),
  approval_revision integer NOT NULL,
  tier integer NOT NULL CHECK (tier IN (1,2)),
  reviewer_id uuid NOT NULL REFERENCES auth.users(id),
  reviewer_name text NOT NULL,
  reviewer_role text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(content_asset_id,approval_revision,tier),
  UNIQUE(content_asset_id,approval_revision,reviewer_id)
);
ALTER TABLE public.content_signoffs ENABLE ROW LEVEL SECURITY;
CREATE POLICY content_signoffs_read ON public.content_signoffs FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.caller_organization_ids()));
GRANT SELECT ON public.content_signoffs TO authenticated;
GRANT ALL ON public.content_signoffs TO service_role;
REVOKE INSERT,UPDATE,DELETE ON public.content_signoffs FROM authenticated,anon;
DROP POLICY IF EXISTS asset_approvals_isolation ON public.asset_approvals;
CREATE POLICY asset_approvals_read ON public.asset_approvals FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.caller_organization_ids()));
REVOKE INSERT,UPDATE,DELETE ON public.asset_approvals FROM authenticated,anon;
REVOKE DELETE,UPDATE ON public.content_assets FROM authenticated,anon;
-- Existing editorial tools may update ordinary fields, but not release authority.
DO $$ DECLARE columns text; BEGIN
  SELECT string_agg(quote_ident(column_name),',') INTO columns FROM information_schema.columns
  WHERE table_schema='public' AND table_name='content_assets' AND column_name NOT IN
  ('id','organization_id','created_by','created_at','updated_at','status','scheduled_for','published_at','sensitivity','approval_category','approval_revision','second_reviewer_id');
  EXECUTE 'GRANT UPDATE ('||columns||') ON public.content_assets TO authenticated';
END $$;

CREATE FUNCTION public.content_actor_name(p_user uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT coalesce(nullif(raw_user_meta_data->>'full_name',''),nullif(raw_user_meta_data->>'name',''),email,p_user::text) FROM auth.users WHERE id=p_user;
$$;
REVOKE ALL ON FUNCTION public.content_actor_name(uuid) FROM PUBLIC;

CREATE FUNCTION public.content_copy_problem(p_channel text,p_platform text,p_body text,p_format text) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE channel text:=lower(coalesce(nullif(nullif(p_channel,''),'social'),p_platform,'')); cap integer; part text; count_chars integer;
BEGIN
  IF btrim(coalesce(p_body,''))='' THEN RETURN 'Add the content before requesting approval.'; END IF;
  IF channel IN ('','social') THEN channel:=lower(coalesce(p_channel,'')); END IF;
  IF channel IN ('','social') THEN RETURN 'Choose a platform before requesting approval.'; END IF;
  cap:=CASE channel WHEN 'x' THEN 280 WHEN 'twitter' THEN 280 WHEN 'linkedin' THEN 3000 WHEN 'instagram' THEN 2200 WHEN 'facebook' THEN 63206 WHEN 'tiktok' THEN 4000 WHEN 'youtube' THEN 5000 WHEN 'threads' THEN 500 WHEN 'bluesky' THEN 300 WHEN 'mastodon' THEN 500 ELSE NULL END;
  -- A clip brief is production guidance; a video caption is ordinary channel copy.
  IF p_format='short-form video' THEN RETURN NULL; END IF;
  IF channel IN ('x','twitter') THEN
    FOR part IN SELECT regexp_split_to_table(replace(p_body,E'\r',''),E'\n+— Optional thread \\(post each separately\\) —\n+|\n\n+') LOOP
      count_chars:=char_length(regexp_replace(btrim(part),'https?://[^[:space:]]+',repeat('x',23),'g'));
      IF count_chars>cap THEN RETURN 'X allows 280 characters per post. Shorten the copy.'; END IF;
    END LOOP;
  ELSIF cap IS NOT NULL AND char_length(p_body)>cap THEN RETURN initcap(channel)||' allows '||cap||' characters. Shorten the copy.';
  END IF;
  IF channel='instagram' AND (SELECT count(*) FROM regexp_matches(p_body,'(^|[[:space:]])#[[:alnum:]_]+','g'))>30 THEN RETURN 'Instagram allows 30 hashtags.'; END IF;
  RETURN NULL;
END $$;

CREATE FUNCTION public.content_release_ready(p_asset uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM content_assets a
    JOIN content_signoffs first ON first.content_asset_id=a.id AND first.approval_revision=a.approval_revision AND first.tier=1
    JOIN organization_members member1 ON member1.organization_id=a.organization_id AND member1.user_id=first.reviewer_id AND member1.role IN ('owner','admin','marketing_manager','leadership')
    WHERE a.id=p_asset AND (a.created_by IS NULL OR first.reviewer_id<>a.created_by)
    AND (a.approval_category='standard' AND a.sensitivity<>'high' OR EXISTS(
      SELECT 1 FROM content_signoffs second JOIN organization_members member2 ON member2.organization_id=a.organization_id AND member2.user_id=second.reviewer_id AND member2.role IN ('owner','admin','leadership')
      WHERE second.content_asset_id=a.id AND second.approval_revision=a.approval_revision AND second.tier=2
      AND second.reviewer_id=a.second_reviewer_id AND second.reviewer_id<>first.reviewer_id AND (a.created_by IS NULL OR second.reviewer_id<>a.created_by)))
    AND content_copy_problem(a.channel,a.platform,a.body,a.format) IS NULL);
$$;
REVOKE ALL ON FUNCTION public.content_release_ready(uuid) FROM PUBLIC;

CREATE FUNCTION public.check_content_release(p_asset uuid,p_organization uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM content_assets WHERE id=p_asset AND organization_id=p_organization) THEN RAISE EXCEPTION 'Content not found.'; END IF;
  IF coalesce(auth.role(),'')<>'service_role' AND NOT EXISTS(SELECT 1 FROM organization_members WHERE organization_id=p_organization AND user_id=auth.uid() AND role IN ('owner','admin','marketing_manager','leadership')) THEN RAISE EXCEPTION 'Publishing requires a reviewer role.'; END IF;
  IF NOT content_release_ready(p_asset) THEN RAISE EXCEPTION 'This revision needs recorded approval before scheduling or publishing. Return legacy approvals to Editing and request review.'; END IF;
  RETURN true;
END $$;
GRANT EXECUTE ON FUNCTION public.check_content_release(uuid,uuid) TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.check_content_release(uuid,uuid) FROM PUBLIC;

CREATE FUNCTION public.guard_content_revision() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE changed boolean; issue text;
BEGIN
  IF NEW.approval_category='standard' AND (NEW.channel IN ('paid_ads','pr') OR NEW.format='press release') THEN
    NEW.approval_category:=CASE WHEN NEW.channel='paid_ads' THEN 'paid_advertising' ELSE 'external_communications' END;
    NEW.sensitivity:='high';
  END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.status NOT IN ('idea','ai_generated','editing') THEN RAISE EXCEPTION 'New content must begin as an idea or draft.'; END IF;
    NEW.created_by:=coalesce(auth.uid(),NEW.created_by,(SELECT created_by FROM ai_generations WHERE id=NEW.generation_id AND organization_id=NEW.organization_id));
    NEW.approval_revision:=1; NEW.second_reviewer_id:=NULL;
    RETURN NEW;
  END IF;
  IF NEW.organization_id<>OLD.organization_id OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN RAISE EXCEPTION 'Content ownership cannot be changed.'; END IF;
  changed:=ROW(NEW.title,NEW.body,NEW.channel,NEW.platform,NEW.format,NEW.topic,NEW.hook,NEW.cta,NEW.approval_category,NEW.sensitivity,NEW.metadata->'seo') IS DISTINCT FROM ROW(OLD.title,OLD.body,OLD.channel,OLD.platform,OLD.format,OLD.topic,OLD.hook,OLD.cta,OLD.approval_category,OLD.sensitivity,OLD.metadata->'seo');
  IF changed AND OLD.status NOT IN ('idea','ai_generated','editing') THEN RAISE EXCEPTION 'Return this content to Editing before changing approved copy or classification.'; END IF;
  IF auth.uid() IS NOT NULL AND coalesce(current_setting('app.content_workflow',true),'')<>'on' AND (NEW.metadata->'publishing' IS DISTINCT FROM OLD.metadata->'publishing' OR NEW.metadata->'manual_post' IS DISTINCT FROM OLD.metadata->'manual_post') THEN RAISE EXCEPTION 'Publishing records cannot be edited directly.'; END IF;
  IF changed OR (NEW.status='editing' AND OLD.status<>NEW.status) THEN
    NEW.approval_revision:=OLD.approval_revision+1; NEW.second_reviewer_id:=NULL;
  ELSE NEW.approval_revision:=OLD.approval_revision; END IF;
  IF (NEW.status IN ('review','scheduled','published') OR NEW.status='approved' AND OLD.status='review') AND (OLD.status<>NEW.status OR NEW.scheduled_for IS DISTINCT FROM OLD.scheduled_for) THEN
    issue:=content_copy_problem(NEW.channel,NEW.platform,NEW.body,NEW.format);
    IF issue IS NOT NULL THEN RAISE EXCEPTION '%',issue; END IF;
  END IF;
  IF (NEW.status IN ('scheduled','published') OR NEW.status='approved' AND OLD.status='review') AND (OLD.status<>NEW.status OR NEW.scheduled_for IS DISTINCT FROM OLD.scheduled_for) AND NOT content_release_ready(OLD.id) THEN RAISE EXCEPTION 'Recorded approval is required for this revision.'; END IF;
  IF NEW.status='editing' THEN NEW.scheduled_for:=NULL; NEW.published_at:=NULL; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER content_revision_guard BEFORE INSERT OR UPDATE ON public.content_assets FOR EACH ROW EXECUTE FUNCTION public.guard_content_revision();

CREATE FUNCTION public.audit_content_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid:=coalesce(auth.uid(),nullif(current_setting('app.content_actor',true),'')::uuid); actor_role text; description text;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status OR OLD.scheduled_for IS DISTINCT FROM NEW.scheduled_for OR OLD.approval_revision<>NEW.approval_revision THEN
    SELECT role INTO actor_role FROM organization_members WHERE organization_id=NEW.organization_id AND user_id=actor;
    description:=nullif(current_setting('app.content_note',true),'');
    INSERT INTO asset_approvals(organization_id,content_asset_id,actor_id,actor_name,actor_role,from_status,to_status,note,approval_revision,previous_scheduled_for,scheduled_for)
    VALUES(NEW.organization_id,NEW.id,actor,coalesce(content_actor_name(actor),'Publishing service'),actor_role,OLD.status,NEW.status,coalesce(description,CASE WHEN OLD.scheduled_for IS DISTINCT FROM NEW.scheduled_for THEN 'Schedule changed' WHEN OLD.approval_revision<>NEW.approval_revision THEN 'Content revision changed; earlier approvals no longer apply' ELSE 'Status changed' END),NEW.approval_revision,OLD.scheduled_for,NEW.scheduled_for);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER content_change_audit AFTER UPDATE ON public.content_assets FOR EACH ROW EXECUTE FUNCTION public.audit_content_change();

CREATE FUNCTION public.workflow_transition_asset(p_asset uuid,p_to text,p_expected timestamptz,p_schedule timestamptz DEFAULT NULL,p_note text DEFAULT '',p_second uuid DEFAULT NULL,p_live_url text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a content_assets; actor uuid:=auth.uid(); member_role text; first_reviewer uuid; sensitive boolean; issue text; target text:=p_to;
BEGIN
  SELECT * INTO a FROM content_assets WHERE id=p_asset FOR UPDATE;
  SELECT role INTO member_role FROM organization_members WHERE organization_id=a.organization_id AND user_id=actor;
  IF a.id IS NULL OR actor IS NULL OR member_role IS NULL THEN RAISE EXCEPTION 'Content not found in your workspace.'; END IF;
  IF a.updated_at IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'This content changed. Refresh before trying again.'; END IF;
  IF a.metadata->'publishing' IS NOT NULL AND coalesce(a.metadata->'publishing'->>'state','')<>'failed' AND a.status='scheduled' THEN RAISE EXCEPTION 'Use the provider schedule controls for this post.'; END IF;
  IF NOT (CASE a.status WHEN 'idea' THEN p_to IN ('ai_generated','editing') WHEN 'ai_generated' THEN p_to='editing' WHEN 'editing' THEN p_to='review' WHEN 'review' THEN p_to IN ('editing','approved') WHEN 'approved' THEN p_to IN ('editing','scheduled','published') WHEN 'scheduled' THEN p_to IN ('approved','published') WHEN 'published' THEN p_to='analysing' ELSE false END) THEN RAISE EXCEPTION 'That status change is not allowed.'; END IF;
  IF p_to IN ('approved','scheduled','published','analysing') AND member_role NOT IN ('owner','admin','marketing_manager','leadership') THEN RAISE EXCEPTION 'This action requires a reviewer role.'; END IF;
  sensitive:=a.sensitivity='high' OR a.approval_category<>'standard';
  PERFORM set_config('app.content_workflow','on',true);
  PERFORM set_config('app.content_note',left(p_note,2000),true);
  IF p_to='approved' THEN
    IF actor=a.created_by THEN RAISE EXCEPTION 'Ask another reviewer to approve content you created.'; END IF;
    issue:=content_copy_problem(a.channel,a.platform,a.body,a.format); IF issue IS NOT NULL THEN RAISE EXCEPTION '%',issue; END IF;
    SELECT reviewer_id INTO first_reviewer FROM content_signoffs WHERE content_asset_id=a.id AND approval_revision=a.approval_revision AND tier=1;
    IF first_reviewer IS NULL THEN
      IF sensitive AND (p_second IS NULL OR p_second=actor OR p_second=a.created_by OR NOT EXISTS(SELECT 1 FROM organization_members WHERE organization_id=a.organization_id AND user_id=p_second AND role IN ('owner','admin','leadership'))) THEN RAISE EXCEPTION 'Name a different owner, admin or leader for the second approval.'; END IF;
      UPDATE content_assets SET second_reviewer_id=CASE WHEN sensitive THEN p_second ELSE NULL END WHERE id=a.id;
      INSERT INTO content_signoffs(organization_id,content_asset_id,approval_revision,tier,reviewer_id,reviewer_name,reviewer_role,note) VALUES(a.organization_id,a.id,a.approval_revision,1,actor,content_actor_name(actor),member_role,left(p_note,2000));
      IF sensitive THEN
        INSERT INTO asset_approvals(organization_id,content_asset_id,actor_id,actor_name,actor_role,from_status,to_status,note,approval_revision) VALUES(a.organization_id,a.id,actor,content_actor_name(actor),member_role,'review','review','First approval recorded; waiting for the named second reviewer. '||left(p_note,2000),a.approval_revision);
        target:='review';
      END IF;
    ELSE
      IF NOT sensitive OR actor=first_reviewer OR actor IS DISTINCT FROM a.second_reviewer_id OR member_role NOT IN ('owner','admin','leadership') THEN RAISE EXCEPTION 'Only the named second reviewer can give this approval.'; END IF;
      INSERT INTO content_signoffs(organization_id,content_asset_id,approval_revision,tier,reviewer_id,reviewer_name,reviewer_role,note) VALUES(a.organization_id,a.id,a.approval_revision,2,actor,content_actor_name(actor),member_role,left(p_note,2000));
    END IF;
  END IF;
  IF p_to='scheduled' AND (p_schedule IS NULL OR p_schedule<=now()+interval '1 minute') THEN RAISE EXCEPTION 'Choose a future publishing time.'; END IF;
  IF p_to='published' AND (p_live_url IS NULL OR p_live_url !~ '^https://[^/]+/.+') THEN RAISE EXCEPTION 'Use a connected publisher or record the live post link.'; END IF;
  UPDATE content_assets SET status=target,
    scheduled_for=CASE WHEN target='scheduled' THEN p_schedule WHEN target IN ('editing','approved') THEN NULL ELSE scheduled_for END,
    published_at=CASE WHEN target='published' THEN now() ELSE published_at END,
    metadata=CASE WHEN target='published' THEN metadata||jsonb_build_object('manual_post',jsonb_build_object('url',p_live_url,'recorded_by',actor,'recorded_at',now(),'from_status',a.status)) ELSE metadata END
    WHERE id=a.id;
  IF target='published' THEN INSERT INTO publications(organization_id,content_asset_id,channel,status,url,published_at,actor_id) VALUES(a.organization_id,a.id,coalesce(a.platform,a.channel,'manual'),'published',p_live_url,now(),actor); END IF;
  PERFORM set_config('app.content_workflow','',true); PERFORM set_config('app.content_note','',true);
  RETURN jsonb_build_object('status',target,'message',CASE WHEN p_to='approved' AND target='review' THEN 'First approval saved. The named reviewer must approve next.' ELSE 'Content updated.' END);
END $$;
REVOKE ALL ON FUNCTION public.workflow_transition_asset(uuid,text,timestamptz,timestamptz,text,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.workflow_transition_asset(uuid,text,timestamptz,timestamptz,text,uuid,text) TO authenticated;

CREATE FUNCTION public.save_content_draft(p_asset uuid,p_expected timestamptz,p_fields jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a content_assets;
BEGIN
  SELECT * INTO a FROM content_assets WHERE id=p_asset FOR UPDATE;
  IF NOT EXISTS(SELECT 1 FROM organization_members WHERE organization_id=a.organization_id AND user_id=auth.uid()) THEN RAISE EXCEPTION 'Content not found.'; END IF;
  IF a.updated_at IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'This draft changed. Refresh before saving.'; END IF;
  IF a.status NOT IN ('idea','ai_generated','editing') THEN RAISE EXCEPTION 'Return this content to Editing first.'; END IF;
  IF p_fields->>'approval_category' IS NOT NULL AND p_fields->>'approval_category' NOT IN ('standard','paid_advertising','external_communications','partnership_announcement','leadership_communications','crisis') THEN RAISE EXCEPTION 'Choose a valid approval category.'; END IF;
  UPDATE content_assets SET title=p_fields->>'title',body=p_fields->>'body',channel=p_fields->>'channel',platform=p_fields->>'channel',topic=p_fields->>'topic',hook=p_fields->>'hook',cta=p_fields->>'cta',metadata=coalesce(p_fields->'metadata',metadata),approval_category=coalesce(p_fields->>'approval_category',approval_category),sensitivity=CASE WHEN coalesce(p_fields->>'approval_category',approval_category)<>'standard' THEN 'high' WHEN p_fields->>'approval_category' IS DISTINCT FROM a.approval_category THEN 'standard' ELSE a.sensitivity END,status='editing' WHERE id=a.id;
END $$;
REVOKE ALL ON FUNCTION public.save_content_draft(uuid,timestamptz,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_content_draft(uuid,timestamptz,jsonb) TO authenticated;

CREATE FUNCTION public.content_reviewers(p_org uuid) RETURNS TABLE(id uuid,name text,role text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT m.user_id,content_actor_name(m.user_id),m.role FROM organization_members m
  WHERE m.organization_id=p_org AND m.role IN ('owner','admin','marketing_manager','leadership')
  AND EXISTS(SELECT 1 FROM organization_members caller WHERE caller.organization_id=p_org AND caller.user_id=auth.uid());
$$;
REVOKE ALL ON FUNCTION public.content_reviewers(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.content_reviewers(uuid) TO authenticated;

CREATE FUNCTION public.guard_publication_release() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM content_assets WHERE id=NEW.content_asset_id AND organization_id=NEW.organization_id) THEN RAISE EXCEPTION 'Publication workspace does not match its content.'; END IF;
  IF NEW.status IN ('queued','scheduled','published','missed') AND NOT content_release_ready(NEW.content_asset_id) THEN RAISE EXCEPTION 'Recorded approval is required before publishing.'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER publication_release_guard BEFORE INSERT OR UPDATE ON public.publications FOR EACH ROW EXECUTE FUNCTION public.guard_publication_release();
REVOKE INSERT,UPDATE,DELETE ON public.publications FROM authenticated,anon;
NOTIFY pgrst,'reload schema';



CREATE TABLE public.content_schedule_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  content_asset_id uuid NOT NULL REFERENCES public.content_assets(id),
  publication_id uuid NOT NULL REFERENCES public.publications(id),
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  previous_scheduled_for timestamptz,
  scheduled_for timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','complete','failed')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE UNIQUE INDEX content_schedule_pending ON public.content_schedule_changes(content_asset_id) WHERE status='pending';
ALTER TABLE public.content_schedule_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY content_schedule_changes_read ON public.content_schedule_changes FOR SELECT TO authenticated USING(organization_id IN(SELECT public.caller_organization_ids()));
GRANT SELECT ON public.content_schedule_changes TO authenticated;
GRANT ALL ON public.content_schedule_changes TO service_role;
REVOKE INSERT,UPDATE,DELETE ON public.content_schedule_changes FROM authenticated,anon;

CREATE FUNCTION public.prepare_content_schedule(p_asset uuid,p_expected timestamptz,p_at timestamptz DEFAULT NULL,p_note text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a content_assets; pub publications; actor uuid:=auth.uid(); change_id uuid;
BEGIN
  SELECT * INTO a FROM content_assets WHERE id=p_asset FOR UPDATE;
  IF NOT EXISTS(SELECT 1 FROM organization_members WHERE organization_id=a.organization_id AND user_id=actor AND role IN ('owner','admin','marketing_manager','leadership')) THEN RAISE EXCEPTION 'Scheduling requires a reviewer in this workspace.'; END IF;
  IF a.updated_at IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'This content changed. Refresh before scheduling.'; END IF;
  IF a.status NOT IN ('approved','scheduled') THEN RAISE EXCEPTION 'Approve this revision before scheduling it.'; END IF;
  IF EXISTS(SELECT 1 FROM content_schedule_changes WHERE content_asset_id=a.id AND status='pending') THEN RAISE EXCEPTION 'A provider schedule change needs recovery. Check its status first.'; END IF;
  IF p_at IS NOT NULL THEN
    IF p_at<=now()+interval '1 minute' THEN RAISE EXCEPTION 'Choose a publishing time in the future.'; END IF;
    PERFORM check_content_release(a.id,a.organization_id);
  END IF;
  IF a.metadata->'publishing' IS NOT NULL AND coalesce(a.metadata->'publishing'->>'state','')<>'failed' THEN
    IF a.metadata->'publishing'->>'provider'<>'wordpress' THEN RAISE EXCEPTION 'This post is queued in Buffer. Change its time in Buffer, then check delivery status here.'; END IF;
    SELECT * INTO pub FROM publications WHERE id=(a.metadata->'publishing'->>'publication_id')::uuid AND organization_id=a.organization_id AND content_asset_id=a.id AND channel='wordpress' AND status IN ('queued','scheduled','missed') FOR UPDATE;
    IF pub.id IS NULL OR pub.external_id IS NULL THEN RAISE EXCEPTION 'Recover the WordPress receipt before changing its schedule.'; END IF;
    INSERT INTO content_schedule_changes(organization_id,content_asset_id,publication_id,actor_id,previous_scheduled_for,scheduled_for) VALUES(a.organization_id,a.id,pub.id,actor,a.scheduled_for,p_at) RETURNING id INTO change_id;
    PERFORM set_config('app.content_workflow','on',true);
    UPDATE content_assets SET metadata=metadata||jsonb_build_object('schedule_change',change_id) WHERE id=a.id;
    PERFORM set_config('app.content_workflow','',true);
    RETURN jsonb_build_object('provider','wordpress','change_id',change_id,'post_id',pub.external_id,'previous_scheduled_for',a.scheduled_for,'scheduled_for',p_at);
  END IF;
  PERFORM set_config('app.content_note',coalesce(nullif(p_note,''),CASE WHEN p_at IS NULL THEN 'Removed from the calendar' WHEN a.status='scheduled' THEN 'Rescheduled from the calendar' ELSE 'Scheduled from the calendar' END),true);
  UPDATE content_assets SET status=CASE WHEN p_at IS NULL THEN 'approved' ELSE 'scheduled' END,scheduled_for=p_at WHERE id=a.id;
  PERFORM set_config('app.content_note','',true);
  RETURN jsonb_build_object('provider','calendar','status',CASE WHEN p_at IS NULL THEN 'approved' ELSE 'scheduled' END);
END $$;
REVOKE ALL ON FUNCTION public.prepare_content_schedule(uuid,timestamptz,timestamptz,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prepare_content_schedule(uuid,timestamptz,timestamptz,text) TO authenticated;

CREATE FUNCTION public.finish_content_schedule(p_change uuid,p_receipt jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE change content_schedule_changes; a content_assets; old_publication publications; new_id uuid:=gen_random_uuid(); remote_time timestamptz; next_metadata jsonb;
BEGIN
  IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'Provider verification is required.'; END IF;
  SELECT * INTO change FROM content_schedule_changes WHERE id=p_change FOR UPDATE;
  IF change.id IS NULL OR change.status<>'pending' THEN RAISE EXCEPTION 'There is no pending change to finish.'; END IF;
  SELECT * INTO a FROM content_assets WHERE id=change.content_asset_id FOR UPDATE;
  SELECT * INTO old_publication FROM publications WHERE id=change.publication_id FOR UPDATE;
  IF a.status<>'scheduled' OR a.metadata->>'schedule_change' IS DISTINCT FROM change.id::text THEN RAISE EXCEPTION 'The content changed during provider verification. Check delivery status.'; END IF;
  IF p_receipt->>'id' IS DISTINCT FROM old_publication.external_id THEN RAISE EXCEPTION 'The provider returned a different post.'; END IF;
  IF change.scheduled_for IS NOT NULL THEN
    remote_time:=(p_receipt->>'date_gmt')::timestamp AT TIME ZONE 'UTC';
    IF p_receipt->>'status' IS DISTINCT FROM 'future' OR remote_time IS NULL OR abs(extract(epoch from(remote_time-change.scheduled_for)))>1 THEN RAISE EXCEPTION 'WordPress has not confirmed the requested publishing time.'; END IF;
  ELSIF p_receipt->>'status' IS DISTINCT FROM 'draft' THEN RAISE EXCEPTION 'WordPress has not confirmed that this post is a draft.'; END IF;
  PERFORM set_config('app.content_workflow','on',true);
  PERFORM set_config('app.content_actor',change.actor_id::text,true);
  PERFORM set_config('app.content_note',CASE WHEN change.scheduled_for IS NULL THEN 'Unscheduled on WordPress' ELSE 'Rescheduled on WordPress' END,true);
  UPDATE publications SET status='cancelled',error=CASE WHEN change.scheduled_for IS NULL THEN 'Unscheduled by a reviewer' ELSE 'Rescheduled to '||change.scheduled_for::text END,updated_at=now() WHERE id=old_publication.id;
  next_metadata:=a.metadata-'schedule_change';
  IF change.scheduled_for IS NULL THEN
    next_metadata:=next_metadata-'publishing'-'wordpress_url';
  ELSE
    INSERT INTO publications(id,organization_id,content_asset_id,channel,external_id,url,status,scheduled_for,actor_id,remote_status,last_synced_at)
    VALUES(new_id,a.organization_id,a.id,'wordpress',old_publication.external_id,p_receipt->>'link','scheduled',change.scheduled_for,change.actor_id,'future',now());
    next_metadata:=jsonb_set(next_metadata,'{publishing}',jsonb_build_object('provider','wordpress','publication_id',new_id));
  END IF;
  UPDATE content_assets SET status=CASE WHEN change.scheduled_for IS NULL THEN 'approved' ELSE 'scheduled' END,scheduled_for=change.scheduled_for,metadata=next_metadata WHERE id=a.id;
  UPDATE content_schedule_changes SET status='complete',completed_at=now() WHERE id=change.id;
  PERFORM set_config('app.content_workflow','',true); PERFORM set_config('app.content_actor','',true); PERFORM set_config('app.content_note','',true);
  RETURN jsonb_build_object('status',CASE WHEN change.scheduled_for IS NULL THEN 'approved' ELSE 'scheduled' END);
END $$;
REVOKE ALL ON FUNCTION public.finish_content_schedule(uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finish_content_schedule(uuid,jsonb) TO service_role;
CREATE FUNCTION public.abort_content_schedule(p_change uuid,p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE change content_schedule_changes;
BEGIN
  IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'Provider verification is required.'; END IF;
  SELECT * INTO change FROM content_schedule_changes WHERE id=p_change FOR UPDATE;
  IF change.id IS NULL OR change.status<>'pending' THEN RAISE EXCEPTION 'No pending schedule change.'; END IF;
  UPDATE content_assets SET metadata=metadata-'schedule_change' WHERE id=change.content_asset_id AND metadata->>'schedule_change'=change.id::text;
  UPDATE content_schedule_changes SET status='failed',error=left(p_reason,1000),completed_at=now() WHERE id=change.id;
  INSERT INTO asset_approvals(organization_id,content_asset_id,actor_id,actor_name,actor_role,from_status,to_status,note,approval_revision)
  SELECT a.organization_id,a.id,change.actor_id,content_actor_name(change.actor_id),m.role,a.status,a.status,'Provider schedule change stopped: '||left(p_reason,1000),a.approval_revision FROM content_assets a LEFT JOIN organization_members m ON m.organization_id=a.organization_id AND m.user_id=change.actor_id WHERE a.id=change.content_asset_id;
END $$;
REVOKE ALL ON FUNCTION public.abort_content_schedule(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.abort_content_schedule(uuid,text) TO service_role;
NOTIFY pgrst,'reload schema';


COMMIT;
