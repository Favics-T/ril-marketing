# AI settings simplification

The AI & integrations page now starts with AI writing and groups optional apps by the task they support: social publishing, website publishing, website results, and email campaigns.

- AI setup asks for a service and connection key. The existing provider default is selected automatically; all supported models remain available under Advanced options.
- Key help explains how to get a key and makes separate usage billing clear. Existing saved keys, verification, permissions, and disconnect actions are preserved.
- App setup forms open only after Connect or Update details. Cancel returns to the app summary without saving.
- Strapi field mappings remain available under Advanced options, with the existing defaults intact.
- Google setup accepts a downloaded JSON key file as well as manual entry. File contents stay in the form until the user explicitly connects; server-side access checks and encrypted storage are unchanged.

This simplifies the supported connection methods; it does not add sign-in-based authorization for services that require keys. No new external accounts were connected during verification.
