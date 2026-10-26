import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ProductHome } from "@/components/landing/product-home";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.renaissancelabs.org"),
  title: "RIL Marketing Workspace | One event in. A whole campaign out.",
  description:
    "Bring activities, audience insights, drafts, reviews, and campaign follow-up together in the RIL Marketing Workspace. AI prepares; your team decides.",
  robots: { index: true, follow: true },
  openGraph: {
    title: "RIL Marketing Workspace",
    description:
      "One event in. A whole campaign out. AI drafts. Humans decide.",
    type: "website",
    url: "https://www.renaissancelabs.org",
  },
  twitter: {
    card: "summary",
    title: "RIL Marketing Workspace",
    description: "One event in. A whole campaign out. AI drafts. Humans decide.",
  },
};

export default async function Home() {
  let user: unknown = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth
      .getUser()
      .catch(() => ({ data: { user: null } }));
    user = data.user;
  } catch {
    user = null;
  }
  return <ProductHome signedIn={Boolean(user)} />;
}
