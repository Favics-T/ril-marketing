"use client";

import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";

export function CustomSidebarTrigger() {
  const { openMobile } = useSidebar();
  return <SidebarTrigger aria-label="Open navigation" aria-expanded={openMobile} className="workspace-navigation-trigger" />;
}
