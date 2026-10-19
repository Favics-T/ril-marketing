---
version: 1
slug: "src-app-dashboard-dashboard-page-tsx"
primary_target: "src/app/(dashboard)/dashboard/page.tsx"
related_targets: ["src/app/(dashboard)/layout.tsx","src/app/(dashboard)/workspace.css","src/app/(dashboard)/dashboard/command-centre.css","src/components/dashboard/command-goals.tsx","src/components/app-sidebar.tsx","src/app/globals.css"]
---

# Dashboard and shared workspace shell

Mode: Operate. Audience: marketing approvers reviewing pending content and audience insights, and leaders scanning recorded progress.

Current authority is DESIGN.md: the user committed to a modern SaaS workspace, refined with Emil's design engineering principles. The earlier Flatplan and Open Lab contracts are superseded.

Preserve navy navigation, white work surfaces, blue primary actions, Open Sans and the plain RIL logo. Dashboard review, calendar, KPI, content mix and follow-up panels show actual workspace records. Human approval and organization isolation remain mandatory.

Desktop: persistent sidebar and a 1.85:1 main/side dashboard. Compact metrics precede a prominent review queue, measured goal chart, recent activities and open tasks. Calendar, content mix and lead follow-up form the side column. Below 1100px the columns stack; side panels can remain paired until phone widths. Below 768px the sidebar becomes a focus-managed drawer and interactive targets are at least 44px. Text and metadata wrap; tables may scroll inside their containers.

The 14 October Emil redesign keeps the existing palette and chart slices. Unmeasured goals use a native details disclosure with actual targets. Above-target progress keeps its actual numeric label while the chart caps at 100%. No page entrance is added. Every failed data source has an unavailable state instead of a misleading zero or empty message. The dashboard loading state follows the new composition.

Use the semantic dark-surface and status tokens in globals.css. Keep the rounded content-mix donut and text equivalents. Never display missing KPI measurement as zero. Ordinary panel boundaries are light 1px borders: do not restore decorative dark top edges.

Polish remains quiet: visible focus, short press feedback, instant workspace search, no recurring page entrance. No approval, publishing or external communication is performed merely for visual QA.
