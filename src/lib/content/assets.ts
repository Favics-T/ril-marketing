import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PublicationRow } from "@/lib/content/publications";
import { CALENDAR_STATUSES, calendarAt } from "@/lib/content/calendar";
import { reminderState, type ReminderState } from "@/lib/content/reminders";
import { z } from "zod";

export interface ContentAssetRow {
  id: string;
  organization_id: string;
  title: string;
  body: string | null;
  channel: string | null;
  topic: string | null;
  format: string | null;
  platform: string | null;
  hook: string | null;
  cta: string | null;
  status: string;
  sensitivity: string;
  scheduled_for: string | null;
  published_at: string | null;
  audience_segment_id: string | null;
  campaign_id: string | null;
  source_activity_id: string | null;
  generation_id: string | null;
  metadata: Record<string, unknown>;
  updated_at: string;
  created_by?: string | null;
  approval_category?: string;
  approval_revision?: number;
  second_reviewer_id?: string | null;
  created_at: string;
}

export interface AssetFilters {
  status?: string;
  channel?: string;
  activityId?: string;
  campaignId?: string;
  q?: string;
  page?: number;
}

export async function listAssets(
  organizationId: string,
  filters: AssetFilters = {}
): Promise<{ assets: ContentAssetRow[]; total: number }> {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = 20;
  let query = supabase
    .from("content_assets")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.channel && filters.channel !== "all") query = query.eq("channel", filters.channel);
  if (filters.activityId && filters.activityId !== "all") {
    const activity = z.uuid().safeParse(filters.activityId);
    if (!activity.success) return { assets: [], total: 0 };
    query = query.or(`source_activity_id.eq.${activity.data},metadata.cs.${JSON.stringify({ linked_activity_ids: [activity.data] })}`);
  }
  if (filters.campaignId && filters.campaignId !== "all") query = query.eq("campaign_id", filters.campaignId);
  if (filters.q?.trim()) {
    const terms = filters.q
      .normalize("NFKC")
      .replace(/[^\p{L}\p{N}\s-]/gu, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 6);
    for (const term of terms) {
      query = query.or(`title.ilike.%${term}%,body.ilike.%${term}%`);
    }
  }
  const { data, error, count } = await query;
  if (error) throw new Error(`Failed to load assets: ${error.message}`);
  return { assets: (data ?? []) as ContentAssetRow[], total: count ?? 0 };
}

export async function getAsset(
  organizationId: string,
  assetId: string
): Promise<ContentAssetRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content_assets")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", assetId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load asset: ${error.message}`);
  return (data ?? null) as ContentAssetRow | null;
}

export interface AssetApprovalRow {
  id: string;
  actor_id: string | null;
  actor_name?: string;
  actor_role?: string;
  previous_scheduled_for?: string | null;
  scheduled_for?: string | null;
  from_status: string;
  to_status: string;
  note: string | null;
  created_at: string;
}

export async function listAssetApprovals(
  organizationId: string,
  assetId: string
): Promise<AssetApprovalRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("asset_approvals")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("content_asset_id", assetId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(`Failed to load approvals: ${error.message}`);
  return (data ?? []) as AssetApprovalRow[];
}

export async function listAssetPublications(
  organizationId: string,
  assetId: string
): Promise<PublicationRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("publications")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("content_asset_id", assetId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(`Failed to load publications: ${error.message}`);
  return (data ?? []) as PublicationRow[];
}

/**
 * Calendar assets between two ISO instants, earliest first. An asset sits at
 * calendarAt: its scheduled_for, or its published_at when it has no date.
 */
export async function listScheduled(
  organizationId: string,
  from: string,
  to: string
): Promise<ContentAssetRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content_assets")
    .select("*")
    .eq("organization_id", organizationId)
    .in("status", [...CALENDAR_STATUSES])
    // from/to are ISO instants from our own range helpers: no commas or parentheses to escape.
    .or(
      `and(scheduled_for.gte.${from},scheduled_for.lte.${to}),` +
        `and(scheduled_for.is.null,published_at.gte.${from},published_at.lte.${to})`
    )
    .limit(500);
  if (error) throw new Error(`Failed to load calendar: ${error.message}`);
  // PostgREST can't order by a coalesce, so sort here.
  return ((data ?? []) as ContentAssetRow[]).sort((a, b) => (calendarAt(a) ?? "").localeCompare(calendarAt(b) ?? ""));
}

export interface SocialReminder {
  asset: ContentAssetRow;
  state: ReminderState;
}

/** Scheduled social posts that are overdue or due later today, most urgent first. */
export async function listSocialReminders(
  organizationId: string,
  now: Date = new Date()
): Promise<SocialReminder[]> {
  const supabase = await createClient();
  // Anything due today in the workspace zone is within the next 25 hours.
  const horizon = new Date(now.getTime() + 25 * 3600000).toISOString();
  const { data, error } = await supabase
    .from("content_assets")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("status", "scheduled")
    .lte("scheduled_for", horizon)
    .order("scheduled_for")
    .limit(200);
  if (error) throw new Error(`Failed to load reminders: ${error.message}`);
  return ((data ?? []) as ContentAssetRow[]).flatMap((asset) => {
    const state = reminderState(asset, now);
    return state ? [{ asset, state }] : [];
  });
}
