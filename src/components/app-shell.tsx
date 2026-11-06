import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { PageMotion } from "@/components/ui/page-motion";
import { WorkspaceSurface } from "@/components/workspace-surface";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { CSSProperties } from "react";

export function AppShell({
	children,
	userEmail,
}: {
	children: React.ReactNode;
	userEmail?: string;
}) {
	return (
		<div className="workspace ril-media-kit ril-editorial overflow-hidden">
			<SidebarProvider className="relative h-svh" style={{ "--sidebar-width": "15.5rem" } as CSSProperties}>
				<AppSidebar />
				<SidebarInset id="main" tabIndex={-1} className="workspace-main min-w-0">
					<AppHeader userEmail={userEmail} />
				<ScrollArea className="workspace-scroll-root min-h-0 flex-1" viewportClassName="workspace-scroll" role="region" aria-label="Workspace content">
					<PageMotion className="workspace-content"><WorkspaceSurface>{children}</WorkspaceSurface></PageMotion>
				</ScrollArea>
				</SidebarInset>
			</SidebarProvider>
		</div>
	);
}
