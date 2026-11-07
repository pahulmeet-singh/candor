"use client";

import { useActionState, useState } from "react";
import { loginAction } from "@/actions/auth";
import { PasswordInput } from "@/components/auth/password-input";
import { SubmitButton } from "@/components/shared/submit-button";
import { Alert } from "@/components/ui/alert";
import { Field, describedBy } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/types";

type State = ActionResult<undefined> | null;

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  // React clears a form after its action finishes. Remembering the email in state and feeding it
  // back as `defaultValue` means a wrong password does not also wipe the address.
  const [email, setEmail] = useState("");
  const [state, formAction] = useActionState(async (previous: State, formData: FormData): Promise<State> => {
    setEmail(String(formData.get("email") ?? ""));
    return loginAction(previous, formData);
  }, null);

  const failure = state && !state.ok ? state : null;
  const fieldErrors = failure?.fieldErrors;

  return (
    <form action={formAction} className="grid gap-5" noValidate>
      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      {failure && !fieldErrors ? <Alert tone="danger">{failure.error}</Alert> : null}

      <Field label="Email" htmlFor="email" error={fieldErrors?.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={email}
          aria-invalid={Boolean(fieldErrors?.email)}
          aria-describedby={describedBy("email", { error: Boolean(fieldErrors?.email) })}
        />
      </Field>

      <Field label="Password" htmlFor="password" error={fieldErrors?.password}>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(fieldErrors?.password)}
          aria-describedby={describedBy("password", { error: Boolean(fieldErrors?.password) })}
        />
      </Field>

      <SubmitButton size="lg" pendingText="Signing in">
        Sign in
      </SubmitButton>
    </form>
  );
}
