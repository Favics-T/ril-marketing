export type WorkflowGuide = {
  title: string;
  purpose: string;
  steps: readonly [string, string, string];
  next: { label: string; href: string };
};

const guides: Record<string, WorkflowGuide> = {
  "/dashboard": {
    title: "Find your next task", purpose: "Start new work or pick up something waiting for your team.",
    steps: ["Log an activity to keep its facts and files together, or add a draft you already have.", "Open Approvals to review requests. Authors need another reviewer.", "After approval, choose how to publish. Track the results in Analytics and Reports."],
    next: { label: "Write a draft", href: "/library/new" },
  },
  "/activities": {
    title: "Turn an activity into content", purpose: "An activity is the source record for an event, programme or partnership.",
    steps: ["Log the name, description and any details you know. You can fill in optional information later.", "Open the saved activity to attach private files or link existing items from the Content Library.", "Choose draft formats to generate from the activity, or open a linked library item to repurpose its copy or files. Each draft needs review."],
    next: { label: "Log an activity", href: "/activities/new" },
  },
  "/library": {
    title: "Take content from draft to published", purpose: "Keep the copy, source, approvals and delivery history in one record.",
    steps: ["Write or paste your copy and attach source files if needed. Files upload privately when you save; you can add more on the saved item.", "Open a draft, save your edits, then choose Review in Content status. Another reviewer records approval.", "Once approved, use its publishing controls or post manually and record the live link. Selecting Scheduled only reserves a calendar time."],
    next: { label: "Add content", href: "/library/new" },
  },
  "/repurpose": {
    title: "Reuse a source in new formats", purpose: "Create new versions without changing the original material.",
    steps: ["Choose a library item, activity, file, public link or pasted text. Select the formats you need.", "Save the source, then choose Generate drafts on the next page. Saving alone does not run AI.", "Open each generated draft, check it against the source, edit it and send it for review."],
    next: { label: "Choose a source", href: "/repurpose" },
  },
  "/library/import": {
    title: "Import a source", purpose: "Bring shared Notion pages or your YouTube channel content into an editable library copy.",
    steps: ["Connect Notion or YouTube in AI & Integrations, then choose that source here.", "Find the page or video and preview its text. Add a transcript if YouTube captions are unavailable.", "Import and open the draft. Use Repurpose content for new formats, then edit and request review."],
    next: { label: "Manage source connections", href: "/settings/ai#connectors" },
  },
  "/seo": {
    title: "Prepare a blog for search", purpose: "Improve website drafts before review and publishing.",
    steps: ["Create a website blog draft with body copy, or open an existing editable article.", "Run the editorial checks, review suggestions and apply the changes you want.", "Request content approval, then publish the approved article from Website publishing."],
    next: { label: "Create a blog draft", href: "/library/new?channel=website&format=blog" },
  },
  "/calendar": {
    title: "Choose when content goes out", purpose: "See planned work by day, week or month. Times use West Africa Time (UTC+1).",
    steps: ["Find approved content in Unscheduled. Open drafts to complete review first.", "Choose Schedule, or drag an approved item onto a day. Confirm the date and time.", "A reservation is a reminder. Use the content’s publishing controls for automatic delivery, or record the live link after posting manually."],
    next: { label: "Find approved content", href: "/library?status=approved" },
  },
  "/publishing": {
    title: "Publish an approved social post", purpose: "Choose connected delivery or record a post you published yourself.",
    steps: ["Use Drafts and In review to finish the copy and obtain independent approval.", "Open an approved post. Choose a Buffer account and delivery time, or copy the text and post it yourself.", "For manual posts, save the live link. For Buffer posts, check delivery history and resolve any failed attempts."],
    next: { label: "View approved posts", href: "/publishing?stage=approved" },
  },
  "/approvals": {
    title: "Review a request", purpose: "Approval records a decision; it does not publish or send anything.",
    steps: ["Open a request and read its full content, source evidence and any sensitivity notes.", "Approve only if you are an eligible independent reviewer. Return content to Editing when changes are needed.", "Sensitive content needs a second named approval. After approval, an authorized person chooses when to publish or send."],
    next: { label: "View content awaiting review", href: "/library?status=review" },
  },
  "/audience/segments": {
    title: "Describe an audience", purpose: "A segment is a named group of people with shared needs.",
    steps: ["Create a segment with a clear name and description of who belongs in it.", "Add what they need and the formats or channels they prefer. Leave unknown details blank.", "Link the segment when creating activities, campaigns or emails so the work speaks to the right people."],
    next: { label: "Create an audience segment", href: "/audience/segments/new" },
  },
  "/audience/insights": {
    title: "Review what the data suggests", purpose: "Insights are proposed audience findings, not established facts.",
    steps: ["Open a finding and read the supporting data, sample size and limitations.", "Approve useful, supported findings. Suppress misleading or irrelevant ones and record why.", "Approved insights can inform future recommendations and drafts. They do not publish content."],
    next: { label: "Review pending insights", href: "/audience/insights?status=PENDING_REVIEW" },
  },
  "/audience/campaigns": {
    title: "Keep an initiative together", purpose: "A campaign groups activities, content and results around one objective.",
    steps: ["Create a campaign with a name and the result you want to achieve.", "Add its audience, dates and channels. Link activities, content, emails and landing pages to it.", "Open the campaign’s content and results links to see progress. Campaign status does not approve or publish its content."],
    next: { label: "Log a campaign activity", href: "/activities/new" },
  },
  "/audience/landing-pages": {
    title: "Publish a page or article", purpose: "Campaign pages collect interest here; website articles go to WordPress or Strapi.",
    steps: ["Choose Campaign pages to build a sign-up page, or Website publishing & SEO for an article on your website.", "Save the draft and request independent review. Check the copy, button and destination before approval.", "Publish only after approval. Use the live page link to share it, and follow captured contacts in Leads."],
    next: { label: "Create a campaign page", href: "/audience/landing-pages/new" },
  },
  "/leads": {
    title: "Follow up with a contact", purpose: "Leads are people who have expressed interest through your capture forms or recorded outreach.",
    steps: ["Open a lead to see their interest, source and contact details.", "Assign an owner, record a note and set a follow-up with a due date.", "Update their stage as the relationship progresses. Email and nurture require active marketing consent."],
    next: { label: "Manage lead capture pages", href: "/audience/landing-pages" },
  },
  "/email": {
    title: "Send an email campaign", purpose: "A saved draft never sends by itself.",
    steps: ["Create a draft, choose an audience and write the subject and full message. Sender setup can be completed before delivery.", "Submit it for review. A different eligible reviewer checks and approves the message.", "With a verified sender and eligible recipients, open delivery controls to queue or schedule the approved email. Track delivery below it."],
    next: { label: "Manage audience segments", href: "/audience/segments" },
  },
  "/nurture": {
    title: "Build a series of follow-up emails", purpose: "A sequence sends a series of messages with a delay between steps.",
    steps: ["Create a draft sequence and add the emails in order, including each delay.", "Have a second reviewer activate the sequence. Connect your email sender before sending.", "Enroll a consenting lead from their profile, or enable automatic enrolment for future matching leads. Monitor and pause sequences when needed."],
    next: { label: "Set up the email sender", href: "/email#sender-settings" },
  },
  "/reports": {
    title: "Create and review a report", purpose: "Summarize recorded results for a clear period.",
    steps: ["Choose the last complete week, last complete month, or a custom date range.", "Generate a draft report. Review the metrics, narrative and coverage limitations.", "An eligible reviewer marks the report reviewed. Optional scheduling creates future drafts; it does not email them."],
    next: { label: "Explore the underlying results", href: "/analytics" },
  },
  "/analytics": {
    title: "Understand recorded results", purpose: "Compare content performance and lead capture across the last eight weeks.",
    steps: ["Check the totals and date range, then inspect the weekly lead chart.", "Compare lead sources and content results. Missing external data is different from a measured zero.", "Create a report for a period you want to review with the team. Connect Google tools to add website evidence."],
    next: { label: "Create a report", href: "/reports" },
  },
  "/community": {
    title: "Handle a comment or mention", purpose: "Record messages and review replies before posting them on the original platform.",
    steps: ["Record the comment, platform and original link. Direct platform syncing is not available here.", "Write a reply draft and ask another reviewer to approve it.", "Copy the approved reply, post it on the original platform, then mark it posted here. Add interested contacts to lead follow-up."],
    next: { label: "Open lead follow-up", href: "/leads" },
  },
  "/assistant": {
    title: "Ask for a next step", purpose: "Get recommendations grounded in this workspace.",
    steps: ["Choose an example question or write a specific question about your marketing work.", "Ask the assistant and check its answer against your campaign and audience evidence.", "Make changes in the relevant workflow yourself. The assistant does not approve, publish or send on your behalf."],
    next: { label: "Review your campaigns", href: "/audience/campaigns" },
  },
  "/trends": {
    title: "Turn a sourced development into a draft", purpose: "Review industry developments before using them in your marketing.",
    steps: ["Add a trend with its source, or review items collected through monitoring.", "Check the original claim, relevance and risk. Approve useful trends or dismiss unsuitable ones.", "Choose an audience and create a draft from an approved trend. The resulting content needs its own review."],
    next: { label: "Review resulting drafts", href: "/library" },
  },
  "/settings/automation": {
    title: "Choose what happens after an activity is saved", purpose: "Automation prepares drafts; people retain control of review and delivery.",
    steps: ["An owner, admin or marketing manager can enable automatic drafts for future activities.", "Log a new activity. Review its job here to see what was created or why it failed.", "Open the resulting drafts to edit and review them. Retry a failed job after resolving its reported problem."],
    next: { label: "Review connections", href: "/settings/ai" },
  },
  "/settings/brand": {
    title: "Give drafts the right brand context", purpose: "Store verified facts, approved language and writing preferences.",
    steps: ["Add an entry focused on one topic, such as tone, programme details or approved messaging.", "Choose a category and record the guidance with its source when available.", "Keep useful entries active and deactivate outdated guidance. These entries inform AI writing but never approve a draft."],
    next: { label: "Add brand guidance", href: "/settings/brand/new" },
  },
  "/settings/ai": {
    title: "Connect only the tools you need", purpose: "Each connection supports a specific task. You do not need every service to start.",
    steps: ["Connect an AI provider for writing, Buffer for social posts, or WordPress or Strapi for website articles.", "Follow the selected service’s setup and test the connection. Email sender setup lives on the Email page.", "Return to the matching workflow. Connecting a tool never publishes content, sends email or changes approval rules."],
    next: { label: "Return to the Command Centre", href: "/dashboard" },
  },
};

export function workflowGuideFor(pathname: string): WorkflowGuide | undefined {
  const base = Object.keys(guides).find(path => pathname === path || pathname.startsWith(`${path}/`));
  return base ? guides[base] : undefined;
}
