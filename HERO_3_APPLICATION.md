# Efferd Hero 3 application

The installed `HeroSection` is now rendered by `ProductHome` on `/`. It replaces the previous split hero with the requested headline-and-framed-preview structure. RIL copy, Open Sans, navy surfaces and blue actions preserve the established identity. The preview illustrates the real source, draft, review and release workflow; it contains no private records, fabricated metrics or invented endorsements.

Signed-in visitors can view the public homepage and choose **Open workspace** rather than being redirected automatically. Anonymous visitors see **Create your workspace**. Authentication for private workspace routes remains enforced by the existing proxy.

| Before | After | Why |
| --- | --- | --- |
| Installed component unused by the homepage | `ProductHome` renders `HeroSection` | The requested block is visible on the actual route. |
| Copy beside a navy workflow panel | Product copy above a framed workspace illustration | Apply the user's selected Hero 3 composition. |
| Homepage redirects authenticated visitors | Auth-aware workspace link | The user can view and review the hero while signed in. |
| Stock agency copy and inactive actions | RIL copy, `/dashboard` or `/sign-up`, and section links | Preserve truthful product content and working actions. |

Verification: production build and TypeScript pass. ESLint has no errors and one pre-existing warning in the unused registry `logo-cloud.tsx`. The authenticated browser shows the new hero on `/`, loads the RIL logo, and has no overflow at 1280 px or 390 px. Both hero section links scroll to their targets below the sticky header, and the workspace action reaches the Command Centre. Mobile navigation opens and closes with Escape. The viewport was reset after testing. An anonymous HTTP request returns 200, renders the hero and sign-up action, and has no signed-in workspace action.

## Design delivery gate

- Hard gate PASS: functioning routes and anchors, accessible hero heading, real RIL assets, explicitly illustrative preview, no fabricated statistics and no horizontal overflow in desktop/mobile checks.
- Purpose gate PASS: the single preview frame groups the source-to-release workflow; Lucide icons identify actual product functions, navy separates navigation, and blue identifies actions. No decorative motion was introduced.
- Liveliness PASS: the existing DESIGN.md direction remains ENERGY 2 / RHYTHM 2 / MOTION 1; headline, actions and framed preview establish the focal point and hierarchy.
- Craft gate PASS: build and TypeScript pass, lint has no errors, hero actions were clicked, mobile menu was checked with Escape, and authenticated/anonymous homepage behavior was verified.
