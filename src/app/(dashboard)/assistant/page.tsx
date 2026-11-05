import { WorkspacePageHeader } from "@/components/workspace-page-header";
import type { Metadata } from "next";
import Link from "next/link";
import { getCallerOrganizationId } from "@/lib/supabase/organization";
import { getAiIntegration } from "@/lib/ai/provider";
import { MarketingAssistant } from "@/components/assistant/marketing-assistant";

export const metadata: Metadata = { title: "Marketing Assistant" };

export default async function AssistantPage() {
  const organizationId = await getCallerOrganizationId();
  const integration = organizationId ? await getAiIntegration(organizationId) : null;
  const aiConnected = integration?.status === "connected" && integration.hasKey;

  return (
    <div className="workspace-page assistant-compose mx-auto w-full">
      <WorkspacePageHeader title={<>Marketing Assistant</>} eyebrow={<>Audience intelligence · operations</>} description={<>Turn live audience and campaign signals into a clear next step for RIL.</>} />
      {!aiConnected ? <p className="text-sm text-muted-foreground">No AI provider is connected. You can still view a live workspace summary; connect one in <Link href="/settings/ai" className="-mx-1 inline-block rounded px-1 py-1.5 text-primary hover:underline">AI &amp; Integrations</Link> for grounded natural-language recommendations.</p> : null}
      <MarketingAssistant aiConnected={Boolean(aiConnected)} />
    </div>
  );
}
