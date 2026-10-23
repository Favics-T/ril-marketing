# Remove retired mock data

The application no longer ships the demo/dev seed scripts, the unused sample sales charts, the fabricated activity feed, the stock customer-logo list, or the template navigation with dead links. Live dashboards continue to read workspace records and show their existing empty states. Form hints, test fixtures, product instructions, configured KPI targets and source-grounded template generation are not mock records and remain available.

## Remove records already in Supabase

The source-code cleanup does not itself delete records from an existing database. On 21 October 2026, the user explicitly authorized using the Supabase credentials in `.env`, overriding `CLAUDE.md` for this cleanup. The live cleanup is now complete; see [the execution record](MOCK_DATA_CLEANUP_2026-10-21.md). The steps below remain available for reviewing or rerunning the script.

1. Open [remove_mock_data.sql](../supabase/maintenance/remove_mock_data.sql) and paste it into your project's Supabase SQL editor as the database owner.
2. Run it with the final `ROLLBACK` intact. The result lists the number of records that would be removed, by table; nothing is saved.
3. To apply the cleanup, replace only the final `ROLLBACK;` with `COMMIT;` and run the whole script again.
4. Refresh the application. Verify each provider you actually use in **AI & Integrations**; email delivery settings are on **Email**.

The script uses the retired seed's exact deterministic IDs in its two known workspaces, plus the fixed development workspace's IDs/content fingerprints. It removes fake connections only when their original fake credentials still match; real replacement credentials are preserved. It never deletes organizations, accounts or memberships, and does not reset workspace settings or clear whole tables.

Linked audit/delivery history for a mock record is removed with it. Generated drafts linked to a demo source activity/generation are included, as are insights whose recorded evidence includes a demo asset, lead or event. Such insights need regenerating from the remaining real data. Audience groups adopted by retained records remain as workspace configuration, keeping genuine work attached to its audience. Other real records with nullable `ON DELETE SET NULL` links remain, with only their retired demo association cleared. If another real record would be cascaded away or blocks deletion, the transaction stops and rolls back. Reassign that record in the application before rerunning; do not disable the checks or replace the script with a workspace-wide delete.

Known seed records are identified by origin, so a seeded record that was subsequently edited still qualifies. Export any such edited seed record you want to retain before applying the cleanup. Existing settings cannot be distinguished reliably from settings later chosen by a person, so automation, trend-monitoring and report schedules remain unchanged; review them in Settings if they were enabled for the demo.

The script briefly locks writes to public tables while checking references and deleting, so a concurrent edit cannot bypass its preservation checks. Reads remain available. It does not send provider requests, emails or posts, and cannot delete anything already published on an external service. Unknown test records created manually are intentionally not guessed from names or email domains outside the development seed's fixed workspace.

## Verification

The cleanup tests use an isolated PostgreSQL runtime (PGlite), without application credentials. They check preview rollback, repeat execution, real-record preservation, workspace boundaries, fake-credential matching, dependency cleanup, nullable links and refusal of unsafe cascades. The updated suite has ten tests, including preservation of adopted audience groups and removal of source-linked demo drafts and contaminated insights. All ten passed before applying the live cleanup.

Checked on 20 October 2026:

- PASS: 696 tests across 68 files, including nine database cleanup safety tests.
- PASS: ESLint and the production build, including TypeScript and all 52 static pages.
- PASS: all 108 static seed labels matched against the retired seed from Git; generated lead/delivery IDs are included separately.
- PASS: deleted sample components have no live route importers; active dashboards retain their real queries and existing empty/error states.
- PASS: patch whitespace check; no `.env` reads, live database deletion, provider calls or publishing during cleanup validation.

Those initial checks verified the code and cleanup script. The subsequent authorized live execution and its database verification are recorded separately below.
