# Content workflow updates — 21 October 2026

## Connected channels

New content and draft editing read channel choices from this workspace's connected publishing integrations. Buffer accounts supply social channels; disconnected/locked accounts are omitted and multiple accounts on the same platform share one choice. Paused queues remain available for drafting; publishing keeps its existing queue checks. WordPress/Strapi enable Website, and Resend enables Email. AI and analytics connections do not add publishing destinations.

Without a destination, a draft can be saved as **Not set**. Changing destinations is validated again on the server. Existing content keeps its channel after a disconnection so copy can still be edited; the saved disconnected channel is labelled in the menu. Historical library and calendar filters continue to show recorded channels.

## Repurpose a library item

Both library rows and content detail pages now link to `/repurpose?asset=<id>`. The source form also offers **Content Library item**. It preselects the linked item and its title; older items can be opened directly from their library page even when outside the picker’s latest 100 results.

On save, the authenticated server reads the selected item's copy in the caller's workspace. It ignores browser-supplied replacement copy, rejects missing/short content, and stores a source snapshot with the item ID and update timestamp. This reuses the existing summary-source storage, so no migration is needed. The original is not modified. Generated drafts retain source provenance, go through the existing atomic save path, and need their own human approval. Saving a source does not start an AI run.

## Status dropdown

The status dropdown starts at the actual stored status. Selecting a permitted alternative enables **Save status**. The full pipeline is visible, with unsupported transitions disabled. Existing server/database checks still enforce independent review, named second approvals, channel limits and schedule validation. Publishing remains tied to recorded delivery or a live post link, not a status shortcut.

## Verification

- PASS: 711 tests across 71 files, including connected-account derivation, workspace isolation, server destination validation, library snapshot/provenance checks and current-status rendering.
- PASS: production build and TypeScript; lint passed.
- PASS: browser channel menu showed only X for the workspace's connected account, plus Not set.
- PASS: clicking **Repurpose** on the actual library article preselected that item and its title.
- PASS: the actual article displayed **Review · current**, with Save disabled. Selecting Editing enabled Save; selecting the current status disabled it again. No status was saved during verification.
- PASS: unsupported status options were disabled, including Scheduled and Published from Review.
- PASS: phone viewport at 390px had document width 390px with the status menu open; viewport override was reset afterwards. No browser console errors were recorded.
- PASS: patch whitespace check. No live AI generation, publishing, provider changes or new test records were created during browser verification.

The existing font, palette and panel styling are retained. The dropdown uses the installed shadcn/Radix component so keyboard operation, focus and menu motion stay consistent with the rest of the workspace.
