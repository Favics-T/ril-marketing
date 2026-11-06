import type { ReactNode } from "react";
import {
	LayoutDashboardIcon,
	NotebookPenIcon,
	LibraryIcon,
	CalendarIcon,
	UsersIcon,
	LightbulbIcon,
	MegaphoneIcon,
	TrendingUpIcon,
	UserPlusIcon,
	MailIcon,
	SproutIcon,
	FileChartColumnIncreasingIcon,
	MessageCircleMoreIcon,
	WorkflowIcon,
	SettingsIcon,
	BookOpenIcon,
	BotIcon,
	PanelsTopLeftIcon,
	FileSearchIcon,
	ClipboardCheckIcon,
	ChartNoAxesCombinedIcon,
	SendIcon,
	CopyIcon,
} from "lucide-react";

export type SidebarNavItem = {
	title: string;
	path?: string;
	icon?: ReactNode;
	isActive?: boolean;
	subItems?: SidebarNavItem[];
};

export type SidebarNavGroup = {
	label?: string;
	items: SidebarNavItem[];
};

/**
 * RIL Audience Intelligence — the real product navigation.
 * Groups follow content preparation, distribution, audiences, and measurement.
 */
export const navGroups: SidebarNavGroup[] = [
	{
		items: [
			{
				title: "Command Centre",
				path: "/dashboard",
				icon: <LayoutDashboardIcon />,
			},
			{ title: "Approvals", path: "/approvals", icon: <ClipboardCheckIcon /> },
		],
	},
	{
		label: "Content",
		items: [
			{ title: "Activities", path: "/activities", icon: <NotebookPenIcon /> },
			{ title: "Content Library", path: "/library", icon: <LibraryIcon /> },
			{ title: "Repurpose content", path: "/repurpose", icon: <CopyIcon /> },
			{ title: "SEO Workspace", path: "/seo", icon: <FileSearchIcon /> },
		],
	},
	{
		label: "Distribution",
		items: [
			{ title: "Calendar", path: "/calendar", icon: <CalendarIcon /> },
			{ title: "Social publishing", path: "/publishing", icon: <SendIcon /> },
			{ title: "Email", path: "/email", icon: <MailIcon /> },
			{ title: "Landing Pages", path: "/audience/landing-pages", icon: <PanelsTopLeftIcon /> },
		],
	},
	{
		label: "Audience",
		items: [
			{ title: "Segments", path: "/audience/segments", icon: <UsersIcon /> },
			{ title: "Insights", path: "/audience/insights", icon: <LightbulbIcon /> },
			{ title: "Campaigns", path: "/audience/campaigns", icon: <MegaphoneIcon /> },
			{ title: "Leads", path: "/leads", icon: <UserPlusIcon /> },
			{ title: "Nurture", path: "/nurture", icon: <SproutIcon /> },
			{ title: "Community Inbox", path: "/community", icon: <MessageCircleMoreIcon /> },
		],
	},
	{
		label: "Intelligence",
		items: [
			{ title: "Reports", path: "/reports", icon: <FileChartColumnIncreasingIcon /> },
			{ title: "Analytics", path: "/analytics", icon: <ChartNoAxesCombinedIcon /> },
			{ title: "Assistant", path: "/assistant", icon: <BotIcon /> },
			{ title: "Trends", path: "/trends", icon: <TrendingUpIcon /> },
		],
	},
	{
		label: "Settings",
		items: [
			{ title: "Automation", path: "/settings/automation", icon: <WorkflowIcon /> },
			{ title: "Brand Knowledge", path: "/settings/brand", icon: <BookOpenIcon /> },
			{ title: "AI & Integrations", path: "/settings/ai", icon: <SettingsIcon /> },
		],
	},
];

export const footerNavLinks: SidebarNavItem[] = [];

export const navLinks: SidebarNavItem[] = [
	...navGroups.flatMap((group) =>
		group.items.flatMap((item) =>
			item.subItems?.length ? [item, ...item.subItems] : [item]
		)
	),
	...footerNavLinks,
];
