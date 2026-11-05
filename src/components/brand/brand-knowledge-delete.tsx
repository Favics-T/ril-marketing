"use client";
import { FieldGroup as ShadcnFieldGroup } from "@/components/ui/field";


import { useActionState } from "react";
import { deleteBrandKnowledge, type BrandActionResult } from "@/actions/brand";
import { Button } from "@/components/ui/button";

export function BrandKnowledgeDelete({ id }: { id: string }) {
  const [state, action, pending] = useActionState<BrandActionResult | null, FormData>(
    async () => deleteBrandKnowledge(id),
    null
  );
  return (
    <ShadcnFieldGroup asChild><form action={action} className="flex flex-col items-end gap-1">
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Removing…" : "Remove"}
      </Button>
      {state?.ok === false ? (
        <span role="alert" className="text-xs text-destructive">{state.error}</span>
      ) : null}
    </form></ShadcnFieldGroup>
  );
}
