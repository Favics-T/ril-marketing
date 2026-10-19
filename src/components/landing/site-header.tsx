"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const links = [{ href: "#platform", label: "Platform" }, { href: "#workflow", label: "Workflow" }, { href: "#learning", label: "Learning" }, { href: "#faq", label: "FAQ" }];

export function SiteHeader({ signedIn = false }: { signedIn?: boolean }) {
  const [open, setOpen] = useState(false);
  return <header className="sticky top-0 z-40 border-b bg-card">
    <div className="mx-auto flex h-[76px] max-w-[1240px] items-center justify-between gap-4 px-5 sm:px-8">
      <Link href="/" aria-label="RIL home" className="shrink-0 rounded-md"><Image src="/logo/blackLogo.svg" alt="Renaissance Innovation Labs" width={116} height={52} priority className="h-9 w-auto" /></Link>
      <nav aria-label="Primary" className="hidden items-center gap-7 text-[13px] font-medium text-muted-foreground lg:flex">{links.map(link=><Link key={link.href} href={link.href} className="py-3 hover:text-foreground">{link.label}</Link>)}</nav>
      <div className="flex items-center gap-2">{!signedIn ? <Button asChild variant="ghost" className="hidden sm:inline-flex"><Link href="/sign-in">Sign in</Link></Button> : null}<Button asChild className="hidden sm:inline-flex"><Link href={signedIn ? "/dashboard" : "/sign-up"}>{signedIn ? "Open workspace" : "Create workspace"}</Link></Button><Button variant="outline" size="icon" aria-label="Open navigation" onClick={()=>setOpen(true)} className="lg:hidden"><Menu data-icon="inline-start" aria-hidden="true"/></Button></div>
    </div>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-sm"><DialogTitle>RIL Marketing Workspace</DialogTitle><DialogDescription>Find out how the platform works, or open your workspace.</DialogDescription><nav aria-label="Mobile navigation" className="mt-3 flex flex-col">{links.map(link=><Link key={link.href} href={link.href} onClick={()=>setOpen(false)} className="border-b py-4 text-base font-medium">{link.label}</Link>)}</nav><div className="mt-3 flex flex-col gap-2"><Button asChild><Link href={signedIn ? "/dashboard" : "/sign-up"} onClick={()=>setOpen(false)}>{signedIn ? "Open workspace" : "Create workspace"}</Link></Button>{!signedIn ? <Button asChild variant="outline"><Link href="/sign-in" onClick={()=>setOpen(false)}>Sign in</Link></Button> : null}</div></DialogContent></Dialog>
  </header>;
}
