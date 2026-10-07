/**
 * Provider-agnostic AI layer (PRD §8). Generation requests flow through the
 * `AiProvider` interface so the model vendor can change without rebuilding
 * callers. Every draft is grounded in caller-supplied facts; drafts that
 * reach the library are always `ai_generated` pending human review.
 */

export type RepurposeKind = "blog" | "newsletter" | "social_pack" | "short_form";

export const REPURPOSE_KINDS: Array<{ kind: RepurposeKind; label: string }> = [
  { kind: "blog", label: "Blog post" },
  { kind: "newsletter", label: "Newsletter" },
  { kind: "social_pack", label: "Social pack" },
  { kind: "short_form", label: "Short-form briefs" },
];

/** PRD §6.8: one distinct draft per platform. */
export const SOCIAL_PLATFORMS = ["linkedin", "instagram", "x", "youtube", "tiktok"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

/** PRD §6.5 newsletter styles. */
export const NEWSLETTER_STYLES = [
  "weekly_update",
  "event_recap",
  "program_promotion",
  "thought_leadership",
  "industry_insight",
  "partnership_announcement",
  "community_update",
] as const;
export type NewsletterStyle = (typeof NEWSLETTER_STYLES)[number];

export type ContentLength = "short" | "standard" | "long";

/**
 * User-selectable generation options (PRD §6.4, §6.5). All optional — the
 * prompt resolves sensible defaults so the UI can add controls later.
 */
export interface GenerationOptions {
  tone?: string;
  length?: ContentLength;
  audience?: string;
  objective?: string;
  seoFocusKeyword?: string;
  cta?: string;
  newsletterStyle?: NewsletterStyle;
}

/**
 * Source content the drafts are developed from. This is the material a
 * transcript, document or media analysis produced — the substance the model
 * is allowed to expand on. Treated as untrusted data, never instructions.
 */
export interface SourceMaterial {
  kind: "transcript" | "document" | "key_moments" | "image_notes" | "notes";
  /** Human label, e.g. the file name. Shown in the prompt and in provenance. */
  label: string;
  text: string;
  /** True when the text carries real timestamps (needed for clip ranges). */
  timestamped: boolean;
  /** True when `text` is an AI-condensed summary of a longer original. */
  condensed?: boolean;
}

/** Facts the generator may use — nothing else may be asserted as fact. */
export interface GenerationContext {
  organizationName: string;
  activityTitle: string;
  activityDescription: string | null;
  outcomes: string | null;
  speakers: string[];
  partners: string[];
  eventDate: string | null;
  segmentName: string | null;
  /** Explicit motivations from the selected audience segment. */
  audienceNeeds?: string[];
  /** Retrieved, approved RIL brand knowledge relevant to this source. */
  brandGuidance?: string[];
  /** Proven topics/formats/platforms/hooks/CTAs from APPROVED insights. */
  topics: string[];
  formats: string[];
  platforms: string[];
  hooks: string[];
  ctas: string[];
  /** The activity's registration link — the only URL drafts may link to. */
  registrationUrl?: string | null;
  /** Objective of the campaign this activity belongs to. */
  campaignObjective?: string | null;
  /** Target audience of that campaign, as Marketing described it. */
  campaignAudience?: string | null;
  /** Funnel stage of that campaign, e.g. "awareness" or "conversion". */
  campaignFunnelStage?: string | null;
  /** Transcripts, document text and media notes for this activity. */
  sourceMaterial?: SourceMaterial[];
  options?: GenerationOptions;
}

export interface DraftSpec {
  kind: Exclude<RepurposeKind, "social_pack" | "short_form"> | "social" | "short_clip";
  channel: string | null;
  title: string;
  body: string;
  topic: string | null;
  format: string | null;
  platform: string | null;
  hook: string | null;
  cta: string | null;
  metadata: Record<string, unknown>;
}

export interface GenerationOutcome {
  drafts: DraftSpec[];
  /** Things the user should know, e.g. a platform that failed or no strong clip. */
  warnings: string[];
}

export interface AiProvider {
  /** Model label recorded on the ai_generations row for traceability. */
  readonly modelLabel: string;
  generate(kind: RepurposeKind, ctx: GenerationContext): Promise<GenerationOutcome>;
}

export interface ResolvedAiConfig {
  mode: "llm" | "template";
  model: string;
  baseUrl: string | null;
  apiKey: string | null;
}

/**
 * Wire-level transport for one LLM vendor. Drivers only move text; prompts,
 * parsing, validation and retries are shared (see llm-generator.ts) so
 * grounding rules and output quality can't drift per provider.
 */
export interface LlmMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LlmRequest {
  system: string;
  messages: LlmMessage[];
  maxTokens: number;
  /** Omitted when a model only supports its default temperature. */
  temperature?: number;
  timeoutMs?: number;
  /** Ask the vendor for a JSON object reply where it supports that. */
  json?: boolean;
}

export interface LlmResponse {
  text: string;
  /** True when the reply stopped at the output-token limit. */
  truncated: boolean;
}

export interface LlmClient {
  readonly model: string;
  complete(request: LlmRequest): Promise<LlmResponse>;
}
