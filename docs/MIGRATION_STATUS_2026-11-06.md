# Verified Supabase migration status — 6 November 2026

Project: `rbyyyflgeuigcslhnxat`. The user updated the personal access token and authorized rechecking it. The updated token successfully read migration history and database metadata through the Management API. No credential values were displayed, and no remote changes were made.

## Live results

The migration-history endpoint returned HTTP 200 with 30 applied versions. A separate read-only SQL query returned the same version list. Comparing that list with the 33 checked-in migration files identifies exactly three pending files, in order:

| Migration | Verified state |
| --- | --- |
| `20261025000001_landing_page_approval.sql` | Pending. Neither `public.guard_landing_page_workflow()` nor `landing_pages_approval_guard` exists. |
| `20261028000000_email_signoff_content_and_unflag.sql` | Pending. The existing email guard lacks the follow-up's content-change invalidation, and `email_campaign_signoff_events.reason` is absent. |
| `20261103000000_leads_column_grants.sql` | Pending. The authenticated role still has direct lead INSERT/DELETE privileges and UPDATE on `marketing_consent`. |

`20261021000000_email_sensitive_signoff.sql` is recorded as applied. Its email-campaign guard trigger exists and is enabled normally. This resolves the earlier uncertainty about the prerequisite; it does not need to be blindly reapplied.

The expected landing-page columns, including `metadata` and approval attribution fields, exist. RLS is enabled on both `landing_pages` and `leads`, and the landing-page table has one policy. These schema checks do not replace a full rollout rehearsal or authenticated end-to-end verification.

## Release gate and commands

The updated token was requested for read-only verification. Credential presence and successful inspection do not authorize application. No migration was attempted with it. The database password rejected on 5 November was not retested during this read-only check.

An authorized operator with working deployment credentials should first confirm the project, backup/restore point, release window and compatibility of applications sharing this database, then run:

```powershell
Set-Location -LiteralPath 'C:\Users\ghost\Downloads\renaissance marketing'
supabase db push --linked --project-ref rbyyyflgeuigcslhnxat --skip-vault --dry-run
```

The dry run must contain only the three pending files above. Stop if the history has changed, another migration appears, or authentication fails. No `--include-all`, migration-history repair, seeds, remote reset or RLS changes are needed merely to resolve this verified pending set.

Only after deployment authorization and the preview are confirmed, the apply command is:

```powershell
supabase db push --linked --project-ref rbyyyflgeuigcslhnxat --skip-vault
```

Afterward, verify all three recorded versions, the enabled landing-page and email guards, the email history `reason` column, and the expected lead grants: INSERT=false, DELETE=false, consent UPDATE=false, notes UPDATE=true. Run the role/approval and public-page checks in the existing [integration handoff](COLLEAGUE_INTEGRATION_2026-11-05.md) and [landing-page deployment checklist](LANDING_PAGE_MIGRATION_DEPLOYMENT_2026-10-28.md). Prefer designated staging records for workflow tests.

## Evidence and limits

- Read-only audit time: 6 November 2026, approximately 11:34 WAT.
- Requests used the documented `/database/query/read-only` endpoint. No application records were selected.
- Migration and catalog responses are saved locally under `%TEMP%/ril-readonly-migration-audit-results.json` and `%TEMP%/ril-migration-prerequisites-results.json`. These contain schema metadata, not credential values.
- Earlier 403/401/password failures remain historical findings in [the credential diagnosis](SUPABASE_CREDENTIAL_DIAGNOSIS_2026-11-05.md); the new token now works for the verified read operations.
