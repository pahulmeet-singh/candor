import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  totalPages: number;
  /** Builds the URL for a page number, keeping whatever filters are already in the query string. */
  hrefFor: (page: number) => string;
}

/** Previous / next with a "Page 2 of 5" label. Plain links, so it works without JavaScript. */
export function Pagination({ page, totalPages, hrefFor }: PaginationProps) {
  if (totalPages <= 1) return null;

  const disabled = "pointer-events-none opacity-40";
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-4 pt-2">
      <Link
        href={hrefFor(Math.max(1, page - 1))}
        aria-disabled={page <= 1}
        tabIndex={page <= 1 ? -1 : undefined}
        className={cn(buttonVariants({ variant: "secondary", size: "sm" }), page <= 1 && disabled)}
      >
        <ChevronLeft aria-hidden="true" />
        Previous
      </Link>
      <p className="text-sm text-muted tabular-nums">
        Page {page} of {totalPages}
      </p>
      <Link
        href={hrefFor(Math.min(totalPages, page + 1))}
        aria-disabled={page >= totalPages}
        tabIndex={page >= totalPages ? -1 : undefined}
        className={cn(buttonVariants({ variant: "secondary", size: "sm" }), page >= totalPages && disabled)}
      >
        Next
        <ChevronRight aria-hidden="true" />
      </Link>
    </nav>
  );
}
