import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Activity } from "@/types/audience";

export type ActivityWithSegment = Activity & {
  segment: { id: string; name: string } | null;
  campaign: { id: string; name: string } | null;
};

export interface ActivityInput {
  title: string;
  event_date?: string;
  description?: string;
  speakers: string[];
  partners: string[];
  outcomes?: string;
  registration_url?: string;
  audience_segment_id?: string;
  campaign_id?: string;
}

export async function listActivities(organizationId: string): Promise<Array<Activity & { segment: { id: string; name: string } | null }>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .select("*, segment:audience_segments(id, name)")
    .eq("organization_id", organizationId)
    .order("event_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`Failed to load activities: ${error.message}`);
  return (data ?? []) as Array<Activity & { segment: { id: string; name: string } | null }>;
}

export async function getActivity(
  organizationId: string,
  activityId: string
): Promise<ActivityWithSegment | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .select("*, segment:audience_segments(id, name), campaign:campaigns(id, name)")
    .eq("organization_id", organizationId)
    .eq("id", activityId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load activity: ${error.message}`);
  return (data ?? null) as ActivityWithSegment | null;
}
