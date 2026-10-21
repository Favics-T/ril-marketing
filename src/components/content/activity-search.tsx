"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Form from "next/form";
import { useRouter } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

const DEBOUNCE_MS = 300;

/** Filters the activities list as you type by keeping `?q=` in the URL. */
export function ActivitySearch({ initialQuery }: { initialQuery: string }) {
	const router = useRouter();
	const [value, setValue] = useState(initialQuery);
	const [syncedQuery, setSyncedQuery] = useState(initialQuery);
	const [typing, setTyping] = useState(false);
	const [pending, startTransition] = useTransition();
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

	// The URL can change without typing (the "Clear search" link, back button),
	// so mirror it. While a search from this box is still waiting or loading,
	// skip it: it may be an older result arriving after newer keystrokes.
	if (initialQuery !== syncedQuery) {
		setSyncedQuery(initialQuery);
		if (!typing && !pending && initialQuery !== value.trim()) setValue(initialQuery);
	}

	useEffect(() => () => {
		if (timer.current) clearTimeout(timer.current);
	}, []);

	const navigate = (next: string) => {
		const term = next.trim();
		setTyping(false);
		startTransition(() => {
			router.replace(term ? `/activities?q=${encodeURIComponent(term)}` : "/activities", { scroll: false });
		});
	};

	const onChange = (next: string) => {
		setValue(next);
		setTyping(true);
		if (timer.current) clearTimeout(timer.current);
		timer.current = setTimeout(() => navigate(next), DEBOUNCE_MS);
	};

	const clear = () => {
		if (timer.current) clearTimeout(timer.current);
		setValue("");
		navigate("");
	};

	return (
		<Form action="/activities" role="search" className="relative w-full sm:max-w-md">
			<label>
				<span className="sr-only">Search activities</span>
				{pending ? (
					<Loader2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden="true" />
				) : (
					<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
				)}
				<Input
					name="q"
					type="search"
					value={value}
					onChange={(event) => onChange(event.target.value)}
					maxLength={100}
					autoComplete="off"
					placeholder="Search name, description, outcomes…"
					className="h-10 pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden"
				/>
			</label>
			{value ? (
				<button
					type="button"
					onClick={clear}
					aria-label="Clear search"
					className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
				>
					<X className="size-4" aria-hidden="true" />
				</button>
			) : null}
		</Form>
	);
}
