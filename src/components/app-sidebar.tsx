"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ChevronRight, PanelLeftClose, PanelLeftOpen, Plus, Search, Settings, X } from "lucide-react";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { FieldLabel } from "@/components/ui/field";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { NavGroup } from "@/components/nav-group";
import { navGroups, type SidebarNavGroup, type SidebarNavItem } from "@/components/app-shared";

function filterGroup(group: SidebarNavGroup, query: string): SidebarNavGroup {
  if (!query || group.label?.toLowerCase().includes(query)) return group;
  const filterItems = (items: SidebarNavItem[]): SidebarNavItem[] => items.flatMap(item => {
    if (item.title.toLowerCase().includes(query)) return [item];
    const subItems = item.subItems ? filterItems(item.subItems) : [];
    return subItems.length ? [{ ...item, subItems }] : [];
  });
  return { ...group, items: filterItems(group.items) };
}

export function AppSidebar() {
  const [query, setQuery] = useState("");
  const searchId = useId();
  const searchInput = useRef<HTMLInputElement>(null);
  const pathname = usePathname();
  const { setOpenMobile, state, isMobile, toggleSidebar } = useSidebar();
  const isRail = state === "collapsed" && !isMobile;
  const search = isRail ? "" : query.trim().toLowerCase();
  const groups = navGroups.map(group => filterGroup(group, search));
  const primary = groups.find(group => !group.label);
  const settings = navGroups.find(group => group.label === "Settings");
  const toolGroups = groups.filter(group => group.label && group.label !== "Settings" && group.items.length);
  const settingsMatches = groups.find(group => group.label === "Settings");
  const resultCount = groups.reduce((count, group) => count + group.items.length, 0);
  const settingsActive = settings?.items.some(item => item.path && (pathname === item.path || pathname.startsWith(item.path + "/"))) ?? false;
  const ToggleIcon = isMobile ? X : isRail ? PanelLeftOpen : PanelLeftClose;
  const toggleLabel = isMobile ? "Close navigation" : isRail ? "Expand navigation" : "Collapse navigation";
  const closeMobile = () => setOpenMobile(false);
  const clearSearch = () => { setQuery(""); searchInput.current?.focus(); };

  return <Sidebar collapsible="icon" variant="sidebar" className="workspace-sidebar ril-sidebar" data-rail={isRail}>
    <SidebarHeader>
      <div className="ril-sidebar-identity">
        {!isRail ? <Link href="/dashboard" onClick={closeMobile} aria-label="Renaissance Innovation Labs home" className="ril-sidebar-logo"><Image src="/logo/blackLogo.svg" alt="" width={100} height={45} priority /></Link> : null}
        <Tooltip>
          <TooltipTrigger asChild><Button type="button" variant="ghost" size="icon" onClick={isMobile ? closeMobile : toggleSidebar} aria-label={toggleLabel} className="ril-sidebar-toggle"><ToggleIcon aria-hidden="true" /></Button></TooltipTrigger>
          {!isMobile ? <TooltipContent side="right">{toggleLabel}</TooltipContent> : null}
        </Tooltip>
      </div>
      {!isRail ? <>
        <p className="ril-sidebar-caption">Marketing workspace</p>
        <div className="ril-sidebar-page-finder">
          <FieldLabel htmlFor={searchId} className="sr-only">Find a workspace page</FieldLabel>
          <InputGroup>
            <InputGroupAddon><Search aria-hidden="true" /></InputGroupAddon>
            <InputGroupInput ref={searchInput} id={searchId} type="search" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "Escape" && query) { event.preventDefault(); event.stopPropagation(); clearSearch(); } }} placeholder="Find a page" aria-controls={`${searchId}-results`} />
            {query ? <InputGroupAddon align="inline-end"><InputGroupButton size="icon-sm" onClick={clearSearch} aria-label="Clear page search"><X aria-hidden="true" /></InputGroupButton></InputGroupAddon> : null}
          </InputGroup>
        </div>
      </> : null}
      <Tooltip>
        <TooltipTrigger asChild><Button asChild variant="secondary" size={isRail ? "icon" : "default"} className="ril-sidebar-create"><Link href="/activities/new" aria-label="Log activity" onClick={closeMobile}><Plus data-icon="inline-start" aria-hidden="true" />{!isRail ? <span>Log activity</span> : null}</Link></Button></TooltipTrigger>
        {isRail ? <TooltipContent side="right">Log activity</TooltipContent> : null}
      </Tooltip>
      {primary?.items.length ? <nav aria-label="Primary workspace pages" className="ril-sidebar-primary"><NavGroup items={primary.items} /></nav> : null}
    </SidebarHeader>

    <SidebarContent>
      <nav id={`${searchId}-results`} aria-label="Workspace tools" className="ril-sidebar-tools">
        {toolGroups.map(group => <NavGroup key={group.label} {...group} filtering={Boolean(search)} />)}
        {search && settingsMatches?.items.length ? <NavGroup {...settingsMatches} filtering /> : null}
        {search && !resultCount ? <Empty className="px-3 py-6"><EmptyHeader><EmptyMedia variant="icon"><Search aria-hidden="true" /></EmptyMedia><EmptyTitle>No pages found</EmptyTitle><EmptyDescription>Try another page name or clear your search.</EmptyDescription></EmptyHeader><EmptyContent><Button variant="outline" onClick={clearSearch}>Clear search</Button></EmptyContent></Empty> : null}
      </nav>
      {search ? <p role="status" className="sr-only">{resultCount} matching {resultCount === 1 ? "page" : "pages"}</p> : null}
    </SidebarContent>

    <SidebarFooter>
      <SidebarMenu><SidebarMenuItem><DropdownMenu>
        <DropdownMenuTrigger asChild><SidebarMenuButton tooltip="Workspace settings" isActive={settingsActive} aria-label="Workspace settings" className="ril-sidebar-settings"><Settings aria-hidden="true" /><span>Workspace settings</span>{!isRail ? <ChevronRight className="ml-auto" aria-hidden="true" /> : null}</SidebarMenuButton></DropdownMenuTrigger>
        <DropdownMenuContent side={isMobile ? "top" : "right"} align="end" sideOffset={12} collisionPadding={12} className="w-64" data-workspace-portal="">
          <DropdownMenuLabel>Workspace settings</DropdownMenuLabel><DropdownMenuSeparator />
          <DropdownMenuGroup>{settings?.items.map(item => <DropdownMenuItem key={item.title} asChild><Link href={item.path ?? "/settings/ai"} aria-current={pathname === item.path ? "page" : undefined} onClick={closeMobile}>{item.icon}<span>{item.title}</span></Link></DropdownMenuItem>)}</DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu></SidebarMenuItem></SidebarMenu>
    </SidebarFooter>
  </Sidebar>;
}
