# Provider connection setup

AI & Integrations now includes **Check connections**. Workspace owners, admins and marketing managers can verify all six configured services together. Each result distinguishes saved configuration from verified access and links to its setup form. The checks do not generate content, publish posts or send email. Buffer may refresh its access token and cached channel list as part of checking access.

| Service | What the check verifies | Account details still needed |
| --- | --- | --- |
| AI writing | The selected provider accepts the saved key and selected model | Gemini passed the live check; other AI providers are alternatives, not additional required accounts |
| Buffer | The key works and at least one linked channel is available, unlocked and not paused | A Buffer API key and linked social accounts; the key flow does not require OAuth environment variables |
| WordPress | A public site address, application-password login, publishing capability and the selected SEO integration | Replace the saved placeholder site address and credentials with the real WordPress site details |
| Strapi | Token access to the configured article collection | Site address, API token and collection API ID; create permission is exercised only by an explicit publishing request |
| Google Analytics & Search Console | Service-account authentication and successful report reads from both configured properties | Replace the placeholder Search Console property and provide a service-account key with access to both services |
| Resend | API key acceptance and verified sender-domain access; webhook-secret and public-origin configuration | Replace the rejected key, use a sender on the verified domain, and configure the signed webhook |

The owner is entering the remaining credentials through the application forms. No fabricated keys, account grants, or replacement secrets were created. Existing configuration is preserved so it can be corrected in place. Diagnostic results contain no API keys, passwords or private keys.

## Deployment requirement for email

The owner confirmed the application is **not deployed yet**. `NEXT_PUBLIC_SITE_URL` remains the existing localhost address for development. No public domain was invented or written to `.env`.

Provider credentials can still be saved and verified locally. Live email queuing/sending requires a public HTTPS application origin, so recipients get working unsubscribe links and Resend can reach the webhook. The queue action and delivery worker share the same validation. The worker checks it before claiming queued messages, preserving retries when deployment configuration is missing. The Email setup page explains why a local address cannot be used.

After deployment, set `NEXT_PUBLIC_SITE_URL` to the actual public origin and configure Resend's webhook at `/api/webhooks/resend`, with the signing secret saved in Email settings. A saved signing secret does not prove that the provider webhook is registered; actual events must be confirmed after an explicitly authorised send.

## Validation

- Gemini's live key/model request succeeded without a paid generation call.
- Live checks identified the missing Buffer/Strapi setup, placeholder WordPress/Search Console data, and rejected Resend key. They were not labelled as working connections.
- 449 tests pass across 49 files, including manager-only authorisation, failure isolation, credential-safe messages, unavailable channels, invalid sender credentials, public-origin checks, and preventing email claims when the app is local-only.
- Lint, TypeScript and production build checked; the authenticated diagnostics flow was exercised in the browser.
- No external post, CMS article or email was sent for testing.

Current live health results are saved outside the repository at `C:/Users/ghost/.codex/backups/provider-health-latest.json`. Re-run **Check connections** after saving account changes to obtain current results.
