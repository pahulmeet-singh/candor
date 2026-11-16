import { cn } from "@/lib/utils";

/** A pulsing placeholder block. Used by `loading.jsx` files while a page streams in. */
export function Skeleton({ className, ...props }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-lg bg-raised", className)} {...props} />;
}
