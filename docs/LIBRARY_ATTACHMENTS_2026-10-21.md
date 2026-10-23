# Content Library attachments

Implemented on 21 October 2026.

## User flow

- Add content: choose files before saving. The draft is created once, then its files upload. Failed uploads can be retried without creating another draft or uploading an already stored object again.
- Saved content: open Content files to upload, open, remove, restore or repurpose a file. Attachment changes are available in Idea, AI Generated and Editing. Save unsaved draft text first; attachment controls explain and enforce this to prevent refreshes discarding copy.
- Activities: choose Attach from Content Library, search a title, select an item and attach it. This adds an association without replacing its original source, copy, status or files. Items originally generated from an activity stay associated with that source.
- Repurposing: choose a file attached to a library item, including an item with no written copy. Generated content follows the existing review workflow.

## Storage and access

Uses the existing private `ril-activity-media` bucket and organization membership policies. No migration is required. File references live in asset metadata; linked activity IDs are separate metadata associations. Storage paths include organization, asset and file IDs. Server actions verify organization ownership, object metadata and editable status, and use the asset update timestamp to reject concurrent changes.

File links expire after one hour. Removed attachments remain private and recoverable; existing repurposing sources retain their file reference. Up to 20 file records, including removed files, can belong to an item. Uploads support files up to 100 MB; AI extraction has smaller existing limits (8 MB for supported documents/images, 14 MB for recordings). Supporting files are not automatically public publishing media.

## Verification

- 786 tests across 77 files passed, including workspace boundaries, invalid paths, upload retries, concurrent updates, removal/restoration, source preservation and private file extraction.
- Lint, TypeScript and production build passed. The final mobile spacing adjustment also passed targeted lint.
- Browser checks covered file selection/removal before saving, existing-item selection, title search, the unsaved-copy guard and mobile layouts at 390 px.
- No live file was uploaded and no existing content or activity association was changed during browser verification. Storage and link mutations were verified with automated tests; a real upload against the configured storage remains a deployment acceptance check.
- Local preview runs on port 3001 because port 3000 currently serves another application.
