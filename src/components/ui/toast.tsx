"use client";

import type { ReactNode } from "react";
import { toast as notify } from "sonner";
import { Toaster } from "@/components/ui/sonner";

type ToastMessage = { title: string; description?: string; variant?: "default" | "destructive" };

function toast({ title, description, variant }: ToastMessage) {
  return variant === "destructive" ? notify.error(title, { description }) : notify(title, { description });
}

export function useToast() {
  return { toast };
}

export function ToastProvider({ children }: { children: ReactNode }) {
  return <>{children}<Toaster theme="light" position="bottom-right" closeButton duration={4000} visibleToasts={3} style={{ fontFamily: "var(--font-ril-sans), sans-serif" }} /></>;
}
