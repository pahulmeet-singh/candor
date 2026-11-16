"use client";

import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib/utils";

/** Radix Label: a real <label> that also stops text selection on double-click. */
export function Label({ className, ...props }) {
  return (
    <LabelPrimitive.Root
      className={cn("text-sm leading-none font-medium text-foreground select-none", className)}
      {...props}
    />
  );
}
