BEGIN;
CREATE OR REPLACE FUNCTION public.content_copy_problem(p_channel text,p_platform text,p_body text,p_format text) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE channel text:=lower(coalesce(nullif(nullif(p_channel,''),'social'),p_platform,'')); cap integer; part text; count_chars integer; parts text[]; posts text[];
BEGIN
  IF btrim(coalesce(p_body,''))='' THEN RETURN 'Add the content before requesting approval.'; END IF;
  IF channel IN ('','social') THEN channel:=lower(coalesce(p_channel,'')); END IF;
  IF channel IN ('','social') THEN RETURN 'Choose a platform before requesting approval.'; END IF;
  cap:=CASE channel WHEN 'x' THEN 280 WHEN 'twitter' THEN 280 WHEN 'linkedin' THEN 3000 WHEN 'instagram' THEN 2200 WHEN 'facebook' THEN 63206 WHEN 'tiktok' THEN 4000 WHEN 'youtube' THEN 5000 WHEN 'threads' THEN 500 WHEN 'bluesky' THEN 300 WHEN 'mastodon' THEN 500 ELSE NULL END;
  -- A clip brief is production guidance; a video caption is ordinary channel copy.
  IF p_format='short-form video' THEN RETURN NULL; END IF;
  IF channel IN ('x','twitter') THEN
    parts:=string_to_array(replace(p_body,E'\r',''),'— Optional thread (post each separately) —');
    IF array_length(parts,1)>2 THEN RETURN 'Use a single optional-thread separator.'; END IF;
    posts:=ARRAY[parts[1]];
    IF array_length(parts,1)=2 THEN posts:=posts||regexp_split_to_array(btrim(parts[2]),E'\n\n+'); END IF;
    FOREACH part IN ARRAY posts LOOP
      count_chars:=char_length(regexp_replace(btrim(part),'https?://[^[:space:]]+',repeat('x',23),'g'));
      IF count_chars>cap THEN RETURN 'X allows 280 characters per post. Shorten the copy.'; END IF;
    END LOOP;
  ELSIF cap IS NOT NULL AND char_length(p_body)>cap THEN RETURN initcap(channel)||' allows '||cap||' characters. Shorten the copy.';
  END IF;
  IF channel='instagram' AND (SELECT count(*) FROM regexp_matches(p_body,'(^|[[:space:]])#[[:alnum:]_]+','g'))>30 THEN RETURN 'Instagram allows 30 hashtags.'; END IF;
  RETURN NULL;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
