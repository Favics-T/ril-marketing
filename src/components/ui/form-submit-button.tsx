"use client";

import { useFormStatus } from "react-dom";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";

export function FormSubmitButton({ children, pendingLabel = "Working…", disabled, ...props }: Omit<ComponentProps<typeof Button>, "asChild"> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return <Button {...props} type="submit" disabled={disabled || pending} aria-busy={pending}>{pending ? pendingLabel : children}</Button>;
}
