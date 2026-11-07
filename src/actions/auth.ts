"use server";

import { redirect } from "next/navigation";
import { runAction } from "@/lib/action";
import { signIn, signOut } from "@/lib/auth/auth";
import { AppError, isAppError } from "@/lib/errors";
import { clientIp } from "@/lib/http";
import { assertWithinRate } from "@/lib/rate-limit";
import { registerUser } from "@/lib/services/account";
import type { ActionResult } from "@/lib/types";
import { loginSchema, registerSchema, safeCallbackUrl } from "@/lib/validations/auth";
import { formDataToObject, parseInput } from "@/lib/validations/common";

/**
 * Sign-in, sign-up and sign-out as Server Actions, used by the two forms with
 * `useActionState`. Failures come back as data (`{ ok: false, error, fieldErrors }`)
 * so the form can show them next to the right input; success redirects.
 *
 * A "use server" file may only export async functions, which is why the
 * helpers below are not exported.
 */

const FIFTEEN_MINUTES = 15 * 60_000;

/** Auth.js errors carry a `type` such as "CredentialsSignin". Matched by shape, not `instanceof`. */
function authJsErrorType(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined;
  const type = (error as { type?: unknown }).type;
  return typeof type === "string" ? type : undefined;
}

async function signInWithCredentials(email: string, password: string): Promise<void> {
  try {
    const result: unknown = await signIn("credentials", { email, password, redirect: false });
    // With `redirect: false` some versions return the error page URL instead of throwing.
    if (typeof result === "string" && /[?&]error=/.test(result)) {
      throw new AppError("UNAUTHENTICATED", "Email or password is incorrect.");
    }
  } catch (error) {
    if (isAppError(error)) throw error;
    const type = authJsErrorType(error);
    if (type === "CredentialsSignin") {
      throw new AppError("UNAUTHENTICATED", "Email or password is incorrect.", { cause: error });
    }
    if (type) {
      throw new AppError("UNAUTHENTICATED", "We could not sign you in. Please try again.", { cause: error });
    }
    throw error;
  }
}

export async function loginAction(
  _previous: ActionResult<undefined> | null,
  formData: FormData,
): Promise<ActionResult<undefined>> {
  const result = await runAction("auth.login", async () => {
    const input = parseInput(loginSchema, formDataToObject(formData));
    // Keyed by address and by account, so one guesser cannot lock a real user out from elsewhere.
    assertWithinRate(`login:ip:${await clientIp()}`, 20, FIFTEEN_MINUTES);
    assertWithinRate(`login:email:${input.email}`, 8, FIFTEEN_MINUTES);
    await signInWithCredentials(input.email, input.password);
    return { data: undefined };
  });
  if (!result.ok) return result;

  // `redirect()` works by throwing, so it must run outside runAction's try/catch.
  redirect(safeCallbackUrl(String(formData.get("callbackUrl") ?? "")));
}

export async function registerAction(
  _previous: ActionResult<undefined> | null,
  formData: FormData,
): Promise<ActionResult<undefined>> {
  const result = await runAction("auth.register", async () => {
    const input = parseInput(registerSchema, formDataToObject(formData));
    assertWithinRate(`register:ip:${await clientIp()}`, 6, 60 * 60_000);
    await registerUser(input);
    await signInWithCredentials(input.email, input.password);
    return { data: undefined };
  });
  if (!result.ok) return result;

  redirect("/dashboard");
}

export async function googleSignInAction(formData: FormData): Promise<void> {
  await signIn("google", { redirectTo: safeCallbackUrl(String(formData.get("callbackUrl") ?? "")) });
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}
