"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const sections = [
  { href: "/settings/ai", title: "AI & connections", detail: "Writing and delivery services" },
  { href: "/settings/brand", title: "Brand knowledge", detail: "Voice, facts, and guidance" },
  { href: "/settings/automation", title: "Automation", detail: "Draft preparation and history" },
];

export function SettingsNavigation() {
  const pathname = usePathname();
  return <nav className="ril-settings-navigation" aria-label="Workspace settings">{sections.map(section => <Link key={section.href} href={section.href} aria-current={pathname.startsWith(section.href) ? "page" : undefined}><strong>{section.title}</strong><span>{section.detail}</span></Link>)}</nav>;
}
