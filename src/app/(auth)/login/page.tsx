import type { Metadata } from "next";
import Link from "next/link";
import { GoogleButton } from "@/components/auth/google-button";
import { LoginForm } from "@/components/auth/login-form";
import { Alert } from "@/components/ui/alert";
import { env } from "@/lib/env";
import { safeCallbackUrl } from "@/lib/validations/auth";

export const metadata: Metadata = { title: "Sign in" };

type Props = { searchParams: Promise<{ callbackUrl?: string; error?: string }> };

/** Auth.js sends people back here with `?error=` when an OAuth sign-in fails. */
function oauthMessage(error: string | undefined): string | null {
  if (!error) return null;
  if (error === "OAuthAccountNotLinked") {
    return "That email already has a Candor account that uses a password. Sign in with your password instead.";
  }
  return "We could not sign you in. Please try again.";
}

export default async function LoginPage({ searchParams }: Props) {
  const { callbackUrl: rawCallback, error } = await searchParams;
  const callbackUrl = safeCallbackUrl(rawCallback);
  const oauthError = oauthMessage(error);

  return (
    <div className="grid gap-7">
      <div>
        <h1 className="font-serif text-4xl leading-tight font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-2 text-muted">Sign in to pick up your interviews and reports.</p>
      </div>

      {oauthError ? <Alert tone="danger">{oauthError}</Alert> : null}

      {env.demoMode ? (
        <Alert tone="info" title="Demo mode is on">
          Sign in as <strong className="font-semibold text-foreground">student@candor.test</strong> with the password{" "}
          <strong className="font-semibold text-foreground">Password123!</strong> to see an account with history. Admin:{" "}
          <strong className="font-semibold text-foreground">admin@candor.test</strong>.
        </Alert>
      ) : null}

      {env.googleAuthEnabled ? <GoogleButton callbackUrl={callbackUrl} /> : null}
      <LoginForm callbackUrl={callbackUrl} />

      <p className="text-sm text-muted">
        New to Candor?{" "}
        <Link href="/register" className="font-medium text-primary underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
