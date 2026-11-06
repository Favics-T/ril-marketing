# AI settings

| Before | After | Why |
| --- | --- | --- |
| Disconnect result overrode every later connection | Form keeps the latest saved connection snapshot | Reconnecting and repeated model changes show the current state. |
| Stored keys skipped validation when changing models | Every save checks the selected model with the provider | An unavailable model cannot be saved as connected. |
| Encrypted ciphertext supplied the displayed key suffix | Saved keys are decrypted before validation and suffix extraction | Retaining a key displays its actual last four characters. |
| No test control | Test connection checks model metadata without creating content | Users can diagnose access without saving changes or spending generation tokens. |
| Legacy save skipped verification and ignored database errors | Legacy save delegates to the verified save/disconnect actions | All callers use the same validation and error handling. |
| Any workspace member could attempt AI settings changes | Owner, admin and marketing manager checks on save, test and disconnect | Permissions match other account connectors. |

Checks use the vendors' model metadata endpoints: [OpenAI](https://developers.openai.com/api/reference/resources/models/methods/retrieve), [Claude](https://platform.claude.com/docs/en/api/models/retrieve), and [Gemini](https://ai.google.dev/api/models). They establish key and model access; generation still depends on provider credits, quota and service availability. Keys are passed in headers, not request URLs. Failed checks never write the connection. A blank key can retain the existing provider's key, but cannot switch providers.

The client keeps a pasted key after a test, clears it after saving or switching providers, disables competing requests while pending, and restores the saved provider/model on Cancel. Server-managed keys cannot be overridden by workspace mutations. Reduced-access members see disabled AI controls.

The editable form prevents React's automatic native form reset after an action. Otherwise, a failed save could reset the radio inputs to their original provider while leaving the controlled model on the attempted provider. Failed submissions now preserve the selection consistently for a retry.

Regression coverage includes encrypted-key retention, cross-provider key reuse prevention, rejected models, provider/network failures, database failures, manager permissions, server-managed overrides, and disconnect followed by reconnect. Tests use mocked providers and storage; they do not create real content or replace the workspace's credentials.

Validation: all 231 tests across 27 files pass. Production build/TypeScript and targeted ESLint pass. The authenticated browser's saved Gemini 3.5 Flash-Lite connection passed the live read-only model check; no generation request was sent and the saved key was left unchanged.

Browser checks also confirmed that switching to OpenAI with a blank key fails without changing the saved Gemini connection. After the failure, OpenAI stays selected and matches its model field. Cancel returns to the saved Gemini summary. The form has no horizontal overflow at 390px phone width. Temporary viewport overrides were reset.
