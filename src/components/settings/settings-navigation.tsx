"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { usePathname } from "next/navigation";

const sections = [
  { href: "/settings/ai", title: "AI & connections", detail: "Writing and delivery services" },
  { href: "/settings/brand", title: "Brand knowledge", detail: "Voice, facts, and guidance" },
  { href: "/settings/automation", title: "Automation", detail: "Draft preparation and history" },
];

export function SettingsNavigation() {
  const pathname = usePathname();
  return <nav className="ril-settings-navigation" aria-label="Workspace settings">{sections.map(section => <Button key={section.href} asChild variant={pathname.startsWith(section.href) ? "secondary" : "ghost"} className="settings-navigation-item"><Link href={section.href} aria-current={pathname.startsWith(section.href) ? "page" : undefined}><span className="settings-link-title">{section.title}</span><span className="settings-link-description">{section.detail}</span></Link></Button>)}</nav>;
}
