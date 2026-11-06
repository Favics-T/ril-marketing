# Supabase credential diagnosis — 5 November 2026

The user explicitly authorized inspecting `.env` and using its credentials for this diagnostic, overriding the repository's default prohibition for this task. Credential values were not displayed, committed, or changed.

## Results

The configured project URL and the project claims in the API keys match the existing CLI link, `rbyyyflgeuigcslhnxat`.

| Credential path | Result | Meaning |
| --- | --- | --- |
| Earlier CLI session, without loading `.env` | HTTP 403 at login-role initialization | That session lacked permission for the Management API operation. |
| `.env` `SUPABASE_ACCESS_TOKEN` | HTTP 401 from the project-details endpoint: `Invalid access token` | The saved personal token is not accepted. It may be expired, revoked or incorrect; the response does not identify which. |
| `.env` `SUPABASE_DB_PASSWORD` | PostgreSQL SQLSTATE `28P01`, password authentication failed | The linked database does not accept the supplied password. |
| `.env` `SUPABASE_SERVICE_ROLE_KEY` | HTTP 200 from the Data API | The application's service-role API credential works on the checked endpoint. The request used `limit=0`; no organization records were retrieved. |

The access token and database password were absent from the inherited shell environment before this diagnostic. Earlier migration checks deliberately used an isolated directory without loading `.env`, following the repository instructions then in force. Application API keys and CLI/Management API credentials are separate; a working service-role API key does not establish permission to apply database migrations.

## Required correction

An authorized project operator needs to replace the invalid `SUPABASE_ACCESS_TOKEN` with a valid personal access token that can access this project, and correct `SUPABASE_DB_PASSWORD` in the local environment. Keep credentials local; do not paste their values into issues, PRs or chat. No account password, database password, API key or token was reset by this task.

After correction, retry migration history and the reviewed dry run using the intended credential source. Do not run a migration merely because credentials exist. The pending/applied status of the landing-page and incoming security migrations is still unverified. The earlier [integration handoff](COLLEAGUE_INTEGRATION_2026-11-05.md) retains the migration-order and release checks.

The diagnostic parsed `.env` as data, without evaluating it as shell code. Only the two Supabase CLI credentials were passed to the migration-list subprocess environment. Values were redacted before emitting errors. No remote schema or application data was changed.

Reference: [Supabase personal access tokens and permissions](https://supabase.com/docs/guides/platform/personal-access-tokens).
