"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SidebarGroup, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, useSidebar } from "@/components/ui/sidebar";
import type { SidebarNavGroup, SidebarNavItem } from "@/components/app-shared";

export function NavGroup({ label, items, filtering = false }: SidebarNavGroup & { filtering?: boolean }) {
  const pathname = usePathname();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const [expanded, setExpanded] = useState<{ pathname: string; value: boolean } | null>(null);
  const active = (item: SidebarNavItem) => Boolean(item.path && (pathname === item.path || (item.path !== "/dashboard" && pathname.startsWith(item.path + "/"))));
  const containsActive = items.some(item => active(item) || item.subItems?.some(active));
  const isRail = state === "collapsed" && !isMobile;
  const chosenOpen = expanded?.pathname === pathname ? expanded.value : null;
  const open = !label || filtering || isRail || (chosenOpen ?? true);
  const closeMobile = () => setOpenMobile(false);

  return <Collapsible open={open} onOpenChange={value => setExpanded({ pathname, value })} asChild>
    <SidebarGroup className="ril-nav-group" data-current-section={containsActive}>
      {label && !isRail ? <CollapsibleTrigger asChild><Button type="button" variant="ghost" className="ril-nav-group-toggle" disabled={filtering}><span>{label}</span><ChevronDown aria-hidden="true" className="ril-nav-group-chevron" /></Button></CollapsibleTrigger> : null}
      <CollapsibleContent>
        <SidebarMenu>
          {items.map(item => <SidebarMenuItem key={item.title}>
            {item.subItems?.length ? isRail ? <DropdownMenu>
              <DropdownMenuTrigger asChild><SidebarMenuButton isActive={active(item) || item.subItems.some(active)} tooltip={item.title} aria-label={item.title}>{item.icon}</SidebarMenuButton></DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="start" sideOffset={12} className="w-64" data-workspace-portal=""><DropdownMenuGroup>{item.subItems.map(child => <DropdownMenuItem key={child.title} asChild><Link href={child.path ?? "/dashboard"} onClick={closeMobile} aria-current={active(child) ? "page" : undefined}>{child.icon}<span>{child.title}</span></Link></DropdownMenuItem>)}</DropdownMenuGroup></DropdownMenuContent>
            </DropdownMenu> : <Collapsible defaultOpen className="group/collapsible">
              <CollapsibleTrigger asChild><SidebarMenuButton isActive={active(item) || item.subItems.some(active)} tooltip={item.title}>{item.icon}<span>{item.title}</span><ChevronRight aria-hidden="true" className="ml-auto group-data-[state=open]/collapsible:rotate-90" /></SidebarMenuButton></CollapsibleTrigger>
              <CollapsibleContent><SidebarMenuSub>{item.subItems.map(child => <SidebarMenuSubItem key={child.title}><SidebarMenuSubButton asChild isActive={active(child)}><Link href={child.path ?? "/dashboard"} onClick={closeMobile} aria-current={active(child) ? "page" : undefined}>{child.icon}<span>{child.title}</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>)}</SidebarMenuSub></CollapsibleContent>
            </Collapsible> : <SidebarMenuButton asChild isActive={active(item)} tooltip={item.title}><Link href={item.path ?? "/dashboard"} onClick={closeMobile} aria-label={item.title} aria-current={active(item) ? "page" : undefined}>{item.icon}<span>{item.title}</span></Link></SidebarMenuButton>}
          </SidebarMenuItem>)}
        </SidebarMenu>
      </CollapsibleContent>
    </SidebarGroup>
  </Collapsible>;
}
