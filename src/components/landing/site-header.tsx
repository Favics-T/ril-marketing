"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuLink } from "@/components/ui/navigation-menu";

const links = [{ href: "#platform", label: "Capabilities" }, { href: "#workflow", label: "Workflow" }, { href: "#learning", label: "Learning" }, { href: "#faq", label: "FAQ" }];

export function SiteHeader({ signedIn = false }: { signedIn?: boolean }) {
  const [open, setOpen] = useState(false);
  return <header className="ril-home-header sticky top-0 z-40 bg-card">
    <div className="mx-auto flex h-[76px] max-w-[1240px] items-center justify-between gap-4 px-5 sm:px-8">
      <Link href="/" aria-label="RIL home" className="ril-home-logo shrink-0"><Image src="/logo/blackLogo.svg" alt="Renaissance Innovation Labs" width={100} height={45} priority className="h-9 w-auto" /></Link>
      <NavigationMenu aria-label="Primary" className="hidden lg:flex"><NavigationMenuList>{links.map(link=><NavigationMenuItem key={link.href}><NavigationMenuLink asChild><Link href={link.href}>{link.label}</Link></NavigationMenuLink></NavigationMenuItem>)}</NavigationMenuList></NavigationMenu>
      <div className="flex items-center gap-2">{!signedIn ? <Button asChild variant="ghost" className="hidden sm:inline-flex"><Link href="/sign-in">Sign in</Link></Button> : null}<Button asChild className="hidden sm:inline-flex"><Link href={signedIn ? "/dashboard" : "/sign-up"}>{signedIn ? "Open workspace" : "Create workspace"}</Link></Button><Button variant="outline" size="icon" aria-label="Open navigation" onClick={()=>setOpen(true)} className="lg:hidden"><Menu data-icon="inline-start" aria-hidden="true"/></Button></div>
    </div>
    <Sheet open={open} onOpenChange={setOpen}><SheetContent side="right" className="max-w-sm"><SheetTitle>RIL Marketing Workspace</SheetTitle><SheetDescription>Find out how the platform works, or open your workspace.</SheetDescription><nav aria-label="Mobile navigation" className="mt-3 flex flex-col">{links.map(link=><Button key={link.href} asChild variant="ghost" className="justify-start"><Link href={link.href} onClick={()=>setOpen(false)}>{link.label}</Link></Button>)}</nav><div className="mt-3 flex flex-col gap-2"><Button asChild><Link href={signedIn ? "/dashboard" : "/sign-up"} onClick={()=>setOpen(false)}>{signedIn ? "Open workspace" : "Create workspace"}</Link></Button>{!signedIn ? <Button asChild variant="outline"><Link href="/sign-in" onClick={()=>setOpen(false)}>Sign in</Link></Button> : null}</div></SheetContent></Sheet>
  </header>;
}
