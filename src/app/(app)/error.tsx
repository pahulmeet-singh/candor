"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

/**
 * Error boundary for the signed-in area. It sits inside the app shell, so the
 * navigation stays usable when one page fails; "Try again" re-renders only the
 * page that broke.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="grid max-w-xl gap-5 py-6">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">This page could not load.</h1>
      <Alert tone="danger" title="Something failed on our side">
        Your data is safe. Try again, and if it keeps failing, open another page from the menu.
        {error.digest ? ` Reference: ${error.digest}.` : ""}
      </Alert>
      <div>
        <Button onClick={reset}>
          <RotateCcw aria-hidden="true" />
          Try again
        </Button>
      </div>
    </div>
  );
}
