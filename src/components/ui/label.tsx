"use client";

import * as LabelPrimitive from "@radix-ui/react-label";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Radix Label: a real <label> that also stops text selection on double-click. */
export function Label({ className, ...props }: ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn("text-sm leading-none font-medium text-foreground select-none", className)}
      {...props}
    />
  );
}
