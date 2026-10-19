"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import type { SidebarNavGroup, SidebarNavItem } from "@/components/app-shared";
import { ChevronRightIcon } from "lucide-react";

/** A route is active on exact match; nested routes light their parent too. */
function useIsActive() {
	const pathname = usePathname();
	return (item: SidebarNavItem): boolean => {
		if (!item.path || item.path.startsWith("#")) return false;
		if (item.path === "/dashboard") return pathname === "/dashboard";
		return pathname === item.path || pathname.startsWith(`${item.path}/`);
	};
}

export function NavGroup({ label, items }: SidebarNavGroup) {
	const isActive = useIsActive();
	return (
		<SidebarGroup>
			{label && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
			<SidebarMenu>
				{items.map((item) => {
					const active = isActive(item);
					const childActive = item.subItems?.some(isActive);
					return (
						<Collapsible
							asChild
							className="group/collapsible"
							defaultOpen={active || childActive}
							key={item.title}
						>
							<SidebarMenuItem>
								{item.subItems?.length ? (
									<>
										<CollapsibleTrigger asChild>
											<SidebarMenuButton isActive={active}>
												{item.icon}
												<span>{item.title}</span>
												<ChevronRightIcon className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
											</SidebarMenuButton>
										</CollapsibleTrigger>
										<CollapsibleContent>
											<SidebarMenuSub>
												{item.subItems?.map((subItem) => (
													<SidebarMenuSubItem key={subItem.title}>
														<SidebarMenuSubButton
															asChild
															isActive={isActive(subItem)}
														>
															<Link href={subItem.path ?? "#"}>
																{subItem.icon}
																<span>{subItem.title}</span>
															</Link>
														</SidebarMenuSubButton>
													</SidebarMenuSubItem>
												))}
											</SidebarMenuSub>
										</CollapsibleContent>
									</>
								) : (
									<SidebarMenuButton asChild isActive={active} tooltip={item.title}>
										<Link href={item.path ?? "#"} aria-label={item.title} aria-current={active ? "page" : undefined}>
											{item.icon}
											<span>{item.title}</span>
										</Link>
									</SidebarMenuButton>
								)}
							</SidebarMenuItem>
						</Collapsible>
					);
				})}
			</SidebarMenu>
		</SidebarGroup>
	);
}
