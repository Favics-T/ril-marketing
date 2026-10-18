import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

let db: PGlite;
const org="10000000-0000-0000-0000-000000000001", other="10000000-0000-0000-0000-000000000002";
const author="20000000-0000-0000-0000-000000000001", reviewer="20000000-0000-0000-0000-000000000002", leader="20000000-0000-0000-0000-000000000003", outsider="20000000-0000-0000-0000-000000000004";
const asset="30000000-0000-0000-0000-000000000001";
const migration=new URL("../../../supabase/migrations/20261015133111_content_approval_and_calendar_workflow.sql",import.meta.url);
beforeAll(async()=>{
  db=new PGlite();
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.role',true),'') $$;
    GRANT USAGE ON SCHEMA public,auth TO authenticated,anon,service_role;
    CREATE TABLE organizations(id uuid PRIMARY KEY);
    CREATE TABLE organization_members(organization_id uuid,user_id uuid,role text);
    CREATE FUNCTION caller_organization_ids() RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER AS $$ SELECT organization_id FROM organization_members WHERE user_id=auth.uid() $$;
    CREATE TABLE ai_generations(id uuid PRIMARY KEY,organization_id uuid,created_by uuid);
    CREATE TABLE content_assets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,title text NOT NULL,body text,channel text,platform text,format text,topic text,hook text,cta text,sensitivity text DEFAULT 'standard',status text DEFAULT 'editing',metadata jsonb NOT NULL DEFAULT '{}',generation_id uuid,scheduled_for timestamptz,published_at timestamptz,created_at timestamptz DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp());
    CREATE TABLE asset_approvals(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid,content_asset_id uuid,actor_id uuid,from_status text,to_status text,note text,created_at timestamptz DEFAULT clock_timestamp());
    CREATE TABLE publications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid,content_asset_id uuid,channel text,status text,url text,actor_id uuid,published_at timestamptz,external_id text,scheduled_for timestamptz,remote_status text,last_synced_at timestamptz,updated_at timestamptz DEFAULT now(),error text);
    CREATE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=clock_timestamp(); RETURN NEW; END $$;
    CREATE TRIGGER content_updated BEFORE UPDATE ON content_assets FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated,service_role;
    ALTER TABLE content_assets ENABLE ROW LEVEL SECURITY;
    CREATE POLICY content_assets_isolation ON content_assets FOR ALL USING(organization_id IN(SELECT caller_organization_ids())) WITH CHECK(organization_id IN(SELECT caller_organization_ids()));
    ALTER TABLE asset_approvals ENABLE ROW LEVEL SECURITY;
    CREATE POLICY asset_approvals_isolation ON asset_approvals FOR ALL USING(organization_id IN(SELECT caller_organization_ids())) WITH CHECK(organization_id IN(SELECT caller_organization_ids()));
    INSERT INTO organizations VALUES('${org}'),('${other}');
    INSERT INTO auth.users(id,email) VALUES('${author}','Author'),('${reviewer}','Reviewer'),('${leader}','Leader'),('${outsider}','Other workspace');
    INSERT INTO organization_members VALUES('${org}','${author}','owner'),('${org}','${reviewer}','marketing_manager'),('${org}','${leader}','leadership'),('${other}','${outsider}','owner');
  `);
  await db.exec(await readFile(migration,"utf8"));
  await db.exec(await readFile(new URL("../../../supabase/migrations/20261015133925_harden_content_copy_limits.sql",import.meta.url),"utf8"));
},30000);
beforeEach(async()=>{
  await db.exec(`BEGIN; RESET ROLE; SELECT set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claim.role','service_role',true); INSERT INTO content_assets(id,organization_id,title,body,channel,platform,created_by) VALUES('${asset}','${org}','Test content','Approved facts','linkedin','linkedin','${author}');`);
});
afterEach(async()=>{await db.exec("ROLLBACK; RESET ROLE;");});
afterAll(async()=>{await db.close();});
it("backfills activity timestamps without inventing recent edits and tracks later changes", async () => {
  await db.exec("CREATE TABLE activities(id integer PRIMARY KEY, title text, created_at timestamptz NOT NULL DEFAULT now()); INSERT INTO activities VALUES(1,'Original','2026-09-01T12:00:00Z');");
  const sql = await readFile(new URL("../../../supabase/migrations/20261017000000_activities_updated_at.sql", import.meta.url), "utf8");
  await db.exec(sql);
  const before = (await db.query<{ created_at: Date; updated_at: Date }>("SELECT created_at,updated_at FROM activities WHERE id=1")).rows[0];
  expect(before.updated_at).toEqual(before.created_at);
  await db.exec("UPDATE activities SET title='Edited' WHERE id=1");
  const after = (await db.query<{ created_at: Date; updated_at: Date }>("SELECT created_at,updated_at FROM activities WHERE id=1")).rows[0];
  expect(after.created_at).toEqual(before.created_at);
  expect(after.updated_at.getTime()).toBeGreaterThan(before.updated_at.getTime());
  await db.exec(sql);
  expect((await db.query<{ updated_at: Date }>("SELECT updated_at FROM activities WHERE id=1")).rows[0].updated_at).toEqual(after.updated_at);
});
async function as(user=reviewer,role="authenticated") { await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub','${user}',true),set_config('request.jwt.claim.role','${role}',true); SET ROLE ${role};`); }
async function row() { return (await db.query<{status:string;updated_at:Date;approval_revision:number;second_reviewer_id:string}>("select status,updated_at,approval_revision,second_reviewer_id from content_assets where id=$1",[asset])).rows[0]; }
async function move(to:string,second:string|null=null,schedule:string|null=null) { const a=await row(); return db.query("select workflow_transition_asset($1,$2,$3,$4,'Test decision',$5) as result",[asset,to,a.updated_at.toISOString(),schedule,second]); }
async function rejected(run:()=>Promise<unknown>,message:RegExp) {
  await db.exec("SAVEPOINT expected_failure;");
  let error:unknown;try{await run();}catch(e){error=e;}
  await db.exec("ROLLBACK TO SAVEPOINT expected_failure;");
  expect(String(error)).toMatch(message);
}
async function review(sensitive=false) {
  if(sensitive) await db.exec(`UPDATE content_assets SET approval_category='crisis',sensitivity='high' WHERE id='${asset}';`);
  await as(author); await move("review"); await as(reviewer);
}
describe("database-enforced content workflow",()=>{
  it("blocks direct status and audit-history writes through the authenticated database role",async()=>{
    await as();
    await rejected(()=>db.query("update content_assets set status='approved' where id=$1",[asset]),/permission denied/);
    await rejected(()=>db.query("insert into asset_approvals(content_asset_id) values($1)",[asset]),/permission denied/);
    await rejected(()=>db.query("delete from asset_approvals where content_asset_id=$1",[asset]),/permission denied/);
    await rejected(()=>db.query("insert into publications(content_asset_id,status) values($1,'published')",[asset]),/permission denied/);
  });
  it("requires an independent reviewer and writes the decision and audit atomically",async()=>{
    await review(); await as(author); await rejected(()=>move("approved"),/another reviewer/);
    await as(reviewer); await move("approved"); expect((await row()).status).toBe("approved");
    expect((await db.query("select reviewer_name from content_signoffs where content_asset_id=$1",[asset])).rows).toEqual([{reviewer_name:"Reviewer"}]);
    expect((await db.query("select actor_name from asset_approvals where content_asset_id=$1 and to_status='approved'",[asset])).rows).toEqual([{actor_name:"Reviewer"}]);
    await move("scheduled",null,new Date(Date.now()+86400000).toISOString()); expect((await row()).status).toBe("scheduled");
  });
  it("keeps sensitive content in Review until its named second reviewer signs",async()=>{
    await review(true);
    await rejected(()=>move("approved"),/Name a different/);
    await move("approved",leader); expect((await row()).status).toBe("review");
    await rejected(()=>move("approved",leader),/Only the named/);
    await rejected(()=>db.query("select check_content_release($1,$2)",[asset,org]),/recorded approval/i);
    await as(leader); await move("approved"); expect((await row()).status).toBe("approved");
    expect((await db.query("select count(*)::int as n from content_signoffs where content_asset_id=$1",[asset])).rows[0]).toEqual({n:2});
  });
  it("invalidates previous decisions when content returns to Editing",async()=>{
    await review(); await move("approved"); const old=await row();
    await rejected(()=>db.query("update content_assets set body='Changed after approval' where id=$1",[asset]),/Editing/);
    await move("editing"); expect((await row()).approval_revision).toBe(old.approval_revision+1);
    await rejected(()=>db.query("select check_content_release($1,$2)",[asset,org]),/recorded approval/i);
  });
  it("rolls back sign-off and status if the audit trail cannot be written",async()=>{
    await review();
    await db.exec(`RESET ROLE; CREATE FUNCTION fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Audit unavailable'; END $$; CREATE TRIGGER fail_audit BEFORE INSERT ON asset_approvals FOR EACH ROW EXECUTE FUNCTION fail_audit();`);
    await as(reviewer); await rejected(()=>move("approved"),/Audit unavailable/);
    expect((await row()).status).toBe("review");
    expect((await db.query("select count(*)::int as n from content_signoffs where content_asset_id=$1",[asset])).rows[0]).toEqual({n:0});
  });
  it("rejects stale status changes and cross-workspace access",async()=>{
    await review(); await rejected(()=>db.query("select workflow_transition_asset($1,'approved','2000-01-01'::timestamptz)",[asset]),/changed/);
    await as(outsider); await rejected(()=>db.query("select workflow_transition_asset($1,'approved',now())",[asset]),/not found/);
  });
  it("enforces copy limits in SQL including X links and individual thread parts",async()=>{
    const result=await db.query<{problem:string|null}>("select content_copy_problem('x','x',$1,'social post') as problem",["a".repeat(281)]); expect(result.rows[0].problem).toMatch(/280/);
    const link=await db.query<{problem:string|null}>("select content_copy_problem('x','x',$1,'social post') as problem",["a".repeat(250)+" https://example.org/"+"b".repeat(200)]); expect(link.rows[0].problem).toBeNull();
    const thread=await db.query<{problem:string|null}>("select content_copy_problem('x','x',$1,'social post') as problem",["a".repeat(270)+"\n\n— Optional thread (post each separately) —\n\n"+"b".repeat(270)]); expect(thread.rows[0].problem).toBeNull();
    const paragraphs=await db.query<{problem:string|null}>("select content_copy_problem('x','website',$1,'social post') as problem",["a".repeat(200)+"\n\n"+"b".repeat(200)]); expect(paragraphs.rows[0].problem).toMatch(/280/);
  });
  it("blocks provider publication records for content without recorded sign-off",async()=>{
    await as("","service_role"); await rejected(()=>db.query("insert into publications(organization_id,content_asset_id,status) values($1,$2,'queued')",[org,asset]),/Recorded approval/);
  });
  it("reschedules and unschedules calendar items with an immutable time history", async () => {
    await review(); await move("approved");
    const first = new Date(Date.now() + 86400000).toISOString();
    await db.query("select prepare_content_schedule($1,$2,$3)", [asset, (await row()).updated_at.toISOString(), first]);
    const next = new Date(Date.now() + 172800000).toISOString();
    await db.query("select prepare_content_schedule($1,$2,$3)", [asset, (await row()).updated_at.toISOString(), next]);
    const history = await db.query<{actor_name: string; previous_scheduled_for: Date; scheduled_for: Date}>("select actor_name,previous_scheduled_for,scheduled_for from asset_approvals where note='Rescheduled from the calendar'");
    expect(history.rows[0].actor_name).toBe("Reviewer");
    expect(history.rows[0].previous_scheduled_for.toISOString()).toBe(first);
    expect(history.rows[0].scheduled_for.toISOString()).toBe(next);
    await db.query("select prepare_content_schedule($1,$2,null)", [asset, (await row()).updated_at.toISOString()]);
    expect((await row()).status).toBe("approved");
  });
  it("confirms WordPress rescheduling before replacing the previous publication receipt", async () => {
    await review(); await move("approved");
    const first = new Date(Date.now() + 86400000).toISOString();
    const next = new Date(Date.now() + 172800000).toISOString();
    await move("scheduled", null, first);
    await as("", "service_role");
    const pub = (await db.query<{id: string}>("insert into publications(organization_id,content_asset_id,channel,status,external_id,scheduled_for) values($1,$2,'wordpress','queued','42',$3) returning id", [org,asset,first])).rows[0].id;
    await db.query("update content_assets set metadata=jsonb_build_object('publishing',jsonb_build_object('provider','wordpress','publication_id',$2::text)) where id=$1", [asset,pub]);
    await as(reviewer);
    const change = (await db.query<{result: {change_id: string}}>("select prepare_content_schedule($1,$2,$3) as result", [asset,(await row()).updated_at.toISOString(),next])).rows[0].result;
    expect((await row()).status).toBe("scheduled");
    await rejected(() => db.query("select finish_content_schedule($1,$2)", [change.change_id, {id:42,status:"future",date_gmt:next.slice(0,-1)}]), /permission denied/);
    await as("", "service_role");
    await rejected(() => db.query("select finish_content_schedule($1,$2)", [change.change_id,{id:42,status:"future",date_gmt:first.slice(0,-1)}]), /not confirmed/);
    expect((await db.query<{status:string}>("select status from publications where id=$1",[pub])).rows[0].status).toBe("queued");
    await db.query("select finish_content_schedule($1,$2)",[change.change_id,{id:42,status:"future",date_gmt:next.slice(0,-1),link:"https://example.org/article"}]);
    expect((await db.query<{status:string}>("select status from publications where id=$1",[pub])).rows[0].status).toBe("cancelled");
    const active = await db.query<{status:string; external_id:string}>("select status,external_id from publications where status='scheduled'");
    expect(active.rows).toEqual([{status:"scheduled",external_id:"42"}]);
    expect((await db.query<{actor_name:string}>("select actor_name from asset_approvals where note='Rescheduled on WordPress'")).rows[0].actor_name).toBe("Reviewer");
    await as(reviewer);
    const cancel = (await db.query<{result:{change_id:string}}>("select prepare_content_schedule($1,$2,null) as result",[asset,(await row()).updated_at.toISOString()])).rows[0].result;
    await as("","service_role");
    await db.query("select finish_content_schedule($1,$2)",[cancel.change_id,{id:42,status:"draft"}]);
    expect((await row()).status).toBe("approved");
  });
});
