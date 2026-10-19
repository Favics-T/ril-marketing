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
 * Every item points at a live route; groups follow the operating ritual
 * (capture → intelligence → growth → setup). No dead anchors.
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
		label: "Create & publish",
		items: [
			{ title: "Activities", path: "/activities", icon: <NotebookPenIcon /> },
			{ title: "Content Library", path: "/library", icon: <LibraryIcon /> },
			{ title: "Repurpose content", path: "/repurpose", icon: <CopyIcon /> },
			{ title: "SEO Workspace", path: "/seo", icon: <FileSearchIcon /> },
			{ title: "Calendar", path: "/calendar", icon: <CalendarIcon /> },
			{ title: "Social publishing", path: "/publishing", icon: <SendIcon /> },
		],
	},
	{
		label: "Audience & strategy",
		items: [
			{ title: "Segments", path: "/audience/segments", icon: <UsersIcon /> },
			{ title: "Insights", path: "/audience/insights", icon: <LightbulbIcon /> },
			{ title: "Campaigns", path: "/audience/campaigns", icon: <MegaphoneIcon /> },
			{ title: "Assistant", path: "/assistant", icon: <BotIcon /> },
			{ title: "Trends", path: "/trends", icon: <TrendingUpIcon /> },
		],
	},
	{
		label: "Reach & grow",
		items: [
			{ title: "Leads", path: "/leads", icon: <UserPlusIcon /> },
			{ title: "Email", path: "/email", icon: <MailIcon /> },
			{ title: "Nurture", path: "/nurture", icon: <SproutIcon /> },
			{ title: "Reports", path: "/reports", icon: <FileChartColumnIncreasingIcon /> },
			{ title: "Analytics", path: "/analytics", icon: <ChartNoAxesCombinedIcon /> },
			{ title: "Community Inbox", path: "/community", icon: <MessageCircleMoreIcon /> },
			{ title: "Landing Pages", path: "/audience/landing-pages", icon: <PanelsTopLeftIcon /> },
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
