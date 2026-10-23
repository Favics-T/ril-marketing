import { PGlite } from "@electric-sql/pglite";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const org = "5bb06ed8-c911-49af-9bc9-3709664ca147";
const other = "10000000-0000-4000-8000-000000000001";
const dev = "00000000-0000-4000-8000-000000000001";
const tables = ["audience_segments", "programs", "campaigns", "activities", "ai_generations", "content_assets", "asset_approvals", "publications", "registration_links", "audience_insight_generation_runs", "audience_insights", "insight_approvals", "kpis", "tasks", "landing_pages", "leads", "lead_follow_ups", "trends", "brand_knowledge", "email_campaigns", "email_campaign_deliveries", "email_provider_events", "community_items", "marketing_reports", "automation_events", "integrations", "content_signoffs", "content_schedule_changes", "publishing_alerts", "recurring_content"];
let db: PGlite;
let sql: string;
function seedId(tag: string) {
  const h = createHash("md5").update(tag).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20)}`;
}
async function add(table: string, id: string, organization = org, extras: Record<string, unknown> = {}) {
  const values = { id, organization_id: organization, ...extras };
  await db.query(`INSERT INTO ${table} (${Object.keys(values).join(",")}) VALUES (${Object.keys(values).map((_, i) => `$${i + 1}`).join(",")})`, Object.values(values));
}
async function count(table: string) {
  return (await db.query<{ n: number }>(`SELECT count(*)::int n FROM ${table}`)).rows[0].n;
}
async function apply() { await db.exec(sql.replace(/ROLLBACK;\s*$/, "COMMIT;")); }
beforeEach(async () => {
  db = new PGlite();
  sql = await readFile(new URL("../../supabase/maintenance/remove_mock_data.sql", import.meta.url), "utf8");
  await db.exec(tables.map(t => `CREATE TABLE ${t}(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL)`).join(";"));
  await db.exec(`
    ALTER TABLE content_assets ADD COLUMN title text, ADD COLUMN body text, ADD COLUMN source_activity_id uuid REFERENCES activities(id) ON DELETE SET NULL, ADD COLUMN generation_id uuid, ADD COLUMN campaign_id uuid REFERENCES campaigns(id) ON DELETE SET NULL;
    ALTER TABLE leads ADD COLUMN email text;
    ALTER TABLE programs ADD COLUMN name text, ADD COLUMN slug text;
    ALTER TABLE activities ADD COLUMN title text, ADD COLUMN source_type text;
  `);
  await db.exec(`
    CREATE TABLE analytics_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,metadata jsonb);
    ALTER TABLE integrations ADD COLUMN key text, ADD COLUMN config jsonb;
    ALTER TABLE publications ADD COLUMN content_asset_id uuid REFERENCES content_assets(id) ON DELETE CASCADE;
    ALTER TABLE publishing_alerts ADD COLUMN content_asset_id uuid REFERENCES content_assets(id), ADD COLUMN publication_id uuid REFERENCES publications(id);
    ALTER TABLE asset_approvals ADD COLUMN content_asset_id uuid REFERENCES content_assets(id) ON DELETE CASCADE;
    ALTER TABLE audience_insights ADD COLUMN segment_id uuid REFERENCES audience_segments(id) ON DELETE CASCADE;
    ALTER TABLE audience_insights ADD COLUMN source_content_asset_ids uuid[] DEFAULT '{}', ADD COLUMN source_lead_ids uuid[] DEFAULT '{}', ADD COLUMN source_event_ids uuid[] DEFAULT '{}';
    ALTER TABLE automation_events ADD COLUMN record_id uuid;
    ALTER TABLE recurring_content ADD COLUMN content_asset_id uuid REFERENCES content_assets(id);
    CREATE TABLE content_asset_segments(content_asset_id uuid REFERENCES content_assets(id) ON DELETE CASCADE,audience_segment_id uuid REFERENCES audience_segments(id) ON DELETE CASCADE);
    CREATE TABLE audience_segment_programs(audience_segment_id uuid REFERENCES audience_segments(id) ON DELETE CASCADE,program_id uuid REFERENCES programs(id) ON DELETE CASCADE);
    CREATE TABLE organizations(id uuid PRIMARY KEY,name text);
    CREATE TABLE organization_members(organization_id uuid,user_id uuid);
    CREATE TABLE profiles(id uuid PRIMARY KEY,organization_id uuid);
    CREATE TABLE automation_settings(organization_id uuid PRIMARY KEY,activity_to_drafts_enabled boolean);
    INSERT INTO organizations VALUES('${org}','Workspace');
    INSERT INTO profiles VALUES(gen_random_uuid(),'${org}');
    INSERT INTO organization_members VALUES('${org}',gen_random_uuid());
    INSERT INTO automation_settings VALUES('${org}',false);
  `);
}, 30000);
afterEach(async () => { await db.close(); });

describe("retired mock data cleanup", () => {
  it("previews without persisting any deletion", async () => {
    await add("leads", seedId(`lead:1:${org}`));
    await db.exec(sql);
    expect(await count("leads")).toBe(1);
  });
  it("removes seed IDs across surfaces, retains authored records and runs twice safely", async () => {
    for (const [table, tag] of [["leads", "lead:20"], ["content_assets", "asset:seo"], ["marketing_reports", "report:weekly"], ["kpis", "kpi:traffic"], ["trends", "trend:6"]]) {
      await add(table, seedId(`${tag}:${org}`));
      await add(table, crypto.randomUUID());
    }
    await apply(); await apply();
    for (const table of ["leads", "content_assets", "marketing_reports", "kpis", "trends", "organizations", "profiles", "organization_members", "automation_settings"]) expect(await count(table)).toBe(1);
  });
  it("does not delete another workspace's row even if its ID matches a seed", async () => {
    await add("leads", seedId(`lead:1:${org}`), other);
    await apply(); expect(await count("leads")).toBe(1);
  });
  it("removes exact fake connections but keeps replacement credentials and real settings", async () => {
    await add("integrations", crypto.randomUUID(), org, { key: "buffer", config: { accessToken: "demo-buffer-access-token" } });
    await add("integrations", crypto.randomUUID(), org, { key: "cms_wordpress", config: { applicationPassword: "encrypted-real-value" } });
    await add("integrations", crypto.randomUUID(), other, { key: "buffer", config: { accessToken: "demo-buffer-access-token" } });
    await apply(); expect(await count("integrations")).toBe(2);
    expect(await count("automation_settings")).toBe(1);
  });
  it("removes seed history in dependency order without retaining orphan alerts", async () => {
    const asset = seedId(`asset:blog:${org}`), pub = crypto.randomUUID();
    await add("content_assets", asset);
    await add("publications", pub, org, { content_asset_id: asset });
    await add("publishing_alerts", crypto.randomUUID(), org, { content_asset_id: asset, publication_id: pub });
    await add("asset_approvals", crypto.randomUUID(), org, { content_asset_id: asset });
    await apply();
    for (const table of ["content_assets", "publications", "publishing_alerts", "asset_approvals"]) expect(await count(table)).toBe(0);
  });
  it("keeps adopted audience groups rather than cascading into genuine insights", async () => {
    const segment = seedId(`seg:founders:${org}`);
    await add("audience_segments", segment);
    await add("audience_insights", crypto.randomUUID(), org, { segment_id: segment });
    await apply();
    expect(await count("audience_insights")).toBe(1); expect(await count("audience_segments")).toBe(1);
  });
  it("removes drafts from demo sources and invalidates insights containing their evidence", async () => {
    const activity=seedId(`act:bootcamp:${org}`), draft=crypto.randomUUID(), real=crypto.randomUUID();
    await add("activities",activity);
    await add("content_assets",draft,org,{source_activity_id:activity});
    await add("content_assets",real,org,{title:"Real article"});
    await add("audience_insights",crypto.randomUUID(),org,{source_content_asset_ids:[draft,real]});
    await add("audience_insights",crypto.randomUUID(),org,{source_content_asset_ids:[real]});
    await add("automation_events",crypto.randomUUID(),org,{record_id:activity});
    await apply();
    expect(await count("content_assets")).toBe(1);
    expect(await count("audience_insights")).toBe(1);
    expect(await count("automation_events")).toBe(0);
  });
  it("preserves real draft copy while clearing an optional demo campaign association", async () => {
    const campaign = seedId(`camp:bootcamp:${org}`);
    await add("campaigns", campaign);
    await add("content_assets", crypto.randomUUID(), org, { title: "Team-authored article", body: "Keep this copy", campaign_id: campaign });
    await apply();
    expect((await db.query("SELECT title,body,campaign_id FROM content_assets")).rows).toEqual([{ title: "Team-authored article", body: "Keep this copy", campaign_id: null }]);
  });
  it("does not remove a real recurring plan attached to a seed asset", async () => {
    const asset = seedId(`asset:blog:${org}`);
    await add("content_assets", asset);
    await add("recurring_content", crypto.randomUUID(), org, { content_asset_id: asset });
    await expect(apply()).rejects.toThrow(/non-demo records.*recurring_content/);
    await db.exec("ROLLBACK"); expect(await count("content_assets")).toBe(1);
  });
  it("cleans only development-seed fingerprints in its fixed workspace", async () => {
    await add("leads", crypto.randomUUID(), dev, { email: "hq10@example.com" });
    await add("leads", crypto.randomUUID(), dev, { email: "real@company.org" });
    await add("content_assets", crypto.randomUUID(), dev, { title: "General update 10" });
    await add("content_assets", crypto.randomUUID(), dev, { title: "My actual update" });
    await add("analytics_events", crypto.randomUUID(), dev, { metadata: { seeded: true } });
    await add("analytics_events", crypto.randomUUID(), dev, { metadata: {} });
    await apply();
    for (const table of ["leads", "content_assets", "analytics_events"]) expect(await count(table)).toBe(1);
  });
});
