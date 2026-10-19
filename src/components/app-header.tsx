"use client";

import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { AppBreadcrumbs } from "@/components/app-breadcrumbs";
import { CustomSidebarTrigger } from "@/components/custom-sidebar-trigger";
import { navGroups, navLinks } from "@/components/app-shared";
import { NavUser } from "@/components/nav-user";
import { WorkspaceSearch } from "@/components/workspace-search";

export function AppHeader({ userEmail }: { userEmail?: string }) {
	const pathname = usePathname();
	const activeItem = navLinks.find((item) => {
		if (!item.path || item.path.startsWith("#")) return false;
		if (item.path === "/dashboard") return pathname === "/dashboard";
		return pathname === item.path || pathname.startsWith(`${item.path}/`);
	});
	const activeSection = navGroups.find((group) => group.items.some((item) => {
		if (!item.path) return false;
		return item.path === "/dashboard"
			? pathname === item.path
			: pathname === item.path || pathname.startsWith(`${item.path}/`);
	}))?.label ?? "Workspace";

	return (
		<header
			className={cn(
				"workspace-topbar sticky top-0 z-30 flex h-[72px] shrink-0 items-center justify-between gap-2 border-b px-5 md:px-9 xl:px-12"
			)}
		>
			<div className="flex items-center gap-3">
				<CustomSidebarTrigger />
				<Separator
					className="mr-2 h-4 data-[orientation=vertical]:self-center"
					orientation="vertical"
				/>
				<div className="flex flex-col justify-center gap-0.5">
					<span className="hidden text-[11px] font-medium text-muted-foreground sm:block">{activeSection}</span>
					<AppBreadcrumbs page={activeItem} />
				</div>
			</div>
			<div className="flex items-center gap-3">
				<WorkspaceSearch />
				<NavUser email={userEmail} />
			</div>
		</header>
	);
}
