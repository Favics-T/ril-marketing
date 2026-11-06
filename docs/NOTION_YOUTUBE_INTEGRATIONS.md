# Notion and YouTube

Implemented 21 October 2026. These are connections inside the marketing platform, using its existing workspace membership, encrypted integration configuration, library, approval and publishing records. No database migration or new package is required.

## Connect

Open **AI & Integrations → Import and repurpose content**.

**Notion:** an owner, admin or marketing manager creates an internal Notion connection with Read content, saves its secret in the Notion card, then shares the required pages with that connection in Notion. The platform verifies the connection before saving it. Test connection checks shared-page access; Disconnect removes local credentials without deleting imported drafts.

**YouTube:** an administrator enables YouTube Data API v3 in Google Cloud, configures OAuth consent and creates a Web application OAuth client. Add the exact callback address displayed in the YouTube setup form. In local development it is `http://localhost:3001/api/integrations/youtube/callback`; use the deployed app's origin in production. Save the client ID and secret, then choose Connect YouTube and authorize the correct channel. If Google's app is in testing, add your Google account as a test user. Google consent, verification and quota requirements still apply.

Both connections require the existing `AI_CONFIG_SECRET` encryption setting before new secrets can be saved. Secrets are never returned to client components. YouTube uses the `youtube.force-ssl` scope because the official captions download endpoint requires video-management access and this scope also permits uploads. OAuth uses PKCE and an expiring, single-use request bound to the initiating user, workspace and callback. Refresh tokens keep access available; concurrent setup changes cannot be overwritten by a delayed callback or refresh.

## Import and repurpose

Choose **Content Library → Import content**. Select Notion or YouTube, load the available content and preview it before importing.

- Notion searches pages shared with the connection, supports pagination and reads nested blocks. Headings, lists, tasks, quotes, code and basic emphasis are retained. Files, child pages and unsupported embeds are not downloaded; the preview warns about omitted material. Large pages are rejected with guidance to split them instead of silently truncating them.
- YouTube lists the connected channel's uploads, imports descriptions and downloads an available serving caption track when permission allows. The official API requires permission to edit a video to download its captions. If captions are missing or denied, users can supply a transcript or import only the description. A description is never labelled as a transcript. This does not download the original video file.
- Importing creates an Editing draft with source URL, provider, source ID and import time in metadata. It does not publish, approve or automatically run AI.
- Repeated imports open the same workspace-specific draft without overwriting edits. Deterministic IDs also prevent concurrent duplicate imports.
- Open the imported draft and choose Repurpose content to use the existing generation and review workflow. Original Notion pages and YouTube videos are unchanged.

## Direct YouTube publishing

Create a YouTube draft, attach an MP4, MOV or WebM video under Content files while it is editable, save the title/description/video settings and obtain independent approval. On the approved item, an eligible reviewer can choose **Publish directly to YouTube**, select an approved attachment, choose Public or Unlisted, review the destination and confirm. Public videos can also be scheduled in WAT. YouTube keeps scheduled uploads private until their publication time. Uploads are limited to the existing 100 MB library attachment limit.

The server rechecks workspace, reviewer role, current asset version, channel, file, description limits and recorded release approvals. It reserves the asset through the existing publication workflow before calling YouTube. A stored resumable session allows Check delivery status to continue the same upload after a timeout. Tokens and upload-session URLs are encrypted. A changed connected channel cannot take over an earlier upload.

Processing or private videos remain Scheduled until YouTube confirms they are processed and public/unlisted. Definite rejection follows the existing failure path back to Approved and its Marketing alert. Ambiguous delivery stays reserved for recovery rather than risking a duplicate upload. Once a receipt exists, the existing content-publishing job checks its delivery at the due time. Uploads with no receipt require an explicit delivery check to resume. Manage changes to an already submitted video's schedule in YouTube Studio, then refresh delivery here.

## Verification and design

Automated tests cover source boundaries, caption failure, nested pages, provenance, duplicate imports, manager/reviewer permissions, OAuth state/actor/expiry/PKCE, encrypted credentials, refresh races, approval gates, uncertain delivery, upload offsets, visibility and channel changes. Build and lint are part of the final checks.

Browser checks cover the new Settings cards, setup instructions and callback address, import source switching, disconnected guidance and 390 px layouts. No credentials were entered, real source records imported or videos uploaded during this verification. Live authorization and provider acceptance still need the workspace owner's real accounts.

The UI follows the existing Open Sans, blue action and light workspace design. Connector cards keep setup beside account status, while import preview separates source selection from the save action. ENERGY 1 / RHYTHM 2 / MOTION 1: existing interaction feedback, no additional decorative animation. Existing controls, focus treatment, loading feedback and error states are reused.

## Provider references

- [Notion authorization](https://developers.notion.com/guides/get-started/authorization)
- [Notion page search](https://developers.notion.com/reference/post-search)
- [Notion block children](https://developers.notion.com/reference/get-block-children)
- [Google server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server)
- [YouTube caption download permissions](https://developers.google.com/youtube/data/reference/rest/v3/captions/download)
- [YouTube video insertion](https://developers.google.com/youtube/data/reference/rest/v3/videos/insert)
- [YouTube resumable uploads](https://developers.google.com/youtube/data/guides/using_resumable_upload_protocol)
