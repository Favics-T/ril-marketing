# Shared shadcn/ui implementation

28 October 2026. The project uses the official shadcn/ui registry with its existing **New York / Radix** configuration, TypeScript, Tailwind CSS v4, and the `@/components/ui` import path. Components are owned source files, as described in the [official installation guide](https://ui.shadcn.com/docs/installation/next).

## Project-wide coverage

| Surface | Shared components |
| --- | --- |
| Public site and authentication | Button, Card, Field, InputGroup, Input, Checkbox, NavigationMenu, Sheet |
| Workspace navigation | Sidebar, Breadcrumb, Command, Tooltip, DropdownMenu, ScrollArea |
| Forms and editors | FieldGroup, Field, FieldSet, Input, Textarea, Select, NativeSelect, RadioGroup, ToggleGroup |
| Dates and scheduling | Calendar inside the shared DateInput Popover; native date/datetime fields retain form values, validation, and time handling |
| Records and statuses | Table, Badge, Pagination; the shared pagination is used by the content library and leads |
| Dashboard and analytics | Card composition, ChartContainer with Recharts, Progress, Tabs |
| Feedback | Alert, Empty, Skeleton, Sonner |
| Confirmation and overlays | AlertDialog, Dialog, Sheet, Popover, Collapsible |
| Rendered content | Table primitives and Separator for Markdown output |

Seven missing official components were downloaded with the CLI: **Sonner, Progress, Pagination, Calendar, Tabs, Alert Dialog, and Scroll Area**. Existing Button, Input, Textarea, Card, and Badge implementations were reconciled with downloaded upstream source. The public site and workspace use these same controls.

The source downloaded for comparison is retained locally in `.playwright-cli/shadcn-upstream/ui/`. The pre-migration source and package manifests are backed up in `.playwright-cli/shadcn-baseline/`. Neither is part of the production app.

## Theme and compatibility

- RIL's logo, Open Sans, and blue identity remain. Semantic Tailwind bindings are in `src/app/globals.css`; RIL's values are in `src/app/ril-theme.css`.
- Components own their variants, dimensions, surfaces, and state styling. Legacy global badge, native-select, and desktop field overrides were removed where they competed with those variants.
- The project's `asChild` Card extension and component `data-slot` hooks remain, preserving semantic sections, server-rendered forms, and mobile layouts.
- The workspace uses Scroll Area for its main viewport. Sidebar scrolling remains part of the shadcn Sidebar component.
- `ToastProvider` mounts one Sonner Toaster. Existing `useToast()` consumers use a compatibility adapter; new code can call `toast` from `sonner`.
- Shared date inputs use the official Calendar while keeping their existing native form contract, reset behavior, min/max bounds, and datetime handling.
- Email batch delivery uses Alert Dialog. Opening or cancelling the confirmation never dispatches a send; only its explicit **Send batch** action calls the existing backend operation.
- Keyboard and reduced-motion behavior remain. The goals/channel section stays permanently visible, and hover underlines remain disabled globally.

## Adding and updating components

Use the existing registry and style. Do not initialize a second component directory or replace the theme as part of a component update.

```powershell
npx shadcn@latest info --json
npx shadcn@latest docs component-name
npx shadcn@latest add @shadcn/component-name --dry-run
npx shadcn@latest add @shadcn/component-name
```

For an existing component, inspect `--diff` before merging upstream changes. Preserve RIL's accessibility, date-field, server-form, and focus-return behavior.

## Verification

The migration includes focused tests for finite, bounded progress values; disabled pagination links; and email confirmation cancellation versus explicit dispatch. Existing authentication, consent, organization isolation, approval, publishing, and reporting tests remain applicable. Production browser checks cover the shared controls and responsive workspace.

- **1,006 tests passed across 101 files**, including chart aggregation and the distinction between missing and zero measurements.
- ESLint, TypeScript, and the production build passed.
- Browser coverage: eight desktop screens and five phone screens, plus tab selection and keyboard navigation, date selection/form values, calendar geometry, sidebar focus and Escape, and command search.
- Public home, sign-in, and sign-up also passed at desktop width and with touch-device emulation. Input groups use consistent 36px desktop and 44px touch heights.
- The new vertical scroll viewport is constrained so the library's horizontal status filters scroll inside their own row. The phone overflow found during review was corrected.
- The goals/channel section has no dropdown trigger. Link hover decoration remains `none`.
- No browser console errors or uncaught page errors were captured in the review. Email delivery tests use mocked actions; no live campaign was sent.
