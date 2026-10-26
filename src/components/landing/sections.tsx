import { LayoutDashboard, TrendingUp, BarChart3, CalendarPlus, RefreshCw, CalendarDays, Send, Mail, Users, Link2, ArrowRight } from "lucide-react";
import { Reveal } from "./reveal";

const flow = [
  { title: "Log the activity", body: "Capture the programme, event, or partnership once, with its source material." },
  { title: "Find the useful angles", body: "AI brings together the activity, your brand knowledge, and approved audience insights." },
  { title: "Create for each channel", body: "Turn the source into blog, newsletter, social, and short-form drafts." },
  { title: "Review with context", body: "Edit the copy, check its source, and record the approvals it needs." },
  { title: "Publish and capture", body: "Choose the right channel and time. Connect registrations to the campaign." },
  { title: "Learn from the response", body: "Use engagement and conversion signals to inform the next recommendation." },
];

export function FlowStrip() {
  return <section id="workflow" className="ril-home-workflow" aria-labelledby="flow-heading"><div className="ril-home-section-heading"><h2 id="flow-heading">From the thing you did.<br />To the people it matters to.</h2><p>The source, the content, and the decision stay connected. A person approves every public step.</p></div><ol className="ril-home-workflow-list">{flow.map((step, index) => <Reveal as="li" key={step.title} delay={index * 40}><span className="ril-flow-number" aria-hidden="true">{index + 1}</span><div><h3>{step.title}</h3><p>{step.body}</p></div></Reveal>)}</ol></section>;
}

const groups = [
  { title: "See what matters", description: "A useful view of the work, the signals, and the next decision.", modules: [
    { icon: LayoutDashboard, title: "Command Centre", body: "Review content, plan upcoming work, and follow up with leads." },
    { icon: TrendingUp, title: "Trends to content", body: "Turn sourced industry signals into drafts for human review." },
    { icon: BarChart3, title: "Analytics and reports", body: "Review recorded results, their source, and the limits of the available data." },
  ] },
  { title: "Make and publish", description: "Start with one source. Keep the context through every draft and channel.", modules: [
    { icon: CalendarPlus, title: "Activity Hub", body: "Log a programme, event, or partnership and add the material behind it." },
    { icon: RefreshCw, title: "Repurposing", body: "Create review drafts from existing text, documents, images, audio, or video." },
    { icon: CalendarDays, title: "Content calendar", body: "See the schedule and choose the next publishing time." },
    { icon: Send, title: "Publishing", body: "Move approved content through configured channels or record a manual post." },
  ] },
  { title: "Reach and learn", description: "Connect campaign activity to real interest, consent, and follow-up.", modules: [
    { icon: Mail, title: "Email marketing", body: "Prepare consent-filtered campaigns for independent approval and delivery." },
    { icon: Users, title: "Leads and CRM", body: "Capture interest, understand each score, and plan a useful follow-up." },
    { icon: Link2, title: "Campaign links", body: "Keep registration and lead attribution connected to the campaign." },
  ] },
];

export function Modules() {
  return <section id="platform" className="ril-home-modules" aria-labelledby="modules-heading"><div className="ril-home-section-heading"><h2 id="modules-heading">One workspace.<br />A connected way to work.</h2><p>From the first source to the next conversation, the same context stays with your team.</p></div><div>{groups.map(group => <article className="ril-home-module-group" key={group.title}><div><h3>{group.title}</h3><p>{group.description}</p></div><ul>{group.modules.map(module => <li key={module.title}><module.icon aria-hidden="true" /><div><h4>{module.title}</h4><p>{module.body}</p></div></li>)}</ul></article>)}</div></section>;
}

export function Approval() {
  return <section className="ril-home-approval" aria-labelledby="approval-heading"><div className="ril-home-approval-inner"><div><h2 id="approval-heading">AI drafts.<br />Humans decide.</h2><p>Let AI do the first pass. Keep the final say with the people who know your community, your context, and your brand.</p></div><div className="ril-home-approval-roles"><section><h3>AI prepares the work</h3><ul><li>Generate, summarise, and repurpose</li><li>Recommend, analyse, and classify</li><li>Suggest, draft, and detect</li><li>Score leads and flag trends</li></ul></section><section><h3>Your team owns the decision</h3><ul><li>Review public communications</li><li>Approve sensitive announcements</li><li>Confirm important emails and strategy</li><li>Choose what gets published</li></ul></section></div></div></section>;
}

const learnings = ["Which topics move each audience segment", "Which formats lead to registrations", "Which channels bring qualified leads", "Which hooks and calls to action get a response"];
const loop = ["Audience data", "Behaviour analysis", "Insight", "Recommendation", "Distribution", "Engagement", "Conversion", "New learning"];

export function Learning() {
  return <section id="learning" className="ril-home-learning" aria-labelledby="learning-heading"><div className="ril-home-section-heading"><h2 id="learning-heading">The next campaign<br />starts with what you learn.</h2><p>Recorded engagement, registration, and conversion signals inform the next recommendation. Your team reviews the insight before it shapes new work.</p></div><div className="ril-home-learning-body"><ol aria-label="Audience learning cycle">{loop.map((step,index) => <li key={step}><span>{step}</span>{index < loop.length - 1 ? <ArrowRight aria-hidden="true" /> : null}</li>)}</ol><ul>{learnings.map(item => <li key={item}>{item}</li>)}</ul></div></section>;
}
