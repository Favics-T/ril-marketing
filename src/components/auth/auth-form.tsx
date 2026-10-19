"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Lock, Mail, FlaskConical } from "lucide-react";
import { authSchema, type AuthInput } from "@/lib/validation/audience";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [checkEmail, setCheckEmail] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
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
    return (
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Check your inbox</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We sent a confirmation link. Click it, then sign in to set up your
          organization.
        </p>
        <Button asChild className="mt-6 h-11 w-full">
          <Link href="/sign-in">Go to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <Link href="/" aria-label="Renaissance Innovation Labs home" className="mb-9 flex size-10 items-center justify-center rounded-full border border-border"><FlaskConical className="size-5" aria-hidden="true" /></Link>
      <h1 className="text-2xl font-semibold leading-tight tracking-tight">
        {mode === "sign-in" ? "Sign in" : "Create account"}
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {mode === "sign-in"
          ? "Access your RIL audience workspace."
          : "Create your account, then set up the workspace for your team."}
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="group relative">
              <Mail aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors duration-150 ease-snappy group-focus-within:text-foreground" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="you@company.com"
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? "email-error" : undefined}
                disabled={pending}
                className="h-11 pl-9"
                {...register("email")}
              />
            </div>
            {errors.email ? (
              <p id="email-error" role="alert" className="text-sm text-destructive">
                {errors.email.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="group relative">
              <Lock aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors duration-150 ease-snappy group-focus-within:text-foreground" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? "password-error" : mode === "sign-up" ? "password-hint" : undefined}
                disabled={pending}
                className="h-12 pl-9 pr-12"
                {...register("password")}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-1 top-1/2 h-11 w-11 -translate-y-1/2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground active:scale-100"
              >
                <span className="relative block h-4 w-4" aria-hidden>
                  {showPassword ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
                </span>
              </Button>
            </div>
            {errors.password ? (
              <p id="password-error" role="alert" className="text-sm text-destructive">
                {errors.password.message}
              </p>
            ) : null}
          </div>
          {mode === "sign-up" && !errors.password ? <p id="password-hint" className="text-xs text-muted-foreground">Use at least 8 characters for your password.</p> : null}
          {formError ? (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          ) : null}
          <Button type="submit" className="h-12 w-full" disabled={pending}>
            {pending
              ? "Please wait…"
              : mode === "sign-in"
                ? "Login"
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
        </form>
    </div>
  );
}
