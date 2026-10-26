"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SidebarGroup, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, useSidebar } from "@/components/ui/sidebar";
import type { SidebarNavGroup, SidebarNavItem } from "@/components/app-shared";

export function NavGroup({ label, items, filtering = false }: SidebarNavGroup & { filtering?: boolean }) {
  const pathname = usePathname();
  const { state, isMobile } = useSidebar();
  const [expanded, setExpanded] = useState<boolean | null>(null);
  const active = (item: SidebarNavItem) => Boolean(item.path && (pathname === item.path || (item.path !== "/dashboard" && pathname.startsWith(item.path + "/"))));
  const containsActive = items.some(item => active(item) || item.subItems?.some(active));
  const isRail = state === "collapsed" && !isMobile;
  const open = !label || filtering || isRail || containsActive || (expanded ?? label === "Create & publish");

  return <SidebarGroup className="ril-nav-group">
    {label ? <button type="button" className="ril-nav-group-toggle group-data-[collapsible=icon]:hidden" aria-expanded={open} onClick={() => setExpanded(!open)} disabled={containsActive && !filtering}>
      <span>{label}</span><ChevronDown aria-hidden="true" className={open ? "is-open" : ""} />
    </button> : null}
    <SidebarMenu hidden={!open}>
      {items.map(item => <SidebarMenuItem key={item.title}>
        {item.subItems?.length ? <Collapsible defaultOpen={active(item) || item.subItems.some(active)} className="group/collapsible">
          <CollapsibleTrigger asChild><SidebarMenuButton isActive={active(item)} tooltip={item.title}>{item.icon}<span>{item.title}</span><ChevronRight aria-hidden="true" className="ml-auto group-data-[state=open]/collapsible:rotate-90" /></SidebarMenuButton></CollapsibleTrigger>
          <CollapsibleContent><SidebarMenuSub>{item.subItems.map(child => <SidebarMenuSubItem key={child.title}><SidebarMenuSubButton asChild isActive={active(child)}><Link href={child.path ?? "/dashboard"} aria-current={active(child) ? "page" : undefined}>{child.icon}<span>{child.title}</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>)}</SidebarMenuSub></CollapsibleContent>
        </Collapsible> : <SidebarMenuButton asChild isActive={active(item)} tooltip={item.title}><Link href={item.path ?? "/dashboard"} aria-label={item.title} aria-current={active(item) ? "page" : undefined}>{item.icon}<span>{item.title}</span></Link></SidebarMenuButton>}
      </SidebarMenuItem>)}
    </SidebarMenu>
  </SidebarGroup>;
}
