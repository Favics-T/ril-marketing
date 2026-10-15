import { StatusStamp } from "@/components/ui/status-stamp";
import { formatDayTime } from "@/lib/format";
import {
	publicationDestination,
	publicationTime,
	safePublicationUrl,
	type PublicationRow,
} from "@/lib/content/publications";

/**
 * Every publish attempt on an asset (§6.9, §13): where it went, whether it
 * went out, the live link, and the error when it failed.
 */
export function PublishHistory({
	publications,
	assetStatus,
}: {
	publications: PublicationRow[];
	assetStatus: string;
}) {
	return (
		<section className="slip flex h-fit flex-col p-5 sm:p-6">
			<p className="dateline">Publish history</p>
			{publications.length ? (
				<ol className="ledger mt-2 flex flex-col">
					{publications.map((p) => {
						const url = safePublicationUrl(p.url);
						return (
							<li key={p.id} className="flex flex-col gap-1 py-2.5">
								<div className="flex items-center justify-between gap-3">
									<span className="text-sm font-semibold tracking-[-0.01em] text-foreground">
										{publicationDestination(p.channel)}
									</span>
									<StatusStamp status={p.status} />
								</div>
								<span className="dateline">{formatDayTime(publicationTime(p))}</span>
								{url ? (
									<a
										href={url}
										target="_blank"
										rel="noreferrer"
										className="w-fit text-sm font-medium text-primary underline underline-offset-2"
									>
										View live post
									</a>
								) : null}
								{p.status === "failed" && p.error ? (
									<span className="text-sm text-destructive">{p.error}</span>
								) : null}
							</li>
						);
					})}
				</ol>
			) : (
				<p className="mt-2 text-sm text-muted-foreground">
					{assetStatus === "published"
						? "Marked published by hand. No publish to a connected channel is recorded."
						: "Not published to any channel yet."}
				</p>
			)}
		</section>
	);
}
