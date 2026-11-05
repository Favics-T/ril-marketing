import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ProductHome } from "@/components/landing/product-home";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.renaissancelabs.org"),
  title: "RIL Marketing Workspace | One activity. A connected campaign.",
  description:
    "Turn programmes, events, and partnerships into content worth sharing. Keep sources, drafts, reviews, and follow-up together in the RIL Marketing Workspace.",
  robots: { index: true, follow: true },
  openGraph: {
    title: "RIL Marketing Workspace",
    description:
      "Connect source material, useful drafts, human review, and audience response in one RIL workspace.",
    type: "website",
    url: "https://www.renaissancelabs.org",
  },
  twitter: {
    card: "summary",
    title: "RIL Marketing Workspace",
    description: "Connect source material, useful drafts, human review, and audience response in one RIL workspace.",
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
