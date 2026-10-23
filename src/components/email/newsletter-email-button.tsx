import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/audience/access";
import { isApprovedNewsletter, isEmailAuthorRole } from "@/lib/email/from-newsletter";
import type { ContentAssetRow } from "@/lib/content/assets";
import { CreateEmailFromNewsletter } from "@/components/email/create-email-from-newsletter";

/**
 * Shown on an approved newsletter: turns it into an email campaign draft, or
 * links to the one already made. Renders nothing for other assets or roles.
 */
export async function NewsletterEmailButton({ asset }: { asset: ContentAssetRow }) {
  if (!isApprovedNewsletter(asset)) return null;
  if (!isEmailAuthorRole(await getUserRole(asset.organization_id))) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("email_campaigns").select("id,status")
    .eq("organization_id", asset.organization_id).contains("metadata", { source_content_asset_id: asset.id })
    .order("created_at", { ascending: true }).limit(1);
  const existing = (data?.[0] ?? null) as { id: string; status: string } | null;
  return <section className="slip flex h-fit flex-col gap-3 p-5 sm:p-6">
    <div><p className="dateline">Email marketing</p><h2 className="mt-1 text-base font-bold">Send as an email campaign</h2></div>
    {existing
      ? <><p className="text-sm leading-5 text-muted-foreground">An email campaign was already created from this newsletter. Status: {existing.status}.</p><Link href={`/email/${existing.id}`} className="text-sm font-medium text-primary underline underline-offset-2">View email campaign</Link></>
      : <CreateEmailFromNewsletter assetId={asset.id} />}
  </section>;
}
