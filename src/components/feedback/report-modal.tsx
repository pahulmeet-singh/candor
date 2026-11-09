"use client";

import { ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * The shell of the intercepted report. The dialog is always "open" while this
 * route is active; closing it calls `router.back()`, which returns to the page
 * underneath (the reports list or the dashboard) with its scroll position and
 * state intact, because that page never unmounted.
 */
export function ReportModal({ title, href, children }: { title: string; href: string; children: ReactNode }) {
  const router = useRouter();

  return (
    <Dialog open onOpenChange={(open: boolean) => (open ? undefined : router.back())}>
      <DialogContent className="max-w-4xl gap-6 p-5 sm:p-8">
        <DialogHeader className="justify-items-start sm:flex sm:items-start sm:justify-between">
          <div className="grid gap-1.5">
            <DialogTitle className="font-serif text-2xl">{title}</DialogTitle>
            <DialogDescription>Opened in a window. Close it to go back to where you were.</DialogDescription>
          </div>
          {/* A plain anchor on purpose: a full page load skips the interception and shows the standalone page. */}
          <a href={href} className={buttonVariants({ variant: "secondary", size: "sm" })}>
            <ExternalLink aria-hidden="true" />
            Open full page
          </a>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
