# Landing-page approval migration: deployment check

Checked on 28 October 2026. Target: `20261025000001_landing_page_approval.sql`.

## Findings

- The existing CLI link identifies Supabase project `rbyyyflgeuigcslhnxat`, named **marketing project**. A project link identifies the target; it is not authorization to alter its schema.
- The migration is committed in `f191c9ed58ff97e472dbe375ca6a4f79a5d737d1` on `david/integrate-colleague`.
- GitHub's public API returned preview deployment records `7330503899` and `7330491291`, both created on 26 October for that commit. Their successful completion and runtime database configuration were not verified. The deployment-status lookup was blocked by tool policy; the web lookup could not retrieve those status endpoints either.
- GitHub `main` currently resolves to `c8182bf7259d876cd8c16907c89478a544fe29c3`. The public Actions API reports zero workflow runs. There is no `.github/workflows`, `.vercel` link, or Supabase `config.toml` in this checkout. `vercel.json` defines application cron jobs, not a database migration deployment step.
- The existing builder handoff says this migration was tested locally and had not been applied remotely by that task. This is historical evidence, not proof of today's remote state.
- **Current remote application status is unverified.** `supabase migration list --linked --project-ref rbyyyflgeuigcslhnxat` failed with `LegacyDbConfigLoginRoleStatusError`: HTTP 403, account lacks privileges for the login-role endpoint. The initial attempt without cached pooler metadata also encountered an IPv6 limitation.

No remote migration was applied. No standing migration approval or deployment workflow authorizing this change was found. The user's condition to apply only when the existing deployment setup authorizes it was therefore not satisfied. Earlier permission to remove specific test records is not migration authorization.

The existing isolated PostgreSQL migration suite was rerun during this check: **7 tests passed**. That confirms the tested local behavior, not the remote deployment state.

## Commands for the authorized deployment operator

These commands use the existing project reference and installed Supabase CLI, version 2.117.0. They do not require displaying or sourcing `.env`. Use an account authorized for this project's migration deployment; fix the 403 through project access before proceeding.

Run in PowerShell from the existing checkout:

```powershell
Set-Location -LiteralPath 'C:\Users\ghost\Downloads\renaissance marketing'
Get-Content -LiteralPath 'supabase/.temp/project-ref'
supabase migration list --linked --project-ref rbyyyflgeuigcslhnxat
supabase db push --linked --project-ref rbyyyflgeuigcslhnxat --skip-vault --dry-run
```

The project reference must match the intended deployment's database. Do not relink to a different project to make the commands succeed. If the CLI session needs authentication, use `supabase login` interactively; do not paste tokens, database passwords or connection strings into chat.

**Stop unless the dry run lists only `20261025000001_landing_page_approval.sql` as pending.** `db push` applies all pending migrations; it has no target-version flag. Other pending migrations, missing local versions, or a history/schema mismatch need a separate review. Do not add `--include-all`, `--include-seed`, `--include-roles`, `--yes`, `db reset`, or `migration repair` to get past a failure.

After the checks below and existing deployment authorization are confirmed, the exact apply command is:

```powershell
supabase db push --linked --project-ref rbyyyflgeuigcslhnxat --skip-vault
```

`--skip-vault` avoids updating Vault configuration as a side effect. Do not run this apply command while application status remains unknown or the target is unconfirmed. If history already contains the version and the function/trigger checks agree with the file, no application is needed.

## Safe verification checklist

### Before application

- [ ] A project owner confirms the database target, release window and the migration operator's existing deployment authority. Coordinate with colleagues so only one operator pushes migrations.
- [ ] Verify the intended hosted release uses the compatible landing-page workflow code. A preview build and a database deployment are separate operations; check every application sharing this database before enabling the guard.
- [ ] Confirm a recent recoverable database backup/PITR restore point. Save the current function and trigger definitions if either already exists; this is a replaceable function, so a pre-existing definition must be reviewed for drift.
- [ ] Have the operator run the read-only SQL below in the intended project's SQL editor. A recorded version without its expected trigger, or a trigger without the recorded version, is a reconciliation issue rather than permission to change migration history.
- [ ] Confirm `public.landing_pages` and its `metadata`, `created_by`, `approved_by`, `published_by`, `campaign_id`, `activity_id`, `audience_segment_id` and `status` columns exist. The organization membership, campaign, activity and segment relations referenced by the function must exist too.
- [ ] Confirm the dry run contains only the target migration. Stop on any privilege, network, schema or migration-history error.
- [ ] Run the existing isolated PostgreSQL test: `npm test -- src/lib/landing-page-workflow-db.test.ts`. It exercises the checked-in migration without connecting to Supabase.

### Read-only SQL for the deployment operator

```sql
-- History: one row means the version is recorded; zero rows means unrecorded.
SELECT version, name
FROM supabase_migrations.schema_migrations
WHERE version = '20261025000001';

-- Function: compare the returned definition with the checked-in SQL.
SELECT pg_get_functiondef(
  to_regprocedure('public.guard_landing_page_workflow()')
) AS function_definition;

-- Trigger: expect one enabled BEFORE INSERT OR UPDATE OR DELETE row trigger
-- invoking public.guard_landing_page_workflow(). O = enabled normally;
-- A = always enabled. D = disabled, R = replica-only: investigate either.
SELECT t.tgname, t.tgenabled,
       pg_get_triggerdef(t.oid, true) AS trigger_definition
FROM pg_trigger AS t
WHERE t.tgrelid = to_regclass('public.landing_pages')
  AND t.tgname = 'landing_pages_approval_guard'
  AND NOT t.tgisinternal;

-- Prerequisites, without selecting application records.
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'landing_pages'
  AND column_name IN (
    'metadata', 'created_by', 'approved_by', 'published_by',
    'campaign_id', 'activity_id', 'audience_segment_id', 'status'
  )
ORDER BY column_name;

SELECT to_regclass('public.organization_members') AS memberships,
       to_regclass('public.campaigns') AS campaigns,
       to_regclass('public.activities') AS activities,
       to_regclass('public.audience_segments') AS segments;

-- Record RLS state and policies; this migration should not remove them.
SELECT relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE oid = to_regclass('public.landing_pages');

SELECT policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'landing_pages'
ORDER BY policyname;
```

### After application

- [ ] Repeat `supabase migration list --linked --project-ref rbyyyflgeuigcslhnxat`; the target version must appear remotely. Repeat the dry run and confirm no pending migrations.
- [ ] Repeat the read-only SQL: verify both the recorded version and the actual function/enabled trigger, and confirm the pre-existing RLS configuration remains intact.
- [ ] In staging, verify draft creation, campaign requirement before review, rejection of author/latest-editor self-approval, independent approval, and publishing by a different owner/admin/leader. Confirm reviewed copy is locked, viewer writes and cross-workspace references are rejected, and deletion is restricted to drafts. The trusted service-role bypass is intentional; testing only as a service role does not validate the user gate.
- [ ] Verify draft/review/approved/paused pages are not publicly accessible, while an independently approved and published test page renders correctly. Use designated staging records; no production publication or lead submission is implied by this checklist.
- [ ] Observe application/database errors during the release window. On failure, stop further rollout and use the agreed restore or reviewed corrective-migration plan. Do not simply disable the approval guard or mark an unapplied version as applied.

## Audit method

No `.env` file was read or loaded for this audit. The CLI check ran from an isolated temporary directory containing only copies of checked-in migrations and existing Supabase link/pooler metadata, avoiding implicit project environment-file loading. No application records were queried. The GitHub metadata checks used the public API after `gh` reported no authenticated session.

Reference: [Supabase database migration workflow](https://supabase.com/docs/guides/deployment/database-migrations). Exact flags above were also checked against the installed CLI's `migration list --help` and `db push --help`.
