"use client";
import { FieldGroup as ShadcnFieldGroup } from "@/components/ui/field";
import { Alert as ShadcnAlert } from "@/components/ui/alert";


import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { authSchema, type AuthInput } from "@/lib/validation/audience";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupButton } from "@/components/ui/input-group";
import { Field, FieldLabel, FieldError, FieldDescription } from "@/components/ui/field";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [checkEmail, setCheckEmail] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AuthInput>({ resolver: zodResolver(authSchema) });

  const onSubmit = (values: AuthInput) =>
    startTransition(async () => {
      setFormError(null);
      try {
        const supabase = createClient();
        if (mode === "sign-in") {
          const { error } = await supabase.auth.signInWithPassword(values);
          if (error) {
            setFormError(error.message);
            return;
          }
          router.push("/dashboard");
          router.refresh();
        } else {
          const { data, error } = await supabase.auth.signUp({
            ...values,
            options: { emailRedirectTo: `${window.location.origin}/dashboard` },
          });
          if (error) {
            setFormError(error.message);
            return;
          }
          if (data.session) {
            router.push("/onboarding");
            router.refresh();
          } else {
            // Email confirmation required — no session yet.
            setCheckEmail(true);
          }
        }
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Unexpected error.");
      }
    });

  if (checkEmail) {
    return <Card className="ril-auth-form"><CardHeader><CardTitle asChild><h1>Check your inbox</h1></CardTitle><CardDescription>We sent a confirmation link. Click it, then sign in to set up your organization.</CardDescription></CardHeader><CardContent><Button asChild className="w-full"><Link href="/sign-in">Go to sign in</Link></Button></CardContent></Card>;
  }

  return (
    <Card className="ril-auth-form"><CardHeader>
      <Link href="/" aria-label="Renaissance Innovation Labs home" className="ril-auth-logo"><Image src="/logo/blackLogo.svg" alt="Renaissance Innovation Labs" width={100} height={45} priority /></Link>
      <CardTitle asChild><h1 className="text-2xl font-semibold leading-tight tracking-tight">
        {mode === "sign-in" ? "Sign in" : "Create account"}
      </h1></CardTitle>
      <CardDescription asChild><p className="mt-3 text-sm leading-6 text-muted-foreground">
        {mode === "sign-in"
          ? "Continue to your RIL marketing workspace."
          : "Create your account, then set up the workspace for your team."}
      </p></CardDescription></CardHeader><CardContent>
      <ShadcnFieldGroup asChild><form method="post" onSubmit={handleSubmit(onSubmit)} className="mt-8 flex flex-col gap-4" noValidate>
          <Field data-invalid={Boolean(errors.email)} data-disabled={pending}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <InputGroup>
              <InputGroupAddon><Mail aria-hidden="true" /></InputGroupAddon>
              <InputGroupInput id="email" type="email" autoComplete="email" autoFocus placeholder="you@company.com" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "email-error" : undefined} disabled={pending} {...register("email")} />
            </InputGroup>
            {errors.email ? <FieldError id="email-error">{errors.email.message}</FieldError> : null}
          </Field>
          <Field data-invalid={Boolean(errors.password)} data-disabled={pending}>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <InputGroup>
              <InputGroupAddon><Lock aria-hidden="true" /></InputGroupAddon>
              <InputGroupInput id="password" type={showPassword ? "text" : "password"} autoComplete={mode === "sign-in" ? "current-password" : "new-password"} aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? "password-error" : mode === "sign-up" ? "password-hint" : undefined} disabled={pending} {...register("password")} />
              <InputGroupAddon align="inline-end"><InputGroupButton type="button" size="icon-sm" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</InputGroupButton></InputGroupAddon>
            </InputGroup>
            {errors.password ? <FieldError id="password-error">{errors.password.message}</FieldError> : null}
            {mode === "sign-up" && !errors.password ? <FieldDescription id="password-hint">Use at least 8 characters for your password.</FieldDescription> : null}
          </Field>
          {formError ? (
            <ShadcnAlert asChild variant="destructive"><p role="alert" className="text-sm text-destructive">
              {formError}
            </p></ShadcnAlert>
          ) : null}
          <Button type="submit" className="w-full" disabled={pending || !hydrated}>
            {pending
              ? "Please wait…"
              : mode === "sign-in"
                ? "Sign in"
                : "Create account"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {mode === "sign-in" ? (
              <>
                Don&apos;t have an account?{" "}
                <Link href="/sign-up" className="font-medium text-foreground underline underline-offset-4 hover:text-flag">Sign up</Link>
              </>
            ) : (
              <>
                Have an account?{" "}
                <Link href="/sign-in" className="font-medium text-foreground underline underline-offset-4 hover:text-flag">Sign in</Link>
              </>
            )}
          </p>
        </form></ShadcnFieldGroup>
    </CardContent></Card>
  );
}
