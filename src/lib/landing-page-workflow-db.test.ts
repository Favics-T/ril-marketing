import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

let db: PGlite;
const org = "10000000-0000-0000-0000-000000000001", other = "10000000-0000-0000-0000-000000000002";
const author = "20000000-0000-0000-0000-000000000001", reviewer = "20000000-0000-0000-0000-000000000002", publisher = "20000000-0000-0000-0000-000000000003", viewer = "20000000-0000-0000-0000-000000000004";
const campaign = "30000000-0000-0000-0000-000000000001", foreignCampaign = "30000000-0000-0000-0000-000000000002", page = "40000000-0000-0000-0000-000000000001";
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE SCHEMA auth; CREATE ROLE authenticated;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.role',true),'') $$;
    CREATE TABLE organizations(id uuid PRIMARY KEY);
    CREATE TABLE organization_members(organization_id uuid,user_id uuid,role text);
    CREATE TABLE campaigns(id uuid PRIMARY KEY,organization_id uuid);
    CREATE TABLE activities(id uuid PRIMARY KEY,organization_id uuid);
    CREATE TABLE audience_segments(id uuid PRIMARY KEY,organization_id uuid);
    CREATE TABLE landing_pages(id uuid PRIMARY KEY,organization_id uuid,campaign_id uuid,activity_id uuid,audience_segment_id uuid,title text DEFAULT 'Internal title',slug text DEFAULT 'programme',headline text DEFAULT 'Meet your peers',body text DEFAULT '',cta_label text DEFAULT 'Register',registration_url text,meta_description text DEFAULT '',metadata jsonb DEFAULT '{}',created_by uuid,approved_by uuid,published_by uuid,status text DEFAULT 'draft');
    GRANT USAGE ON SCHEMA auth,public TO authenticated;
    GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
    ALTER TABLE landing_pages ENABLE ROW LEVEL SECURITY;
    CREATE POLICY isolation ON landing_pages USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id=auth.uid())) WITH CHECK (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id=auth.uid()));
    INSERT INTO organizations VALUES('${org}'),('${other}');
    INSERT INTO organization_members VALUES('${org}','${author}','owner'),('${org}','${reviewer}','marketing_manager'),('${org}','${publisher}','admin'),('${org}','${viewer}','viewer');
    INSERT INTO campaigns VALUES('${campaign}','${org}'),('${foreignCampaign}','${other}');
  `);
  await db.exec(await readFile(new URL("../../supabase/migrations/20261025000001_landing_page_approval.sql", import.meta.url), "utf8"));
}, 90000);
beforeEach(async () => {
  await db.exec("BEGIN;");
  await as(author);
  await db.query("INSERT INTO landing_pages(id,organization_id,campaign_id) VALUES($1,$2,$3)", [page, org, campaign]);
});
afterEach(async () => { await db.exec("ROLLBACK;"); });
afterAll(async () => { await db.close(); });
async function as(user: string) {
  await db.exec("RESET ROLE;");
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)", [user]);
  await db.exec("SET LOCAL ROLE authenticated;");
}
async function move(status: string) { return db.query("UPDATE landing_pages SET status=$1 WHERE id=$2", [status, page]); }
async function rejected(run: () => Promise<unknown>, message: RegExp) {
  await db.exec("SAVEPOINT expected_failure;");
  let caught: unknown;
  try { await run(); } catch (error) { caught = error; }
  await db.exec("ROLLBACK TO SAVEPOINT expected_failure;");
  expect(String(caught)).toMatch(message);
}

describe("landing page database approval gate", () => {
  it("prevents skipping review and approving the author's own AI copy", async () => {
    await rejected(() => move("published"), /Invalid.*transition/);
    await move("review");
    await rejected(() => move("approved"), /different reviewer/);
    await as(reviewer); await move("approved");
    await rejected(() => move("published"), /owner, admin or leader/);
    await as(publisher); await move("published");
    expect((await db.query("SELECT status,approved_by,published_by FROM landing_pages")).rows[0]).toEqual({ status: "published", approved_by: reviewer, published_by: publisher });
  });
  it("freezes reviewed content including metadata and rejects forged sign-offs", async () => {
    await move("review"); await as(reviewer); await move("approved");
    await rejected(() => db.query("UPDATE landing_pages SET metadata=$1 WHERE id=$2", [{ builder: { description: "Changed after review" } }, page]), /Draft before editing/);
    await db.query("UPDATE landing_pages SET approved_by=$1 WHERE id=$2", [author, page]);
    expect((await db.query("SELECT approved_by FROM landing_pages")).rows[0]).toEqual({ approved_by: reviewer });
  });
  it("remembers the latest editor and clears approvals when a page returns to draft", async () => {
    await as(reviewer);
    await db.query("UPDATE landing_pages SET headline='An edited headline' WHERE id=$1", [page]);
    await move("review");
    await rejected(() => move("approved"), /different reviewer/);
    await as(publisher); await move("approved"); await move("review"); await move("draft");
    expect((await db.query("SELECT approved_by,published_by FROM landing_pages")).rows[0]).toEqual({ approved_by: null, published_by: null });
  });
  it("rejects mismatched workspace references, viewer edits and pages created as published", async () => {
    await rejected(() => db.query("UPDATE landing_pages SET campaign_id=$1 WHERE id=$2", [foreignCampaign, page]), /campaign in this workspace/);
    await rejected(() => db.query("INSERT INTO landing_pages(id,organization_id,status) VALUES(gen_random_uuid(),$1,'published')", [org]), /start as drafts/);
    await as(viewer);
    await rejected(() => db.query("UPDATE landing_pages SET headline='Viewer edit' WHERE id=$1", [page]), /reviewer role/);
  });
  it("requires a campaign before review and a publisher different from the approver", async () => {
    await db.query("UPDATE landing_pages SET campaign_id=NULL WHERE id=$1", [page]);
    await rejected(() => move("review"), /Link a campaign/);
    await db.query("UPDATE landing_pages SET campaign_id=$1 WHERE id=$2", [campaign, page]);
    await move("review"); await as(publisher); await move("approved");
    await rejected(() => move("published"), /different publisher/);
  });
  it("keeps foreign workspace pages invisible through RLS", async () => {
    await as("20000000-0000-0000-0000-000000000009");
    expect((await db.query("SELECT * FROM landing_pages")).rows).toEqual([]);
  });
  it("refuses deletion by a viewer and protects reviewed pages", async () => {
    await as(viewer);
    await rejected(() => db.query("DELETE FROM landing_pages WHERE id=$1", [page]), /reviewer role/);
    await as(author); await move("review");
    await rejected(() => db.query("DELETE FROM landing_pages WHERE id=$1", [page]), /Only private drafts/);
  });
});
