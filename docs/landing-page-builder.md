# Campaign landing page builder

Marketing can create campaign pages under **Landing Pages → Campaign pages → Create landing page**. Existing rich-text pages continue to work.

## Workflow

1. Write an internal name, link name, headline, description and formatted copy.
2. Add any needed benefits, programme details, public image, YouTube/Vimeo video, real testimonials and FAQs. Empty sections are omitted. Remove unfinished entries before saving.
3. Link a campaign. Activity and audience links are optional. Review requires a campaign so captured leads remain attributable.
4. Preview the page and interest form without saving or submitting visitor data.
5. Save the draft. To request AI alternatives, first save and add active Brand Knowledge. **Suggest copy** uses the configured AI provider to generate three headline/description/button combinations. Applying one labels the draft as AI-generated and preserves its model, generation time and brand-source names. Suggestions do not publish anything.
6. Submit the saved draft for review. Neither its author nor latest editor can approve it. A different owner, admin or leader publishes the approved page. Editing requires returning to Draft and obtaining fresh approval. Unpublishing immediately removes public access.

An unsaved draft cannot be submitted for review or replaced with AI suggestions. Concurrent saves, suggestions and status changes use the saved `updated_at` version and fail with a reload message if another edit wins.

## Connections

- Existing public lead capture resolves the workspace from the published page, attributes the lead to the page/campaign/audience and preserves tracked-link attribution within that workspace.
- Marketing email consent stays separate from the enquiry. Submission does not automatically send email or subscribe visitors without consent. Create email drafts against the same campaign and use the existing email approval flow.
- The page detail shows recorded page visits, attributed leads and email campaigns sharing its campaign. Analytics counters show unavailable states on query failure. Page-specific visit attribution begins with this release; it does not reclassify old visits.
- Public view tracking resolves the page's actual workspace instead of assigning campaign pages to the first organization. Unknown/unpublished page paths do not fall back to another workspace. Query strings are excluded from stored paths.
- Admins manage deployment and the public domain through the existing hosting setup. Set the deployed public site origin in the deployment configuration for correct canonical/share URLs. The marketing editor does not expose hosting credentials or DNS controls.

## Data contract

The existing `landing_pages.metadata` JSONB column holds `builder` with `version: 1`, `description`, `benefits`, `programme` (`label`, `detail`), `image` (`url`, `alt`), `video` (`url`, `title`), `testimonials` (`quote`, `name`, `role`) and `faqs` (`question`, `answer`). Zod validates lengths, complete entries and array limits before writing. Existing automation metadata is preserved. Separate `copy_suggestions`, `ai_copy` and `last_edited_by` metadata records remain internal.

The public loader exposes only validated builder metadata to the page renderer. Lead capture receives only its button label, safe registration link and public page key. Internal names, AI diagnostics, workspace IDs and brand guidance are not passed to those client components.

Media uses public HTTPS links, not private activity/library storage. URLs containing credentials, common access-token parameters, local hosts, IP literals or nonstandard ports are refused. Images require alt text and send no referrer. Video links are canonicalized to approved YouTube/Vimeo embed hosts, and visitors explicitly load the player. Raw HTML in rich text is not executed. Only authored public copy and workspace-scoped active Brand Knowledge are sent to AI; lead records, credentials and private metadata are not read for the prompt.

## Deployment requirement

Apply `supabase/migrations/20261025000001_landing_page_approval.sql` through the normal Supabase migration process before release. It adds a database trigger for reviewer permissions, organization references, independent approvals, protected reviewed copy and draft-only deletion. Trusted service jobs retain their existing automation access. No new table or content column is required; the existing automation migration already supplies `landing_pages.metadata`.

This migration was tested in an isolated in-memory PostgreSQL database. It has **not** been applied to a remote database by this task. No environment files were read and no production records were created or removed.

## Verification

Automated coverage includes section contracts and rendering, safe media/registration URLs, brand-only AI prompt inputs, missing provider/brand guidance, malformed output, provenance and metadata preservation, concurrent writes, public view attribution, cross-workspace isolation, self-approval prevention and database-level workflow enforcement. Browser checks exercise unsaved section editing, preview, FAQ expansion, preserved edits and responsive layout. Live AI generation and a production publish/lead submission require configured credentials and the migration; they were not run against real campaign data.

Validated on 25 October 2026: all 972 tests across 94 files pass, TypeScript passes, the production build succeeds, and desktop/mobile browser layouts have no horizontal overflow. Full-project lint is also run before handoff.
