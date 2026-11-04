import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** A pulsing placeholder block. Used by `loading.tsx` files while a page streams in. */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-lg bg-raised", className)} {...props} />;
}
