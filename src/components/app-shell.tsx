import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { PageMotion } from "@/components/ui/page-motion";
import { WorkspaceSurface } from "@/components/workspace-surface";

export function AppShell({
	children,
	userEmail,
}: {
	children: React.ReactNode;
	userEmail?: string;
}) {
	return (
		<div className="workspace ril-media-kit overflow-hidden">
			<SidebarProvider className="relative h-svh">
				<AppSidebar />
				<SidebarInset id="main" tabIndex={-1} className="workspace-main min-w-0">
					<AppHeader userEmail={userEmail} />
				<div className="workspace-scroll flex flex-1 flex-col overflow-y-auto">
					<PageMotion className="mx-auto w-full max-w-[1360px]"><WorkspaceSurface>{children}</WorkspaceSurface></PageMotion>
				</div>
				</SidebarInset>
			</SidebarProvider>
		</div>
	);
}
