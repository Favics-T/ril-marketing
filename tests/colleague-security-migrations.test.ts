import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let db: PGlite;
const sql = (path: string) => readFile(new URL(`../supabase/${path}`, import.meta.url), "utf8");

beforeAll(async () => {
  db = new PGlite();
  // Supabase auth/privilege baseline for the colleague's rollback-only SQL suites.
  // This fixture does not stand in for a rehearsal on the deployed database.
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, aud text, role text);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;
    CREATE TABLE organizations(id uuid PRIMARY KEY, name text);
    CREATE TABLE organization_members(organization_id uuid, user_id uuid, role text);
    CREATE FUNCTION caller_organization_ids() RETURNS SETOF uuid
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
        SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
      $$;
    CREATE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN NEW.updated_at = now(); RETURN NEW; END
    $$;
    CREATE TABLE audience_segments(id uuid PRIMARY KEY, organization_id uuid, name text);
    CREATE TABLE email_campaigns(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid REFERENCES organizations(id),
      name text, subject text, preview_text text DEFAULT '', body text, status text DEFAULT 'draft',
      created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
      approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
      audience_segment_id uuid, metadata jsonb NOT NULL DEFAULT '{}',
      delivery_authorized_at timestamptz
    );
    CREATE TABLE leads(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid,
      name text, email text, interest text, source_platform text,
      funnel_stage text DEFAULT 'captured', is_converted boolean DEFAULT false,
      is_qualified boolean DEFAULT false, score text, score_reason text, notes text, owner_id uuid,
      marketing_consent boolean DEFAULT false, marketing_consent_at timestamptz,
      email_unsubscribed_at timestamptz, email_suppressed_at timestamptz
    );
    CREATE TABLE community_items(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid,
      platform text, author_label text, body text, category text, lead_id uuid
    );
    ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
    CREATE POLICY leads_isolation ON leads FOR ALL
      USING (organization_id IN (SELECT caller_organization_ids()))
      WITH CHECK (organization_id IN (SELECT caller_organization_ids()));
    ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;
    CREATE POLICY email_isolation ON email_campaigns FOR ALL
      USING (organization_id IN (SELECT caller_organization_ids()))
      WITH CHECK (organization_id IN (SELECT caller_organization_ids()));
    GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
    GRANT ALL ON leads TO anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated, service_role;
  `);
  for (const path of [
    "migrations/20261021000000_email_sensitive_signoff.sql",
    "migrations/20261028000000_email_signoff_content_and_unflag.sql",
    "migrations/20261103000000_leads_column_grants.sql",
  ]) await db.exec(await sql(path));
}, 90000);

afterAll(async () => { await db?.close(); });

describe("integrated colleague security migrations", () => {
  it("passes the unchanged senior sign-off SQL suite and rolls back its fixtures", async () => {
    const results = await db.exec(await sql("tests/ren414_sensitive_signoff.sql"));
    expect(results.some(result => result.rows.some(row => row.result === "REN-414 sign-off checks passed"))).toBe(true);
    expect((await db.query("SELECT count(*)::int AS count FROM email_campaigns")).rows).toEqual([{ count: 0 }]);
  }, 30000);

  it("passes the unchanged lead column-grant SQL suite and rolls back its fixtures", async () => {
    const results = await db.exec(await sql("tests/leads_column_grants.sql"));
    expect(results.some(result => result.rows.some(row => row.result === "Leads column-grant checks passed"))).toBe(true);
    expect((await db.query("SELECT count(*)::int AS count FROM leads")).rows).toEqual([{ count: 0 }]);
  }, 30000);
});
