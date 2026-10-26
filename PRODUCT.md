# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: marketing manager / marketing approver inside a client organization. Daily situation: triages AI-generated audience findings, decides approve / annotate / suppress, and feeds only approved intelligence into content repurposing and calendar. Success is faster confident triage with zero auto-applied insights.

Other audiences (secondary, confirmed by roles/routes): owner/admin managing workspace and approval-tier roles; leadership scanning KPIs and campaign rollups.

## Product Purpose

Renaissance Innovation Labs — Audience Intelligence & Learning Layer. Aggregates audience data, behavior analysis, content assets, and leads per segment; detects patterns deterministically; lands insights as PENDING_REVIEW; only APPROVED insights feed recommendations. Success means each pass through the content pipeline gets smarter while humans keep the final decision.

## Positioning

AI recommends. Humans decide. The approval gate is enforced in SQL (`status = 'APPROVED'` in `getAudienceRecommendations`), not just UI. SUPPRESSED insights are never recommended. Content drafts use activity facts, segment needs and preferences, approved insights, and retrieved organization-scoped brand guidance. They remain labelled as suggestions, with model and source activity stored for traceability.

## Operating Context

Marketing operating ritual: Audience Data → Behaviour Analysis → Audience Insight → Content Recommendation → Distribution → Engagement → Conversion → Performance Data → New Learning. Workflows: Command Centre review (tasks, KPIs, pipeline, schedule, follow-ups); segment management; insight review pipeline; activity → repurposing brief with private, organization-scoped source-file storage; organization-scoped Brand Knowledge; AI calendar proposals from upcoming activities + audience preferences + approved insights; content library editor and approval pipeline with registration-link attribution and editable on-page SEO metadata/checklist; standalone SEO review of blog drafts with metadata, search intent, heading outline and internal-link suggestions; direct WordPress publishing after human approval; scheduled/published calendar; campaign creation, objective/audience/funnel/channel/budget planning, activation gates and lifecycle; CRM-lite lead follow-up with explainable scoring; consent-filtered email drafts and second-person approval, encrypted Resend credentials, verified sender check, explicit reviewer queue/send controls, consent rechecks, signed webhook metrics, unsubscribe and complaint/bounce suppression; manually sourced community inbox with AI/rule classification, approved reply drafts, and CRM lead routing without email opt-in (channel sync/posting remains outstanding); opt-in activity-created automation queues campaign, social/newsletter, email and landing-page drafts behind human review; lead nurture remains deferred; saved weekly/monthly/custom reports with underlying metric snapshots, limitations and reviewer status, plus opt-in scheduled weekly/monthly draft generation; opt-in daily trend monitoring; AI provider key management.

## Capabilities and Constraints

Confirmed functionality/routes: `/dashboard` Command Centre; `/activities` (including private source-file intake), `/library` (including draft editing/search/filters/SEO fields and approved WordPress publishing), `/seo` SEO recommendations and editorial checks, `/calendar` (including audience-driven proposals), `/audience/segments`, `/audience/insights`, `/audience/campaigns`, `/audience/landing-pages`, `/p/[slug]` public published lead capture, `/email` consent-filtered campaign drafts and approval, `/reports` persisted period reporting, review and optional scheduled draft generation, `/community` classified inbound items, reply approval and consent-safe CRM routing, `/settings/automation` opt-in activity event queue and draft chain, `/assistant`, `/leads`, `/trends`, `/settings/brand`, `/settings/ai` (including WordPress and Google Analytics/Search Console connections), `/onboarding`, auth (`/sign-in`, `/sign-up`); APIs for lead capture, recommendations, repurposing brief, cron insights, marketing automation, scheduled reports, lead-scoring signals, registration links; search metadata `/sitemap.xml` and `/robots.txt`.

Technical constraints: Next.js 16 + React + TypeScript + Tailwind + shadcn/ui + Supabase (PostgreSQL + Auth + RLS org isolation) + Zod + React Hook Form + Recharts + Lucide. Organization-isolated via RLS; detail pages use `notFound()` for missing/foreign records. Degraded dashboard over missing data, never a crash. Email delivery requires the checked-in delivery migration, `NEXT_PUBLIC_SITE_URL`, `AI_CONFIG_SECRET`, `EMAIL_UNSUBSCRIBE_SECRET`, `CRON_SECRET`, configured Resend credentials, verified sender domain and signed webhook. WordPress Application Passwords and Google service-account keys require a stable `AI_CONFIG_SECRET` for encrypted storage; Google reports need the GA4 and Search Console APIs enabled and read access granted for their properties.

Terminology preserved: segments, insights (PENDING_REVIEW / APPROVED / SUPPRESSED), campaigns, activities, content assets (review/approved/scheduled/published), leads, trends, KPIs, tasks.

Activity media supports private JPEG/PNG/WebP image analysis (up to 8 MB) through a configured vision-capable OpenAI, Claude or Gemini model. It records scene notes and alt text, then saves audience/brand-aware social caption drafts with provenance for human review. With a configured Gemini model, audio/video up to 14 MB can be transcribed and summarized, with approximate key moments, suggested clip ranges and three source-linked drafts; the clip ranges are suggestions and no media editing occurs. PDF, DOCX, TXT and Markdown activity documents (up to 8 MB) can be text-extracted and repurposed into source-linked blog, newsletter and social drafts. Deploy the image-analysis migration to enable media analysis. SEO analysis suggests metadata, search intent, headings and verified internal links for blog drafts; its readiness score is a copy checklist and not a ranking forecast. Approved blog content can publish immediately to WordPress using a verified HTTPS site URL and a dedicated Application Password encrypted with AI_CONFIG_SECRET; published links and status are recorded on the asset. Google Analytics 4 and Search Console are supported in saved reports using read-only service-account access encrypted with AI_CONFIG_SECRET; GA4 users/sessions/views and Search Console clicks, impressions, queries and average position are included when verified properties are configured. Search Console data is delayed and represents the available reporting window, not live rankings or full crawl health. Published campaign pages are public and included in sitemap metadata. CRM leads support human-led, dated follow-up actions with completion tracking; deploy the lead-follow-up migration to enable it. These actions do not send messages or change consent. Trend monitoring supports opt-in daily ingestion from fixed TechCabal and Disrupt Africa RSS feeds, source-preserving deduplication, and AI relevance/audience/angle/risk annotations when a workspace model is configured. Marketing can log manual opportunities, approve or dismiss each signal, and turn approved trends into source-attributed blog, email and social drafts. Stories remain pending human review; deploy the trend-monitoring migration and configure CRON_SECRET for daily sync. Email delivery is implemented against Resend, but requires deployment of its migration, stable secrets, a verified sender domain, and a signed webhook before use. Scheduled reports create review drafts only, using UTC dates; apply the scheduled-reports migration and configure the protected daily cron to enable them. Paid ads, additional CMS providers, channel comment sync/replies, and automated lead nurture still require provider/service work. Activity-to-draft automation has an opt-in queue/worker but requires the included Supabase migration and a configured cron deployment to run. Do not mark integrations as connected until configured and verified.

## Brand Commitments

The supplied 49-page RIL Press Kit is the brand source. Its colour page confirms White #FFFFFF, Black #212120, and Blue #177AE5. Open Sans is used throughout. Logos stay black or white, retain the horizontal icon-and-logotype relationship, and receive no recolouring, rotation, containing shape, or decorative effects. The five named motifs are Momentum, Community, Flow, Excellence, and Productivity. Secondary Renaissance colours chiefly belong to sub-brands.

Voice is optimistic, witty, confident, and clear, with concise human language. Public copy may be expressive; workflow labels, errors, consent, and approval instructions remain literal. The app applies white navigation, a light collaboration canvas, pale-blue contextual areas, softer geometry, and a darker blue for readable small controls. These interface choices are adaptations, not additional media-kit requirements. See DESIGN.md for page references, tokens, geometry, assets, and implementation scope.

## Evidence on Hand

Real implementation in `src/app/(dashboard)/` with Command Centre stats, tasks, KPIs, pipeline, schedule, follow-ups; audience CRUD and approval flows; library and calendar; leads CRM-lite; trends inbox; settings/ai integration board. No real testimonials, customers, benchmarks, or pricing on hand — future work must not fabricate them. Demonstration data may be authored at full fidelity and labelled synthetic; commercial/factual claims stay uninventable.

## Product Principles

1. Human gate before intelligence spreads — nothing auto-applies.
2. Provenance over polish — every recommendation traces to approved insight + activity fact.
3. Operate at a glance, decide with evidence — scanability beats expression.
4. Degrade gracefully, never crash on missing org/data/env.
5. Learning compounds — each content pass feeds the next segment signal.
