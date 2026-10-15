# Content quality, editor and post-approval workflow — scope

**Status:** Draft for product review · 2 October 2026
**Related:** [content-gap-audit.md](content-gap-audit.md) (full PRD gap audit)

## The problem

In the Content Library, a piece of content can be drafted, edited, reviewed and approved. **After approval, most of it has nowhere to go:**

| Approved content | What a user can do today |
|---|---|
| Blog article | Publish it immediately to WordPress or Strapi. It can't be scheduled. |
| Social post or image caption | Nothing. Setting the status to "Scheduled" or "Published" doesn't post anything, and nobody is reminded. |
| Newsletter | Nothing. It has to be retyped by hand as an email campaign. |

The statuses "Scheduled" and "Published" are labels that people set by hand. Nothing records where content went, when, or whether it worked.

There are also problems with the content itself, before approval:

- **Blogs reach the website with raw formatting symbols.** Drafts use Markdown headings such as `# Title`, but the website receives them as plain paragraphs, so the `#` shows on the live page. Emails are sent as plain text.
- **Social drafts follow no platform rules.** There are no length limits, hashtag rules or format differences, and nothing checks the result.
- **When the AI fails, the app quietly swaps in a fixed template** without telling the user.
- **Changing approved content is clumsy.** Someone has to move it back to Editing by hand. Nothing cancels its schedule, and the reviewer can't see what changed.

## Goal for this phase

1. **Better drafts:** AI drafts use everything known about the activity, follow each platform's rules, and say clearly when something went wrong.
2. **A proper editor:** formatted text for blogs and newsletters, plain text with live character limits for social, and an edit-after-approval flow that always goes back for review.
3. **A clear next step after approval:** every approved item ends in a recorded outcome (**posted, scheduled, or handed to email**), and the calendar and dashboard show what's due and what went wrong.

## Not in this phase

- **Automatic social posting (Buffer).** Parked by decision. Social posts are published manually for now (card 2), and the cards are designed so Buffer can be added later without rework.
- Short-form video clip editing.
- Fixing how approval rules are enforced. The gap audit found that approval checks can be bypassed and that the second approver for sensitive content never triggers. **This should be its own card before launch** (see "Recommended separate work").

## Trello setup

- **Lists:** Backlog → Ready → In progress → In review → Done
- **Labels:** `Publishing` · `Email` · `Calendar` · `Content quality` · `Editor` · `Fix`
- **Estimates:** S = up to 1 day · M = 2–5 days (one developer)

Paste each card below into Trello. The **Done when** items work as a Trello checklist.

---

## Card 1 — Publish history on every content item

**Label:** Publishing · **Estimate:** M · **Depends on:** nothing (build first)

**Why:** Today the app doesn't remember where a piece of content went. Every other card writes into this history.

**What it does:** Each content item gets a "Where this went" section listing every time it was posted, scheduled or handed off: the channel, date and time, who did it, a link to the live post, and the result (scheduled / posted / failed).

**Done when:**
- [ ] Every publish, schedule and hand-off action adds an entry to the item's history
- [ ] The history shows channel, time, person, link and result
- [ ] Failed attempts show the reason in plain language
- [ ] One item can have several entries (for example, the same blog on WordPress and later re-shared)

> Eng note: the `publications` table already exists but is never read. Extend it with `method` (manual / wordpress / strapi / email), `url` and `created_by`, and restrict who can write to it.

---

## Card 2 — Post social content manually and record it

**Label:** Publishing · **Estimate:** S · **Depends on:** Card 1

**Why:** Without Buffer, someone posts to LinkedIn, X or Instagram by hand. The app should make that quick and record that it happened.

**What it does:** Approved social posts and image captions get two buttons:
- **Copy post text**, which copies the copy and hashtags in one click. Image captions also offer **Download image**.
- **Mark as posted**, where the user pastes the live post link. The item moves to Published and the entry appears in its history.

**Done when:**
- [ ] Copy includes the body and hashtags exactly as approved
- [ ] Image captions allow downloading the original photo they were written for
- [ ] "Mark as posted" requires a valid https link and records the time and person
- [ ] The item's status becomes Published and it appears on the calendar on the day it was posted
- [ ] Only approved or scheduled items show these buttons

---

## Card 3 — Schedule a social post (manual reminder)

**Label:** Publishing · Calendar · **Estimate:** S · **Depends on:** Cards 1, 2, 9

**Why:** "Scheduled" currently does nothing. Until posting is automatic, scheduling should act as a reliable reminder.

**What it does:** The user picks a date and time. The post appears on the calendar. On the day, it shows on the dashboard under **Due to post today**. If it isn't marked as posted by its time, it's flagged as **Overdue**.

**Done when:**
- [ ] Scheduling records the time in Lagos time (WAT) and shows it the same way everywhere
- [ ] The dashboard lists posts due today, with Copy and Mark as posted actions
- [ ] Posts past their time and not marked as posted show as Overdue on the dashboard and calendar
- [ ] Rescheduling and unscheduling are possible and show in the history

> Later: when Buffer is connected, the same Schedule button sends the post to Buffer instead of creating a reminder. Users won't see a different workflow.

---

## Card 4 — Schedule a blog on WordPress

**Label:** Publishing · **Estimate:** M · **Depends on:** Cards 1, 9

**Why:** Blogs can only go out "now". Marketing needs to line them up for a date.

**What it does:** Next to **Publish now**, add **Schedule** with a date and time. WordPress holds the article and publishes it at that time. The app checks back and marks the item Published, with the live link.

**Done when:**
- [ ] A scheduled blog appears in WordPress as "Scheduled" for the chosen time
- [ ] The item shows as Scheduled on the calendar
- [ ] After the publish time, the app updates the item to Published with the live link
- [ ] If WordPress rejects the post, or the article isn't live by its time, the item returns to Approved and a failure is shown (Card 10)
- [ ] Rescheduling or cancelling updates WordPress too

> Eng note: WordPress supports `status: "future"` with a date. Confirming the post went live needs a periodic check, and how often it runs depends on the hosting plan (see open question 3).

---

## Card 5 — Schedule a blog on Strapi

**Label:** Publishing · **Estimate:** M · **Depends on:** Card 4

**Why:** Same as Card 4, for Strapi.

**What it does / Done when:** Same as Card 4.

> **Needs a decision first (open question 1).** Strapi can't schedule posts by itself, so the app would have to publish at the right time using its own timer. If RIL's site runs on WordPress, **drop this card**.

---

## Card 6 — Send SEO title and description to the website

**Label:** Publishing · **Estimate:** S · **Depends on:** nothing

**Why:** Marketing writes an SEO title and meta description in the app, but only a short excerpt reaches the website. Search engines never see what was written.

**Done when:**
- [ ] Publishing or scheduling a blog sends the SEO title and meta description to the site's SEO fields
- [ ] If the site has no supported SEO plugin, the app says so before publishing instead of silently dropping them

> Needs open question 2 answered: which SEO plugin the WordPress site uses (for example Yoast or Rank Math).

---

## Card 7 — Turn an approved newsletter into an email campaign

**Label:** Email · **Estimate:** S · **Depends on:** Card 1

**Why:** Approved newsletters currently have to be retyped on the Email page.

**What it does:** Approved newsletters get a **Create email campaign** button. It opens a new email draft on the Email page with the name, subject line, preview text, body, audience and campaign already filled in. The email still goes through its own review and approval before anything is sent.

**Done when:**
- [ ] The email draft is filled in from the newsletter, and the user can edit everything
- [ ] The newsletter and the email link to each other
- [ ] Clicking the button twice opens the existing draft instead of creating a duplicate
- [ ] Nothing is sent without the email's own approval

---

## Card 8 — Calendar shows the full pipeline and allows rescheduling

**Label:** Calendar · **Estimate:** M · **Depends on:** Cards 3, 4, 9

**Why:** The calendar only shows scheduled and published items, as a single monthly list. Approved items waiting for a date, and overdue posts, are invisible.

**What it does:**
- Shows **Approved (no date yet)** as a side list, and **Scheduled**, **Published** and **Overdue** items on their dates
- Adds a **Week** view alongside Month
- Adds filters by channel and campaign
- Lets users reschedule an item from the calendar with a date picker

**Done when:**
- [ ] Approved-but-undated items are listed and can be given a date from the calendar
- [ ] Each entry shows channel, status and time in WAT
- [ ] Week and Month views work, with channel and campaign filters
- [ ] Rescheduling from the calendar updates the item, its history and (for WordPress) the website

> Drag-and-drop rescheduling is left for a later phase. A date picker gives the same result with much less work.

---

## Card 9 — Fix scheduled times being an hour off

**Label:** Fix · **Estimate:** S · **Depends on:** nothing (do early)

**Why:** A time entered as 9:00 is currently saved as 9:00 UTC, which is 10:00 in Lagos. The calendar and dashboard can also show different times for the same item.

**Done when:**
- [ ] Times entered by users are saved and shown in Lagos time (WAT)
- [ ] The calendar, dashboard and content item page all show the same time
- [ ] Existing scheduled items are checked and corrected if needed

---

## Card 10 — Show failures and overdue posts on the dashboard

**Label:** Publishing · **Estimate:** S · **Depends on:** Cards 1, 3, 4

**Why:** When a website publish fails today, nobody is told. The PRD requires a failed publish to return the item to Approved and alert Marketing.

**Done when:**
- [ ] Failed website publishes appear under "Needs attention" on the dashboard, with the reason and a link to the item
- [ ] Overdue manual social posts appear there too
- [ ] The failed item returns to Approved, with nothing lost
- [ ] Alerts clear once the item is published or rescheduled

---

## Card 11 — Tracked registration link in each post (optional for this phase)

**Label:** Publishing · **Estimate:** M · **Depends on:** Card 2

**Why:** The PRD wants each post to carry its own registration link, so Marketing can see which post brought in a sign-up. The database pieces exist, but nothing creates or uses the links.

**What it does:** When the content's activity has a registration link, approving the content creates a unique short link for it. The link appears in Copy post text, and clicking it takes people to the registration page. Sign-ups through it are credited to that post.

**Done when:**
- [ ] Each approved item with a registration link gets its own short link
- [ ] The short link is included when copying post text
- [ ] Clicking it goes to the activity's registration page
- [ ] Sign-ups through it are credited to that post and visible on the item

> See open question 5: include this now, or in the next phase?

---

# Content quality

## Card 12 — AI drafts use everything known about the activity

**Label:** Content quality · **Estimate:** M · **Depends on:** nothing

**Why:** Drafts already use the activity's title, description, outcomes, speakers, partners, date, audience and brand guidance. They miss things that make copy specific and actionable.

**What it does:** Generation also uses:
- the activity's **registration link and deadline**, so the call to action is real rather than "Learn more"
- the linked **campaign's goal, target audience and funnel stage**
- **transcripts, document text and image notes** already produced for that activity's files
- an optional short **brief from the user** before generating: tone, length, goal, and the call to action to use

**Done when:**
- [ ] Drafts for an activity with a registration link use it as the call to action
- [ ] Drafts reflect the campaign's goal when the activity belongs to a campaign
- [ ] If a video or document was analysed, its content informs the drafts, and nothing outside the sources is stated as fact
- [ ] The optional brief is saved with the draft, so reviewers can see what was asked for
- [ ] Missing information is left out, never invented

---

## Card 13 — Platform-specific writing rules

**Label:** Content quality · **Estimate:** M · **Depends on:** nothing (Card 16 reuses the same rules)

**Why:** Today one line of instruction covers all social platforms. Each platform needs its own length, structure, hashtag and tone rules, and drafts need checking against them.

**What it does:** One shared rules list per channel, used both to write drafts and to check them. Proposed starting values, **to be confirmed by Marketing**:

| Channel | Hard limit | Guidance |
|---|---|---|
| LinkedIn | 3,000 characters | Strong first two lines, short paragraphs, 3–5 hashtags at the end |
| X | 280 characters per post | One idea per post, optional thread, 1–2 hashtags |
| Instagram | 2,200 characters, 30 hashtags | Hook in the first line, hashtags at the end |
| Facebook | — | Conversational, link in the post |
| Email subject | — | About 60 characters or fewer, plus preview text |
| Blog | — | Title, short intro, 2+ section headings, call to action |

**Done when:**
- [ ] Each channel's rules are written in one place and easy to change
- [ ] Generation uses the rules for the target channel
- [ ] Every new draft is checked against its channel's hard limit; drafts over the limit are retried once, then flagged for the editor
- [ ] Social drafts for different platforms from the same source are clearly different, not copies

---

## Card 14 — Show AI failures instead of hiding them

**Label:** Content quality · Fix · **Estimate:** S · **Depends on:** nothing

**Why:** When the AI provider errors or returns something unusable, the app quietly swaps in a fixed template, and records it as if the AI wrote it. Users can't tell a real draft from boilerplate.

**Done when:**
- [ ] If generation fails, the user sees a plain-language reason (no AI connected, provider error, response unusable) and a **Try again** button
- [ ] No template draft is created without the user's say-so. If a template fallback is kept as an option, the draft is clearly labelled "Template — not AI-written"
- [ ] Each draft records which model actually wrote it
- [ ] Failures are logged, so the team can see how often they happen

---

# Content editor

## Card 15 — Formatted text editor for blogs and newsletters

**Label:** Editor · **Estimate:** L · **Depends on:** nothing. Do it **before or together with Cards 4–7**, so website and email output are built once.

**Why:** Blogs and newsletters are edited in a plain text box. Headings, bold text, lists and links don't exist, and the website shows raw `#` symbols.

**What it does:** Blogs and newsletters get a formatted text editor with headings, bold, italic, bulleted and numbered lists, links and quotes. What you see in the editor is what readers get:
- **WordPress** receives properly formatted article content
- **Strapi** receives content in the format its body field expects (see open question 8)
- **Email** sends a formatted version plus a plain-text version for email apps that need one
- AI drafts arrive already formatted

**Done when:**
- [ ] Blogs and newsletters open in the formatted editor; social posts don't
- [ ] Headings, bold, italic, lists, links and quotes work, and pasting from Word or Google Docs keeps that formatting without messy styling
- [ ] A published WordPress article looks the same as it did in the editor, with no raw symbols
- [ ] Emails arrive formatted, with a plain-text version included
- [ ] Existing drafts convert to the new format without losing content

> Out of scope for now: images placed inside the article body, and tables.

---

## Card 16 — Social post editor with live character limits

**Label:** Editor · **Estimate:** S · **Depends on:** Card 13

**Why:** Social copy has hard limits, and the editor currently shows no counter for post text.

**What it does:** Social posts and captions stay as plain text, with:
- a live counter showing characters used out of the platform's limit
- a warning as the post nears the limit, and a red state over it
- a hashtag count where the platform limits hashtags
- a choice of channel from a fixed list instead of free typing, so the right rules always apply

**Done when:**
- [ ] The counter updates while typing and matches the platform's limit from Card 13
- [ ] A post over its limit **can't be sent for review**, and the reason is shown
- [ ] The channel is chosen from a list; existing free-typed channels are mapped to it
- [ ] The check is also enforced when content is approved, not just in the editor

---

## Card 17 — Editing approved content sends it back for review

**Label:** Editor · **Estimate:** M · **Depends on:** Card 1 (history). Interacts with Cards 3–4 (schedules).

**Why:** Approved copy is locked, which is correct. But changing it means moving it back to Editing by hand: schedules stay in place, and the reviewer can't see what changed.

**What it does:** Approved and scheduled items get an **Edit** button. It warns: *"Editing will remove approval and cancel any schedule. It must be reviewed again."* On confirmation:
- the item returns to Editing, and any schedule is cancelled, including a scheduled WordPress post
- when it goes back for review, the reviewer sees **what changed since the last approval**, side by side
- the history records who reopened it and why

**Done when:**
- [ ] Every edit to approved or scheduled copy (including the SEO title and description) requires re-approval
- [ ] Reopening cancels the schedule in the app and on the website, and the calendar updates
- [ ] Reviewers see the changes since the last approved version
- [ ] Published content can't be edited this way (see open question 9)

> Related: the gap audit found the approval lock can be bypassed outside the app screens. Card 17 works in the app, but the database lock (Recommended separate work) is what makes it watertight.

---

## Suggested order

Two tracks that can run in parallel:

**Track A — content quality and editor**
1. **Card 14** (show failures): quick, and makes every other generation change easier to test
2. **Cards 13, 16**: platform rules, then the social editor that uses them
3. **Card 12**: richer prompts
4. **Card 15**: formatted editor. Must land before Cards 4–7 are finished.
5. **Card 17**: edit-after-approval

**Track B — after approval**
1. **Card 9** (time fix) and **Card 1** (history): the foundation for everything else
2. **Cards 2, 3, 10**: social posts get a real workflow
3. **Card 7**: newsletters reach email
4. **Cards 4, 6**: blog scheduling and SEO
5. **Card 8**: calendar
6. **Cards 5, 11**: only if the open questions say yes

**Rough total, all 17 cards:** about 6–8 weeks for one developer, or about 4 weeks with one developer per track. Dropping Cards 5 and 11 saves about 1–1.5 weeks.

## Open questions for product

1. **Which CMS is RIL's live site on: WordPress, Strapi, or both?** If WordPress only, drop Card 5.
2. **Which SEO plugin does the WordPress site use?** This decides how Card 6 is built.
3. **How soon after a scheduled time must the app confirm a post went live?** Checking within the hour may need a hosting plan upgrade; the current background jobs run once a day.
4. **When a newsletter becomes an email (Card 7), should the email be submitted for review automatically, or start as a draft?**
5. **Should tracked registration links (Card 11) be in this phase?**
6. **Who can mark a social post as posted:** any team member, or only reviewers?
7. **Do the platform rules in Card 13 match how RIL writes?** For example: hashtag counts, whether X posts may be threads, and an ideal LinkedIn length.
8. **If Strapi stays in scope, is its article body a "Rich text (Markdown)" field or a "Rich text (Blocks)" field?** This decides how Card 15 formats content for Strapi.
9. **Should published content be editable?** Options: never (recommended for now), or edit and push the update to the website after re-approval.

## Recommended separate work (before launch)

From [content-gap-audit.md](content-gap-audit.md), not part of this scope but worth a card each:

- **Approval rules can be bypassed.** Any team member could mark content approved by going around the app screens. Lock this down in the database. *(M)*
- **The second approver for sensitive content never triggers.** Nothing in the app marks content as sensitive. *(M)*
