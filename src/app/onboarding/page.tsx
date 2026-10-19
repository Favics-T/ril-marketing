import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCallerOrganizationId } from "@/lib/supabase/organization";
import { BrandLockup } from "@/components/auth/brand-lockup";
import { OnboardingForm } from "@/components/auth/onboarding-form";

export const metadata: Metadata = { title: "Set up your team" };

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) redirect("/sign-in");
  const orgId = await getCallerOrganizationId().catch(() => null);
  if (orgId) redirect("/dashboard");

  return (
    <main id="main" className="onboarding-page flex min-h-dvh items-center justify-center bg-muted/40 p-6 sm:p-8">
      <div className="w-full max-w-lg rounded-2xl border bg-card p-7 sm:p-10">
        <BrandLockup />
        <p className="dateline mt-8">A place for your team</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Set up your workspace.</h1>
        <p className="mb-7 mt-3 text-sm leading-6 text-muted-foreground">Name the team that will capture activities, review content and manage leads together.</p>
        <OnboardingForm email={user.email} />
      </div>
    </main>
  );
}
