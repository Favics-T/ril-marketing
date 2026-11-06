# Supabase mock-data cleanup — 21 October 2026

The user explicitly authorized connecting through `.env` and performing the cleanup. Credentials were passed to the installed Supabase CLI through the child process environment and were not printed or written to the repository. The CLI used its documented `db query --linked --project-ref` interface.

## Completed

- A rollback preview initially stopped on real insights referencing seeded audience groups. Nothing was committed by that attempt.
- Source provenance identified additional drafts based on demo activities and insights containing demo evidence. Those were added to the cleanup. Three audience groups used by retained records were preserved.
- All ten isolated PostgreSQL safety tests passed before applying the revised cleanup; the revised live rollback preview passed too.
- A local backup of the exact 320 target records and junctions was saved under `%LOCALAPPDATA%\RILBackups\2026-10-21`, alongside baseline counts and checksums. It is outside the Git repository.
- The commit transaction checked that its target ID set still matched the backup before deleting. It removed 320 records, including 44 fake leads, 27 demo/source-derived content assets, 18 fabricated or contaminated insights, and seven provider connections still carrying the exact fake credentials.
- A fresh rollback preview after the commit found zero remaining cleanup targets.

## Preservation checks

Checksums matched for accounts, profiles, organizations, memberships, real provider configurations, retained activities, leads, insights and workspace settings. The 106 original retained content assets matched their pre-cleanup title/body/status/metadata checksum. Two new content assets and one AI generation were created after the baseline snapshot; their timestamps explain the net-count differences. They were preserved, bringing the content count to 108 at verification time.

Other table counts matched the expected deletions. Organizations, accounts and memberships were not deleted. Adopted audience groups and real settings were not reset. The cleanup made no publishing or email requests. Historical provider content and manually entered records without reliable mock provenance were not inferred to be fake from their names.

The default checked-in SQL continues to end in `ROLLBACK` for safe previews. Only the temporary execution copy used `COMMIT`. The backup and applied-count results remain local for recovery and comparison.

## User-confirmed remaining test records

The user subsequently confirmed that the manually entered **RIL BOOTCAMP** and **Founder** activities, their 19 drafts and two insights, and the leads **Audit One** and **AUDIT TOKEN** were also test records. A second cleanup was restricted to workspace `5bb06ed8-c911-49af-9bc9-3709664ca147` and those source/lead IDs. It did not broaden the cleanup to other workspaces.

A new backup was saved before committing the exact previewed target set. This pass removed 32 records: two activities, 19 content assets, two insights, two leads, four automation events, two tasks and one content audit record. A fresh database query confirmed that this workspace now has zero activities, content assets, audience insights and leads. All table-count differences matched the plan, all 12 protected record-group checksums matched, and no cleanup targets remained. Accounts, connections, settings and other workspaces were preserved.

The second pass's backup, applied counts and verification results are saved as `workspace-tests-before.json`, `workspace-tests-applied.json` and `workspace-tests-after.json` in the same local backup directory.
