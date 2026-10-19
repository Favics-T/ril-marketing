"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownUp, CornerDownLeft, Search } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { navGroups } from "@/components/app-shared";

export function WorkspaceSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [openingMethod, setOpeningMethod] = useState<"pointer" | "keyboard">("keyboard");
  const inputRef = useRef<HTMLInputElement>(null);
  const instructionsId = useId();
  const router = useRouter();

  function changeOpen(value: boolean) {
    setOpen(value);
    if (!value) setQuery("");
  }

  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      const typing = target?.isContentEditable || target?.closest("input, textarea, select, [role='textbox'], [role='combobox']");
      const commandShortcut = (event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "k";
      const findShortcut = !typing && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "f";
      if (commandShortcut || findShortcut) {
        event.preventDefault();
        setOpeningMethod("keyboard");
        setQuery("");
        setOpen(value => !value);
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, []);

  return <Popover open={open} onOpenChange={changeOpen}>
    <PopoverTrigger asChild>
      <button type="button" aria-label="Search workspace pages" aria-keyshortcuts="f Control+k Meta+k" className="workspace-command-trigger" onPointerDown={() => setOpeningMethod("pointer")} onKeyDown={() => setOpeningMethod("keyboard")}>
        <Search aria-hidden="true" /><span>Find a page</span><kbd aria-hidden="true">F</kbd>
      </button>
    </PopoverTrigger>
    <PopoverContent data-workspace-portal="" data-opening-method={openingMethod} align="end" side="bottom" sideOffset={-44} collisionPadding={16} aria-label="Search workspace pages" className="workspace-command-popover p-0" onOpenAutoFocus={event => { event.preventDefault(); inputRef.current?.focus(); }}>
      <Command label="Workspace navigation" loop>
        <div className="workspace-command-input-row">
          <CommandInput ref={inputRef} aria-label="Search pages" aria-describedby={instructionsId} value={query} onValueChange={setQuery} placeholder="Find a page…" className="workspace-search-input pr-12" />
          <button type="button" aria-label="Close search" onClick={() => changeOpen(false)} className="workspace-command-close"><kbd>Esc</kbd></button>
        </div>
        <CommandList aria-label="Page search results" className="workspace-command-list">
          <CommandEmpty>No pages found. Try content, email or settings.</CommandEmpty>
          {navGroups.map(group => <CommandGroup key={group.label ?? "Workspace"} heading={group.label ?? "Workspace"}>
            {group.items.filter(item => item.path?.startsWith("/")).map(item => <CommandItem key={item.path} value={item.title} keywords={[group.label ?? "Workspace", item.path!]} onSelect={() => { changeOpen(false); router.push(item.path!); }}>
              {item.icon}<span>{item.title}</span>
            </CommandItem>)}
          </CommandGroup>)}
        </CommandList>
        <div className="workspace-command-footer" aria-hidden="true"><span><ArrowDownUp />Move</span><span><CornerDownLeft />Open</span></div>
        <p className="sr-only" id={instructionsId}>Type to filter pages. Use up and down arrows to select, Enter to open, and Escape to close.</p>
      </Command>
    </PopoverContent>
  </Popover>;
}
