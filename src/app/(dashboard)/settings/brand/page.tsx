import { SettingsNavigation } from "@/components/settings/settings-navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getCallerOrganizationId } from "@/lib/supabase/organization";
import { listBrandKnowledge } from "@/lib/brand/knowledge";
import { BrandKnowledgeDelete } from "@/components/brand/brand-knowledge-delete";
import { BrandKnowledgeToggle } from "@/components/brand/brand-knowledge-toggle";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { todayDateline } from "@/lib/format";

export const metadata: Metadata = { title: "Brand Knowledge" };

export default async function BrandKnowledgePage() {
  const organizationId = await getCallerOrganizationId();
  const entries = organizationId
    ? await listBrandKnowledge(organizationId)
    : [];

  return (
    <div className="workspace-page settings-page flex flex-col gap-4 md:gap-6">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <p className="dateline">{todayDateline()} · {entries.length} entries</p>
          <h1>
            Brand Knowledge
          </h1>
          <p className="mt-2 max-w-[62ch] text-sm leading-6 text-muted-foreground">
            Keep approved voice, program facts, audience guidance, and terminology in one place. AI uses relevant entries when it drafts; your team still reviews every asset.
          </p>
        </div>
        <Button asChild className="min-h-10 rounded-lg px-4 text-[13px] font-semibold">
          <Link href="/settings/brand/new">Add an entry</Link>
        </Button>
      </header>
      <SettingsNavigation />

      {entries.length === 0 ? (
        <EmptyState
          title="No brand guidance yet"
          description="Add RIL facts and writing guidance so future drafts can stay grounded and consistent."
          action={{ label: "Add an entry", href: "/settings/brand/new" }}
        />
      ) : (
        <section className="slip overflow-hidden" aria-label="Brand guidance entries"><div className="workspace-list-heading"><span>Guidance and source</span><span>Manage entry</span></div><ul className="divide-y divide-border/80">
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-start justify-between gap-4 px-5 py-5 sm:px-6">
              <Link href={`/settings/brand/${entry.id}`} className="group min-w-0 flex-1 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                <p className="dateline">{entry.category.replaceAll("_", " ")}{entry.is_active ? " · ACTIVE" : " · PAUSED"}</p>
                <h2 className="mt-1 truncate text-sm font-semibold tracking-[-0.01em] group-hover:text-primary">{entry.title}</h2>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{entry.content}</p>
                {entry.source_url ? (
                  <span className="mt-1 block truncate text-xs text-primary">Source: {entry.source_url}</span>
                ) : null}
              </Link>
              <div className="flex shrink-0 items-center gap-2">
                <BrandKnowledgeToggle id={entry.id} active={entry.is_active} />
                <BrandKnowledgeDelete id={entry.id} />
              </div>
            </li>
          ))}
        </ul></section>
      )}
    </div>
  );
}
