# RIL AI Marketing Platform

Renaissance Innovation Labs' marketing operating workspace. The product links activities, audience intelligence, content, approvals, distribution, leads and campaign measurement. AI proposes; people approve.

## Local setup

```bash
cp .env.example .env
npm install
node scripts/prepare-local-env.mjs
supabase db push
npm run dev
```

`prepare-local-env.mjs` fills missing local secrets without replacing configured values. It uses port 3000 by default; run `node scripts/prepare-local-env.mjs http://localhost:3001` when the dev server runs on 3001. Set `NEXT_PUBLIC_SITE_URL` to the real public origin before deployment.

Configure Supabase project credentials, `CRON_SECRET`, `AI_CONFIG_SECRET`, `EMAIL_UNSUBSCRIBE_SECRET`, and `NEXT_PUBLIC_SITE_URL` in `.env`. Keep the two encryption/token secrets stable after deployment; changing them makes saved provider credentials unreadable or previously issued unsubscribe links invalid. `supabase db push` applies all migrations, including the private activity-media bucket, brand knowledge, landing pages, campaign attribution, consent fields and email delivery tables. Do not expose service-role keys in browser code. Development seed data is in `supabase/seed_dev.sql`; never run it against production. For a full demo workspace — every surface populated across both demo organisations — run `supabase/seed_demo.sql` in the Supabase SQL editor after the migrations. It is idempotent (row ids derive from `md5(organization_id || label)`), it seeds Buffer, Resend, WordPress and Google Analytics as *connected* with fake credentials so the connector cards look live, and it deliberately leaves the AI provider unconfigured so generation uses the built-in template provider. Remove those integration rows with `DELETE FROM integrations WHERE config->>'demo' = 'true';` before the workspace goes real.

## Product surfaces

Before using the workspace, run `npm run check:setup`, `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`. The setup check validates required configuration and database access without printing secrets or sending messages. Use `npm run check:setup -- --production` with your deployment environment to require a public HTTPS site origin. Verify each provider in its settings screen before sending or publishing.

- `/dashboard` — Command Centre: tasks, KPIs, approvals, schedule, upcoming activities and lead follow-up.
- `/activities` — editable activity records, private source-file uploads, and grounded repurposing.
- `/library` — searchable drafts with channel/activity/campaign/status filters, draft editing, on-page SEO metadata and checklist, status transitions, approval history and publishing schedule.
- Manual social posting: open an approved or scheduled social asset, copy its text, publish on the channel, then save the live post URL and confirm **Mark as posted**. The asset records the link, recorder and recording time without requiring a publishing connector.
- `/seo` — topic-grounded website draft analysis, metadata suggestions, heading outlines, published-page link opportunities, and an editorial readiness checklist that does not claim ranking outcomes.
- `/calendar` — scheduled content and audience-driven calendar proposals. Generated proposals enter the library as drafts; they are never automatically scheduled.
- `/audience/segments` and `/audience/insights` — audience personas, learning signals and human approval.
- `/audience/campaigns` — campaign objectives, audiences, funnel stage, date range, budget/currency, channel plan, lifecycle gates, and performance rollups with links to related drafts.
- `/email` — consent-filtered audience counts, campaign drafts, second-person approval, explicit recipient queueing and confirmed send batches. Delivery metrics and unsubscribe/suppression handling are tracked through signed Resend webhooks.
- `/nurture` — separately approved lead sequences. Each step waits for the preceding email to send; paused sequences hold queued retries, and consent is checked again before delivery. Failed deliveries hold the current step for review.
- `/reports` — generate persisted weekly, monthly or custom reports from workspace metrics, with evidence limits and reviewer status; owners, admins and marketing managers can optionally schedule weekly/monthly review drafts.
- `/community` — manual community-item intake, AI or rules-based classification, reply drafting, an approval gate before manual posting, and lead routing into CRM without granting email consent.
- `/settings/automation` — role-gated opt-in activity-to-campaign/content/email/landing-page draft chain with queue history and retry; no automatic sending or publishing.
- `/audience/landing-pages` — landing-page builder and two-role publication flow; each published page gets a unique `/p/[slug]-[page-id]` capture URL, even when organizations use the same slug.
- `/leads` — CRM-lite with explainable scoring, follow-up and explicit marketing consent.
- `/assistant` — workspace-grounded marketing recommendations.
- `/trends` — sourced trend opportunities with human review and optional RSS monitoring.
- `/settings/brand` — organization-scoped knowledge used in relevant drafts.
- `/settings/ai` — AI provider, Buffer, and WordPress publishing settings.

## Audience learning and AI

The recommendation service filters to approved audience insights at query time. Activity generation combines the activity record, segment motivations/preferences, approved insights, and relevant active brand guidance. Generated assets store their source activity and model trace and remain behind the content approval pipeline. The Assistant sends the user's question and limited aggregate workspace evidence to the configured AI provider; it does not send lead contact details. Community items are entered manually until platform comment APIs are configured; suggested replies stay internal until approved and manually posted.

AI provider keys are encrypted at rest. OpenAI-compatible, Claude, and Gemini settings live in `/settings/ai`. Without a configured model, content repurposing uses the deterministic grounded template provider; the Assistant returns a live workspace summary instead of pretending to run a model.

## External services and remaining integration work

WordPress uses a dedicated Application Password over HTTPS. Approved articles can be published immediately or scheduled on WordPress from their Content Library record. An asset-specific slug prevents duplicate articles. The password is encrypted with `AI_CONFIG_SECRET`. Core WordPress receives the article title, semantic headings/lists and an excerpt from the SEO description; writing Yoast or another plugin's metadata requires that plugin's own REST integration.

Buffer supports a verified personal API key, or OAuth with PKCE when a registered client is configured. Approved social text can be sent now or scheduled from its Content Library record. Media-only channels use manual posting. Provider acceptance stays queued until an actual delivery check confirms publication. `/api/cron/content-publishing` checks due requests every ten minutes on a deployed cron-capable host; reviewers can also check a record manually. Requests with an uncertain outcome are reserved against duplicate sends and offer verified receipt recovery. See [publishing workflow verification](WORKFLOW_READINESS.md) for behavior, prerequisites and test coverage.

Google Analytics 4 and Search Console are supported in saved reports. Enable their Google Cloud APIs, grant a dedicated service account read access to both properties, and save its JSON key and property identifiers in `/settings/ai`. The encrypted key requires a stable `AI_CONFIG_SECRET`. Reports show GA4 users, sessions, page views and popular pages, plus Search Console clicks, impressions, top queries and average position for the available reporting window. Search Console data is delayed and does not replace rank tracking, crawl health or keyword-volume tools.

Activity images (JPEG, PNG and WebP up to 8 MB) can be analysed with a configured vision-capable OpenAI, Claude or Gemini model. Scene notes, alt text and caption drafts are saved for human review. With Gemini configured, audio/video up to 14 MB produces a transcript, highlights, clip ranges and four source-linked drafts: blog, newsletter, LinkedIn copy and a YouTube short-form script. Scripts and clip suggestions do not render or edit video. PDF, DOCX, TXT and Markdown activity documents up to 8 MB produce review drafts from extracted text. Apply the existing media-analysis migrations before using these features.

`/seo` checks editable blog and website drafts using the configured model, or transparent local copy checks without a model. People apply suggested metadata and edit the article structure. Published campaign pages appear in `/sitemap.xml`; `/robots.txt` excludes private routes. SEO readiness does not measure rankings, page speed, crawl errors, backlinks or search volume.

Lead follow-up, RSS trend monitoring, email delivery, nurture and activity automation use their checked-in migrations. Email delivery needs a verified Resend sender, signed webhook and the documented secrets; reviewers approve and explicitly queue batches. Nurture requires consent and an activated sequence. Provider credentials, scheduled workers and public webhook origins must be configured before external delivery. Paid-media reporting, other CMS providers and channel comment sync still require provider-specific integrations.

## Useful commands

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Production deployments must apply the checked-in Supabase migrations before using new database-backed features. Scheduled reports additionally require `CRON_SECRET`, the Supabase service-role key, and the `/api/cron/scheduled-reports` Vercel cron entry. The scheduler uses UTC and saves reports as review drafts; it does not email reports.
