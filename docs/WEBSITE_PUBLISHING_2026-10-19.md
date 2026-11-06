# Website publishing inside Landing Pages

Open `/audience/landing-pages?view=website`, or choose **Website publishing & SEO** from Landing Pages. The existing Campaign pages view, page builder and public campaign routes are retained.

## Available workflow

1. Create blog draft opens the existing content form with Website and Blog selected. Saving still creates an editing draft; it never publishes.
2. Find website articles by status, campaign or title/copy search. Lists are workspace-scoped and paginated ten at a time.
3. Draft articles expose an inline SEO title and meta description form. Saving changes only metadata, preserves copy/channel/platform and other metadata, and checks the original timestamp and editable status. It cannot edit approved or scheduled copy.
4. Preview article renders Markdown as formatted content. Open the article to edit its copy or use the existing human review pipeline.
5. Approved articles expose the existing WordPress publish/schedule and Strapi immediate-publish controls when the corresponding provider is connected and the caller has reviewer access. An existing pending request prevents another submission.
6. Connection cards link to the exact WordPress/Strapi settings sections. Owners, admins and marketing managers can test saved connections. WordPress tests address, API, login, publishing capability and SEO setup. Strapi checks reachability and collection read access without creating a test post; create permission is checked during publication.
7. Check website deliveries reconciles up to 50 pending CMS records in the caller's workspace. It does not send new posts or prepare recurring social drafts. Status changes refresh the hub, library, calendar and dashboard.
8. Marketing attention displays failed, missed, overdue or uncertain CMS deliveries, excluding superseded attempts. Failures retain their content. Confirmed Strapi client rejections now use the existing failed-delivery recorder and return the asset to Approved. Network/server uncertainty keeps the publishing reservation to prevent duplicates.
9. A recorded WordPress SEO-save failure remains visible after publication, with a link to the SEO connection settings. A live article is not presented as proof that its search fields were saved.

The attention panel is an in-app notice, bounded to the 50 most recent pending/failed CMS records. Existing database failure alerts remain in use. Advanced SEO scoring and keyword/internal-link recommendations are separate from this publishing workflow.

## Setup and verification limits

Both providers currently report **Not connected** in the local workspace. Live publishing requires a real WordPress site and Application Password or a Strapi site, collection and API token. WordPress SEO requires the selected Yoast/Rank Math configuration; Strapi needs its SEO fields mapped. Provider acceptance and delivery are still verified separately.

No new database migration is required for this view. It uses the existing content approval, publication and workspace access rules. On a deployed host, the existing protected `/api/cron/content-publishing` job refreshes delivery status; local users can run Check website deliveries manually. WordPress owns its scheduled release time.

No live article was sent and no existing draft was saved during browser verification. The temporary title entered to check the character counter was cleared. No credentials were changed or passed to client components.

## Validation

- 687 tests passed across 67 files, including SQL workflow tests and the new workspace/query/action/provider tests.
- Production build passed, including TypeScript and all 52 static pages. ESLint and `git diff --check` passed.
- Landing Pages navigation opened Website publishing & SEO and loaded six existing website articles.
- Approved showed one article. Searching for Delta Cloud preserved the Approved status and returned the matching article; Clear search retained the selected status.
- Inline search metadata opened for an editing article. Typing a 32-character title updated its label to 32/60; the value was cleared without saving.
- Article preview opened against existing copy. Rendering tests separately verified headings, bold text and lists from Markdown fixtures.
- The website-only delivery action completed with `0 deliveries checked.` It did not create or send anything.
- Create blog draft opened `channel=website&format=blog`; the actual form values were Website/Blog. Cancel returned to Website publishing.
- Desktop and 390-pixel mobile views were inspected. Mobile viewport/document widths both measured 390 pixels. Browser error logs were empty.
- Proof files: `website-publishing-desktop.png` and `website-publishing-mobile.png` in the task visualization directory.
- Tests cover workspace isolation, safe filters, stale writes, metadata-only updates, immutable reviewed states, member/reviewer/manager permissions, credential exclusion, uncertain delivery protection and definitive Strapi HTTP rejection.

## Scoped delivery gate

Design read: extend the existing RIL Operate surface. Keep Open Sans, white surfaces, navy text, blue task actions and existing component states. ENERGY 2 / RHYTHM 2 / MOTION 1. Provider panels separate real connections; article boundaries group copy, metadata and delivery for the same record. No new identity, illustrations or decorative motion were introduced.

- R-02 PASS: added product copy contains no em dashes; existing authored article titles remain unchanged.
- R-03 PASS: the mobile document measured 390 pixels at a 390-pixel viewport.
- R-17/R-18 PASS: counts came from existing records; no statistics or testimonials were invented.
- R-23 PASS: the user selected publishing tools inside Landing Pages; existing icons and navigation vocabulary were reused.
- R-24 PASS: workspace tabs, search, blog creation and Cancel navigated to their intended routes; connection links point to existing settings anchors.
- R-25 PASS: the established foreground, muted and primary color tokens were retained; no new text palette was introduced.
- R-26 PASS: search/status navigation, SEO disclosure/counting, preview, delivery checking, creation defaults and Cancel were exercised. Provider write paths were tested with mocks without sending live posts.
- R-27 PASS: missing connections, unavailable articles/alerts, empty results, pending checks, failures and success feedback are implemented and covered by rendering/action tests.
- R-28 PASS: no FAQ changes.
- R-32 PASS: forms have labels, disclosures retain native keyboard behavior, links/buttons keep existing visible focus styles, and feedback uses status/alert roles.
- R-33 PASS: functionality lives in source components/actions; no runtime DOM or CSS patching was added.
- R-34 PASS: semantic theme tokens are inherited; no theme switch or default changed.
- R-35 PASS: build/lint/tests and the recorded browser interactions above passed.
- R-36/R-38 PASS: no fabricated product, security, performance or customer claims were added; connection status is not presented as live verification.
- R-37 PASS: the established visual identity was inherited for a specifically requested feature extension.
- R-01/R-07/R-10/R-12/R-13/R-22 PASS: no new gradients, background patterns, glass, card shadows, glows or illustrations were added.
- R-04 PASS: Globe identifies CMS connections, FileText identifies article delivery, and RefreshCw identifies reconciliation; all reuse Lucide per the existing user direction.
- R-06 PASS: the user-approved Open Sans system and existing type scale remain in use.
- R-08 PASS: external-direction arrows identify connection or live-article navigation, not every task action.
- R-09 PASS: status stamps represent stored workflow states; no promotional badges were added.
- R-14 PASS: provider panels are two distinct connection configurations and article entries group real records; no decorative feature grid was added.
- R-19 PASS: existing disclosure and control transitions communicate state; no decorative motion was added.
- Liveliness PASS: hierarchy follows setup, article preparation, review and delivery. Blue actions and the established workspace typography retain the declared dials.
- C-1 PASS: new elements serve CMS configuration, metadata, review or delivery tasks.
- C-2 PASS: every new action is connected to a server operation or existing route; missing providers give an explicit connection step.
- C-3 PASS: content comes from real workspace articles and the supplied workflow requirements.
- C-4 PASS: null/malformed metadata, unavailable data, disabled/loading controls, role limits, stale writes and mobile composition are covered.
- C-5 PASS: verification distinguishes mocked provider operations from live browser checks and identifies the missing account connections.
- R-05/R-11/R-20/R-21/R-29 PASS: existing composition vocabulary, radii, product identity, theme and palette remain intact.
- R-15/R-16 PASS: actions use concrete task names; no promotional claims or buzzwords were added.
- R-30/R-31 PASS: no ornamental elements were added, and status indicators retain their existing meaning.
