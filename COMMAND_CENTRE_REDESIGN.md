# Command Centre redesign

14 October 2026. Guided by the Emil design engineering skill.

The Command Centre now puts human review first: compact linked metrics, a prominent review queue, measured goal progress and source activity in the main column. Calendar, the existing rounded content-mix donut and lead follow-up form the side column. Open Sans, the navy/blue palette and the shared application shell are preserved. Thick decorative top-edge accents remain removed.

Measured goals show numeric percentages and an accessible chart. The chart caps visually at 100% while the numeric label retains above-target values. Unmeasured goals remain available in a keyboard-operable native disclosure with their real targets, rather than appearing as zero progress.

Failed data sources have explicit unavailable states. Empty lists only claim there is no work when their data loaded successfully. The dashboard has a loading layout that matches its new composition. No recurring page entrance or extra animation library was introduced.

Verification:

- Production build, including TypeScript, passed; lint and diff whitespace checks passed.
- Browser checks at 1440×960, 768×1024 and 390×844 showed no document or workspace horizontal overflow.
- All Command Centre links and the goal disclosure met the 44px mobile target minimum.
- The unmeasured-goals disclosure opened to six actual targets and closed through the keyboard.
- A review row opened its existing insight detail route and returned to the dashboard.
- Metrics and chart data remain backed by the existing organization-scoped queries.
- No approval, publishing, lead state, reply draft or external communication was changed during verification.

The content form that was open in the user's existing browser tab was preserved; the dashboard preview opened in a separate tab. Physical-device touch, a full screen-reader session and simulated backend failure injection were not performed. Unavailable-state handling was reviewed in source.

Implementation: `src/app/(dashboard)/dashboard/page.tsx`, scoped `command-centre.css`, dashboard `loading.tsx`, and `src/components/dashboard/command-goals.tsx`. DESIGN.md and the dashboard surface brief describe the new composition.
