"use client";

import { usePathname } from "next/navigation";
import { AppBreadcrumbs } from "@/components/app-breadcrumbs";
import { CustomSidebarTrigger } from "@/components/custom-sidebar-trigger";
import { navLinks } from "@/components/app-shared";
import { NavUser } from "@/components/nav-user";
import { WorkspaceSearch } from "@/components/workspace-search";
import { WorkflowHelp } from "@/components/workflow-help";
import { Separator } from "@/components/ui/separator";
import { useSidebar } from "@/components/ui/sidebar";

export function AppHeader({ userEmail }: { userEmail?: string }) {
  const pathname = usePathname();
  const { isMobile } = useSidebar();
  const activeItem = navLinks.find(item => {
    if (!item.path || item.path.startsWith("#")) return false;
    return item.path === "/dashboard" ? pathname === item.path : pathname === item.path || pathname.startsWith(item.path + "/");
  });
  return <header className="workspace-topbar sticky top-0 z-30 shrink-0">
    <div className="workspace-location">{isMobile ? <CustomSidebarTrigger /> : null}<AppBreadcrumbs page={activeItem ? { title: activeItem.title } : null} /></div>
    <div className="workspace-header-actions">
      <div className="workspace-topbar-search"><WorkspaceSearch /></div>
      <Separator orientation="vertical" className="workspace-header-divider" />
      <div className="workspace-topbar-account"><WorkflowHelp /><NavUser email={userEmail} /></div>
    </div>
  </header>;
}
