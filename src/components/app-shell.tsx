import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { PageMotion } from "@/components/ui/page-motion";

export function AppShell({
	children,
	userEmail,
}: {
	children: React.ReactNode;
	userEmail?: string;
}) {
	return (
		<div className="workspace overflow-hidden">
			<SidebarProvider className="relative h-svh">
				<AppSidebar />
				<SidebarInset id="main" tabIndex={-1} className="min-w-0 bg-background">
					<AppHeader userEmail={userEmail} />
				<div className="workspace-scroll flex flex-1 flex-col overflow-y-auto px-5 pb-16 pt-6 md:px-9 md:pt-8 xl:px-12">
					<PageMotion className="mx-auto w-full max-w-[1440px]">{children}</PageMotion>
				</div>
				</SidebarInset>
			</SidebarProvider>
		</div>
	);
}
