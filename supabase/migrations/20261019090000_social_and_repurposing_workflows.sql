BEGIN;

CREATE TABLE public.publishing_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id),
  content_asset_id uuid NOT NULL REFERENCES content_assets(id), publication_id uuid REFERENCES publications(id),
  kind text NOT NULL CHECK(kind IN ('delivery_failed','recurring_draft')), message text NOT NULL,
  acknowledged_by uuid REFERENCES auth.users(id), acknowledged_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX publishing_failure_once ON publishing_alerts(publication_id) WHERE publication_id IS NOT NULL;
ALTER TABLE publishing_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY publishing_alert_read ON publishing_alerts FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM organization_members m WHERE m.organization_id=publishing_alerts.organization_id AND m.user_id=auth.uid() AND m.role IN ('owner','admin','marketing_manager','leadership')));
GRANT SELECT ON publishing_alerts TO authenticated;
GRANT ALL ON publishing_alerts TO service_role;

CREATE FUNCTION public.alert_failed_publication() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.status='failed' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO publishing_alerts(organization_id,content_asset_id,publication_id,kind,message)
    VALUES(NEW.organization_id,NEW.content_asset_id,NEW.id,'delivery_failed',left(coalesce(NEW.error,'Publishing failed. Review the post and reconnect its account before retrying.'),1000)) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER publication_failure_alert AFTER INSERT OR UPDATE ON publications FOR EACH ROW EXECUTE FUNCTION alert_failed_publication();
INSERT INTO publishing_alerts(organization_id,content_asset_id,publication_id,kind,message)
SELECT organization_id,content_asset_id,id,'delivery_failed',left(coalesce(error,'A previous publishing attempt failed. Review its delivery history.'),1000)
FROM publications WHERE status='failed' ON CONFLICT DO NOTHING;

CREATE TABLE public.recurring_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id),
  content_asset_id uuid NOT NULL REFERENCES content_assets(id), created_by uuid NOT NULL REFERENCES auth.users(id),
  cadence text NOT NULL CHECK(cadence IN ('daily','weekly','monthly')), next_due timestamptz NOT NULL,
  remaining integer NOT NULL CHECK(remaining BETWEEN 0 AND 52), enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE recurring_content ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX recurring_one_active ON recurring_content(content_asset_id) WHERE enabled;
CREATE POLICY recurring_read ON recurring_content FOR SELECT TO authenticated USING(organization_id IN(SELECT caller_organization_ids()));
GRANT SELECT ON recurring_content TO authenticated;
GRANT ALL ON recurring_content TO service_role;
CREATE TRIGGER recurring_updated BEFORE UPDATE ON recurring_content FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE FUNCTION public.prepare_recurring_content(p_rule uuid,p_due timestamptz) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r recurring_content; a content_assets; made uuid; next_time timestamptz;
BEGIN
  SELECT * INTO r FROM recurring_content WHERE id=p_rule FOR UPDATE;
  IF NOT FOUND OR NOT r.enabled OR r.remaining=0 OR r.next_due IS DISTINCT FROM p_due OR r.next_due>now()+interval '7 days' THEN RETURN NULL; END IF;
  IF NOT EXISTS(SELECT 1 FROM organization_members WHERE organization_id=r.organization_id AND user_id=r.created_by AND role IN ('owner','admin','marketing_manager','leadership')) THEN
    UPDATE recurring_content SET enabled=false WHERE id=r.id; RETURN NULL;
  END IF;
  SELECT * INTO a FROM content_assets WHERE id=r.content_asset_id AND organization_id=r.organization_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  INSERT INTO content_assets(organization_id,title,body,channel,platform,format,topic,hook,cta,status,created_by,approval_category,sensitivity,metadata)
  VALUES(r.organization_id,a.title,a.body,a.channel,a.platform,a.format,a.topic,a.hook,a.cta,'editing',r.created_by,a.approval_category,a.sensitivity,
    (coalesce(a.metadata,'{}')-'publishing'-'manual_post'-'published_url'-'wordpress_post_id'-'wordpress_url')||jsonb_build_object('recurrence_id',r.id,'repeated_from',a.id,'suggested_publish_at',r.next_due,'recurrence_requires_review',true)) RETURNING id INTO made;
  next_time:=r.next_due+CASE r.cadence WHEN 'daily' THEN interval '1 day' WHEN 'weekly' THEN interval '7 days' ELSE interval '1 month' END;
  WHILE next_time<=now() LOOP next_time:=next_time+CASE r.cadence WHEN 'daily' THEN interval '1 day' WHEN 'weekly' THEN interval '7 days' ELSE interval '1 month' END; END LOOP;
  UPDATE recurring_content SET next_due=next_time,remaining=remaining-1,enabled=remaining>1 WHERE id=r.id;
  INSERT INTO publishing_alerts(organization_id,content_asset_id,kind,message) VALUES(r.organization_id,made,'recurring_draft','A recurring draft is ready for human review. Approve it and confirm its proposed publishing time.');
  RETURN made;
END $$;
REVOKE ALL ON FUNCTION prepare_recurring_content(uuid,timestamptz) FROM PUBLIC,authenticated;
GRANT EXECUTE ON FUNCTION prepare_recurring_content(uuid,timestamptz) TO service_role;

CREATE TABLE public.repurposing_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id), created_by uuid NOT NULL REFERENCES auth.users(id),
  title text NOT NULL CHECK(length(title) BETWEEN 2 AND 200), source_kind text NOT NULL CHECK(source_kind IN ('activity','attachment','url','transcript','summary')),
  activity_id uuid, attachment_id uuid, source_url text, input_text text NOT NULL DEFAULT '', manual_summary text NOT NULL DEFAULT '',
  requested_kinds text[] NOT NULL, options jsonb NOT NULL DEFAULT '{}', analysis jsonb NOT NULL DEFAULT '{}',
  completed_kinds text[] NOT NULL DEFAULT '{}', asset_ids uuid[] NOT NULL DEFAULT '{}',
  revision integer NOT NULL DEFAULT 1, status text NOT NULL DEFAULT 'idea' CHECK(status IN ('idea','processing','completed')),
  error text, run_token uuid, processing_started_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(length(input_text)<=50000 AND length(manual_summary)<=50000), CHECK(cardinality(requested_kinds) BETWEEN 1 AND 4),
  CHECK(requested_kinds <@ ARRAY['blog','newsletter','social_pack','short_form']::text[])
);
ALTER TABLE repurposing_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY source_read ON repurposing_sources FOR SELECT TO authenticated USING(organization_id IN(SELECT caller_organization_ids()));
GRANT SELECT ON repurposing_sources TO authenticated;
GRANT ALL ON repurposing_sources TO service_role;
CREATE TRIGGER repurposing_source_updated BEFORE UPDATE ON repurposing_sources FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE public.repurposing_outputs (
  organization_id uuid NOT NULL REFERENCES organizations(id), source_id uuid NOT NULL REFERENCES repurposing_sources(id), revision integer NOT NULL,
  slot text NOT NULL, asset_id uuid NOT NULL REFERENCES content_assets(id), PRIMARY KEY(source_id,revision,slot)
);
ALTER TABLE repurposing_outputs ENABLE ROW LEVEL SECURITY;
CREATE POLICY output_read ON repurposing_outputs FOR SELECT TO authenticated USING(organization_id IN(SELECT caller_organization_ids()));
GRANT SELECT ON repurposing_outputs TO authenticated;
GRANT ALL ON repurposing_outputs TO service_role;

CREATE FUNCTION public.finish_repurposing(p_source uuid,p_org uuid,p_token uuid,p_drafts jsonb,p_model text,p_completed text[],p_error text DEFAULT NULL) RETURNS uuid[]
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s repurposing_sources; d jsonb; made uuid; generation uuid; ids uuid[]; slot_key text; idx integer:=0;
BEGIN
  SELECT * INTO s FROM repurposing_sources WHERE id=p_source AND organization_id=p_org FOR UPDATE;
  IF NOT FOUND OR s.status<>'processing' OR s.run_token IS DISTINCT FROM p_token THEN RAISE EXCEPTION 'This source run changed. Refresh before retrying.'; END IF;
  IF jsonb_typeof(p_drafts)<>'array' OR jsonb_array_length(p_drafts)>20 THEN RAISE EXCEPTION 'Invalid generated output.'; END IF;
  IF NOT p_completed <@ s.requested_kinds THEN RAISE EXCEPTION 'Unexpected output format.'; END IF;
  IF jsonb_array_length(p_drafts)>0 THEN
    INSERT INTO ai_generations(organization_id,activity_id,created_by,kind,model) VALUES(p_org,s.activity_id,s.created_by,'source_repurposing',p_model) RETURNING id INTO generation;
  END IF;
  FOR d IN SELECT value FROM jsonb_array_elements(p_drafts) LOOP
    idx:=idx+1;
    IF coalesce(d->>'kind','') NOT IN ('blog','newsletter','social','short_clip') OR length(coalesce(d->>'body',''))<1 THEN RAISE EXCEPTION 'Incomplete generated draft.'; END IF;
    slot_key:=(d->>'kind')||':'||coalesce(d->>'platform',d->>'channel','')||CASE WHEN d->>'kind'='short_clip' THEN ':'||idx::text ELSE '' END;
    IF EXISTS(SELECT 1 FROM repurposing_outputs WHERE source_id=s.id AND revision=s.revision AND slot=slot_key) THEN CONTINUE; END IF;
    INSERT INTO content_assets(organization_id,title,body,channel,platform,format,topic,hook,cta,status,created_by,source_activity_id,generation_id,metadata)
    VALUES(p_org,left(d->>'title',200),d->>'body',d->>'channel',d->>'platform',d->>'format',d->>'topic',d->>'hook',d->>'cta','ai_generated',s.created_by,s.activity_id,generation,
      coalesce(d->'metadata','{}')||jsonb_build_object('repurposing_source_id',s.id,'source_revision',s.revision,'source_kind',s.source_kind,'source_url',s.source_url,'source_attachment_id',s.attachment_id,'ai_generated',true)) RETURNING id INTO made;
    INSERT INTO repurposing_outputs VALUES(p_org,s.id,s.revision,slot_key,made);
  END LOOP;
  SELECT coalesce(array_agg(asset_id),'{}'::uuid[]) INTO ids FROM repurposing_outputs WHERE source_id=s.id AND revision=s.revision;
  UPDATE repurposing_sources SET asset_ids=ids,completed_kinds=ARRAY(SELECT DISTINCT unnest(s.completed_kinds||p_completed)),
    status=CASE WHEN p_error IS NULL THEN 'completed' ELSE 'idea' END,error=p_error,run_token=NULL WHERE id=s.id;
  RETURN ids;
END $$;
REVOKE ALL ON FUNCTION finish_repurposing(uuid,uuid,uuid,jsonb,text,text[],text) FROM PUBLIC,authenticated;
GRANT EXECUTE ON FUNCTION finish_repurposing(uuid,uuid,uuid,jsonb,text,text[],text) TO service_role;

-- Media and edited clip instructions belong to the revision a person signs.
DO $$ DECLARE definition text; revised text; BEGIN
  definition:=pg_get_functiondef('public.guard_content_revision()'::regprocedure);
  revised:=replace(replace(definition,'NEW.metadata->''seo'')','NEW.metadata->''seo'',NEW.metadata->''social_post'',NEW.metadata->''clip_edit'')'),'OLD.metadata->''seo'')','OLD.metadata->''seo'',OLD.metadata->''social_post'',OLD.metadata->''clip_edit'')');
  IF revised=definition THEN RAISE EXCEPTION 'Review the content revision guard before adding media approval.'; END IF;
  EXECUTE revised;
END $$;

COMMIT;
