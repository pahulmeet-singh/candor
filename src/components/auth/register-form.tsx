"use client";

import { useActionState, useState } from "react";
import { registerAction } from "@/actions/auth";
import { PasswordInput } from "@/components/auth/password-input";
import { SubmitButton } from "@/components/shared/submit-button";
import { Alert } from "@/components/ui/alert";
import { Field, describedBy } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/types";

type State = ActionResult<undefined> | null;

export function RegisterForm() {
  const [values, setValues] = useState({ name: "", email: "" });
  const [state, formAction] = useActionState(async (previous: State, formData: FormData): Promise<State> => {
    setValues({ name: String(formData.get("name") ?? ""), email: String(formData.get("email") ?? "") });
    return registerAction(previous, formData);
  }, null);

  const failure = state && !state.ok ? state : null;
  const fieldErrors = failure?.fieldErrors;

  return (
    <form action={formAction} className="grid gap-5" noValidate>
      {failure && !fieldErrors ? <Alert tone="danger">{failure.error}</Alert> : null}

      <Field label="Your name" htmlFor="name" error={fieldErrors?.name}>
        <Input
          id="name"
          name="name"
          autoComplete="name"
          required
          defaultValue={values.name}
          aria-invalid={Boolean(fieldErrors?.name)}
          aria-describedby={describedBy("name", { error: Boolean(fieldErrors?.name) })}
        />
      </Field>

      <Field label="Email" htmlFor="email" error={fieldErrors?.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={values.email}
          aria-invalid={Boolean(fieldErrors?.email)}
          aria-describedby={describedBy("email", { error: Boolean(fieldErrors?.email) })}
        />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        hint="At least 8 characters, with a letter and a number."
        error={fieldErrors?.password}
      >
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(fieldErrors?.password)}
          aria-describedby={describedBy("password", { hint: true, error: Boolean(fieldErrors?.password) })}
        />
      </Field>

      <SubmitButton size="lg" pendingText="Creating your account">
        Create account
      </SubmitButton>
    </form>
  );
}
