import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCallerOrganizationId } from "@/lib/supabase/organization";
import { BrandLockup } from "@/components/auth/brand-lockup";
import { OnboardingForm } from "@/components/auth/onboarding-form";

export const metadata: Metadata = { title: "Set up your team" };

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({data:{user:null}}));
  if (!user) redirect("/sign-in");
  const orgId = await getCallerOrganizationId().catch(() => null);
  if (orgId) redirect("/dashboard");
  return <main id="main" className="onboarding-page ril-onboarding glass-onboarding">
    <header className="ril-onboarding-heading"><BrandLockup /><h1>Set up your team’s workspace.</h1><p>Give your marketing work a shared home. Start with the team name; you can connect your writing and publishing tools in settings.</p></header>
    <div className="ril-onboarding-workbench">
      <Card asChild><section className="ril-onboarding-form" aria-labelledby="setup-heading"><CardHeader><CardTitle asChild><h2 id="setup-heading">Workspace details</h2></CardTitle><CardDescription>Start with a name your team will recognise.</CardDescription></CardHeader><CardContent><OnboardingForm email={user.email} /></CardContent></section></Card>
      <aside className="ril-onboarding-context" aria-labelledby="next-heading"><h2 id="next-heading">What comes next</h2><ol><li>Record a programme, event, or partnership.</li><li>Prepare a draft from its source material.</li><li>Review with your team before publishing.</li></ol><p>Your existing approval and consent requirements stay with the work.</p></aside>
    </div>
  </main>;
}
