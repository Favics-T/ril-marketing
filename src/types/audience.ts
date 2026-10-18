/**
 * Audience Intelligence domain types (v1).
 * Mirrors the Supabase schema in supabase/migrations/0001_audience_intelligence.sql.
 * v2 categories are reserved but not analysed yet.
 */

export const INSIGHT_CATEGORIES = [
  "TOPIC_ENGAGEMENT",
  "FORMAT_REGISTRATION",
  "PLATFORM_LEAD_QUALITY",
  "HOOK_CTA_EFFECTIVENESS",
  "PROGRAM_AFFINITY",
  "FUNNEL_DROPOFF",
  "REPEAT_ENGAGEMENT",
  "THEME_TREND",
] as const;
export type InsightCategory = (typeof INSIGHT_CATEGORIES)[number];

/** Categories implemented by the v1 generation pipeline. */
export const V1_INSIGHT_CATEGORIES: InsightCategory[] = [
  "TOPIC_ENGAGEMENT",
  "FORMAT_REGISTRATION",
  "PLATFORM_LEAD_QUALITY",
  "HOOK_CTA_EFFECTIVENESS",
];

export const INSIGHT_STATUSES = [
  "PENDING_REVIEW",
  "APPROVED",
  "SUPPRESSED",
] as const;
export type InsightStatus = (typeof INSIGHT_STATUSES)[number];

export const SIGNAL_STRENGTHS = [
  "EMERGING",
  "STABLE",
  "RISING",
  "DECLINING",
] as const;
export type SignalStrength = (typeof SIGNAL_STRENGTHS)[number];

export const GENERATION_RUN_STATUSES = [
  "RUNNING",
  "COMPLETED",
  "FAILED",
] as const;
export type GenerationRunStatus = (typeof GENERATION_RUN_STATUSES)[number];

export interface AudienceSegment {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  needs_motivations: string[];
  preferred_formats: string[];
  preferred_platforms: string[];
  preferred_hooks: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Program {
  id: string;
  organization_id: string;
  name: string;
  slug: string | null;
  description: string | null;
  created_at: string;
}

export interface AudienceSegmentWithPrograms extends AudienceSegment {
  programs: Program[];
  insights_count: number;
  pending_insights_count: number;
}

export interface AudienceInsight {
  id: string;
  organization_id: string;
  segment_id: string;
  category: InsightCategory;
  topic: string | null;
  format: string | null;
  platform: string | null;
  hook: string | null;
  cta: string | null;
  confidence_score: number;
  signal_strength: SignalStrength;
  status: InsightStatus;
  summary: string;
  recommendation: string;
  sample_size: number;
  date_range_start: string | null;
  date_range_end: string | null;
  source_event_ids: string[];
  source_content_asset_ids: string[];
  source_lead_ids: string[];
  generation_run_id: string | null;
  algorithm_version: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  suppressed_by: string | null;
  suppressed_at: string | null;
  suppression_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface AudienceInsightWithSegment extends AudienceInsight {
  segment: Pick<AudienceSegment, "id" | "name">;
}

export interface GenerationRun {
  id: string;
  organization_id: string;
  status: GenerationRunStatus;
  started_at: string;
  completed_at: string | null;
  date_range_start: string | null;
  date_range_end: string | null;
  segments_processed: number;
  insights_created: number;
  algorithm_version: string;
  error: string | null;
  created_at: string;
}

export interface RecommendationItem {
  insightId: string;
  category: InsightCategory;
  topic: string | null;
  format: string | null;
  platform: string | null;
  hook: string | null;
  cta: string | null;
  confidenceScore: number;
  signalStrength: SignalStrength;
  recommendation: string;
  sampleSize: number;
  rankScore: number;
}

export interface ContentAsset {
  id: string;
  organization_id: string;
  title: string;
  topic: string | null;
  format: string | null;
  platform: string | null;
  hook: string | null;
  cta: string | null;
  audience_segment_id: string | null;
  created_at: string;
}

export interface Lead {
  id: string;
  organization_id: string;
  email: string | null;
  audience_segment_id: string | null;
  source_platform: string | null;
  source_content_asset_id: string | null;
  is_qualified: boolean;
  is_converted: boolean;
  created_at: string;
}

export interface AnalyticsEvent {
  id: string;
  organization_id: string;
  event_type: string;
  content_asset_id: string | null;
  lead_id: string | null;
  audience_segment_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type CampaignStatus = "draft" | "active" | "paused" | "completed";

export interface Campaign {
  id: string;
  organization_id: string;
  audience_segment_id: string | null;
  name: string;
  status: CampaignStatus;
  starts_on: string | null;
  ends_on: string | null;
  objective: string;
  target_audience: string;
  funnel_stage: "awareness" | "engagement" | "lead_capture" | "nurturing" | "conversion" | "retention";
  budget: number | null;
  budget_currency: "NGN" | "USD" | "GBP" | "EUR";
  channels: string[];
  created_at: string;
}

export interface CampaignRollup extends Campaign {
  segment_name: string | null;
  assets: number;
  views: number;
  registrations: number;
  leads: number;
  qualified_leads: number;
  qualified_rate: number;
  conversion_rate: number;
}

export interface Activity {
  id: string;
  organization_id: string;
  audience_segment_id: string | null;
  campaign_id: string | null;
  title: string;
  source_type: string | null;
  source_ref: string | null;
  event_date: string | null;
  description: string | null;
  speakers: string[];
  partners: string[];
  outcomes: string | null;
  registration_url: string | null;
  created_at: string;
  /** Missing until 20261017000000_activities_updated_at.sql is applied. */
  updated_at?: string;
}

/** Content Repurposing brief (PRD §6.3): approved intelligence for one activity. */
export interface ContentBrief {
  activityId: string;
  activityTitle: string;
  segmentId: string;
  segmentName: string;
  generatedAt: string;
  topics: string[];
  formats: string[];
  platforms: string[];
  hooks: string[];
  ctas: string[];
  guidance: string;
  recommendations: RecommendationItem[];
}

/** Lead-scoring segment signals (PRD §6.15). */
export interface SegmentScoreSignals {
  segmentId: string;
  leads: number;
  qualifiedRate: number;
  conversionRate: number;
  byPlatform: Array<{
    platform: string;
    leads: number;
    qualifiedRate: number;
    conversionRate: number;
    /** Relative lift vs segment baseline; scoring can weight by (1 + lift). */
    qualityLift: number;
  }>;
  approvedInsights: number;
}

/** Approval audit record (PRD §7 Approval, §16 accountability). */
export interface InsightApproval {
  id: string;
  organization_id: string;
  insight_id: string;
  actor_id: string | null;
  from_status: InsightStatus;
  to_status: InsightStatus;
  note: string | null;
  created_at: string;
}

export type MemberRole =
  | "owner"
  | "admin"
  | "marketing_manager"
  | "leadership"
  | "member";
