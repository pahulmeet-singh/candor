"use client";

import { RotateCcw } from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";

/**
 * The error boundary for every route that does not define its own. Next.js
 * wraps the page in this component, so a failed query shows a message and a
 * retry button instead of a blank screen; `reset()` re-renders the segment.
 */
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="mx-auto flex min-h-[60dvh] w-full max-w-xl flex-1 flex-col items-start justify-center gap-4 px-6 py-20">
      <p className="text-sm font-medium text-coral">Something went wrong</p>
      <h1 className="font-serif text-4xl font-semibold tracking-tight">That page could not load.</h1>
      <p className="text-muted">
        The problem is on our side, not yours. Try again, and if it keeps happening, head back to the start.
      </p>
      {error.digest ? <p className="text-sm text-faint">Reference: {error.digest}</p> : null}
      <div className="flex flex-wrap gap-3 pt-2">
        <Button onClick={reset}>
          <RotateCcw aria-hidden="true" />
          Try again
        </Button>
        <Link href="/" className={buttonVariants({ variant: "secondary" })}>
          Go home
        </Link>
      </div>
    </main>
  );
}
