import type { Metadata } from "next";
import Link from "next/link";
import { GoogleButton } from "@/components/auth/google-button";
import { RegisterForm } from "@/components/auth/register-form";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Create an account" };

export default function RegisterPage() {
  return (
    <div className="grid gap-7">
      <div>
        <h1 className="font-serif text-4xl leading-tight font-semibold tracking-tight">Create your account</h1>
        <p className="mt-2 text-muted">It takes a minute, and then you can book your first mock interview.</p>
      </div>

      {env.googleAuthEnabled ? <GoogleButton callbackUrl="/dashboard" /> : null}
      <RegisterForm />

      <p className="text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
