"use client";
import { FieldGroup as ShadcnFieldGroup } from "@/components/ui/field";
import { Alert as ShadcnAlert } from "@/components/ui/alert";


import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createOrganization } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";

const schema = z.object({
  name: z.string().trim().min(2, "Name needs at least 2 characters").max(120),
});

export function OnboardingForm({ email }: { email?: string }) {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ name: string }>({ resolver: zodResolver(schema) });

  const onSubmit = (values: { name: string }) =>
    startTransition(async () => {
      setError(null);
      const fd = new FormData();
      fd.set("name", values.name);
      // Redirects to /dashboard on success (throws NEXT_REDIRECT).
      const result = await createOrganization(fd);
      if (!result.ok) setError(result.error ?? "Could not create organization.");
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Create your workspace</CardTitle>
        <CardDescription>
          {email ? `Signed in as ${email}. ` : ""}Name your organization to start recording activities and reviewing audience insights.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ShadcnFieldGroup asChild><form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <Field data-invalid={Boolean(errors.name)} data-disabled={pending}>
            <FieldLabel htmlFor="org-name">Organization name</FieldLabel>
            <Input id="org-name" autoComplete="organization" placeholder="e.g. Renaissance Innovation Labs" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "org-name-error" : undefined} disabled={pending} {...register("name")} />
            {errors.name ? <FieldError id="org-name-error">{errors.name.message}</FieldError> : null}
          </Field>
          {error ? (
            <ShadcnAlert asChild variant="destructive"><p role="alert" className="text-sm text-destructive">
              {error}
            </p></ShadcnAlert>
          ) : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Creating…" : "Create organization"}
          </Button>
        </form></ShadcnFieldGroup>
      </CardContent>
    </Card>
  );
}
