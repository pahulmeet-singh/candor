import { Check } from "lucide-react";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Logo } from "@/components/layout/logo";
import { getCurrentUser } from "@/lib/auth/session";
import { SITE } from "@/lib/constants/site";

const PROMISES = [
  "Pick a category and a half-hour slot",
  "Answer five questions in your own words",
  "Read feedback that quotes you back to yourself",
] as const;

/**
 * Wraps /login and /register. Someone who is already signed in has no use for
 * these pages, so they are sent to the dashboard. The check lives here, in the
 * server-rendered layout, and not in proxy.ts: the proxy can only see that a
 * cookie exists, and a stale cookie would redirect back and forth forever.
 */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="grid min-h-dvh flex-1 lg:grid-cols-[1fr_1.05fr]">
      <aside className="hidden flex-col justify-between border-r border-line bg-surface/70 p-12 lg:flex">
        <Logo />
        <div className="grid gap-8">
          <p className="max-w-md font-serif text-4xl leading-[1.1] font-semibold tracking-tight">
            Practise out loud, in your own words.
          </p>
          <ul className="grid gap-3">
            {PROMISES.map((promise) => (
              <li key={promise} className="flex gap-3 text-muted">
                <Check className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" />
                {promise}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-faint">{SITE.course}</p>
      </aside>

      <main id="main" className="flex flex-col px-4 py-8 sm:px-8">
        <div className="lg:hidden">
          <Logo />
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">{children}</div>
      </main>
    </div>
  );
}
