"use client";

import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Radix DropdownMenu: arrow-key navigation, type-ahead, Escape and focus return come with it. */

export const DropdownMenu = DropdownPrimitive.Root;
export const DropdownMenuTrigger = DropdownPrimitive.Trigger;

export function DropdownMenuContent({
  className,
  sideOffset = 8,
  ...props
}: ComponentProps<typeof DropdownPrimitive.Content>) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        sideOffset={sideOffset}
        align="end"
        className={cn(
          "anim-fade z-50 min-w-56 overflow-hidden rounded-xl border border-line-strong bg-surface p-1.5 shadow-pop",
          className,
        )}
        {...props}
      />
    </DropdownPrimitive.Portal>
  );
}

export function DropdownMenuItem({ className, ...props }: ComponentProps<typeof DropdownPrimitive.Item>) {
  return (
    <DropdownPrimitive.Item
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground outline-none select-none",
        "data-[highlighted]:bg-raised data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:text-muted",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuLabel({ className, ...props }: ComponentProps<typeof DropdownPrimitive.Label>) {
  return <DropdownPrimitive.Label className={cn("px-2.5 py-2", className)} {...props} />;
}

export function DropdownMenuSeparator({ className, ...props }: ComponentProps<typeof DropdownPrimitive.Separator>) {
  return <DropdownPrimitive.Separator className={cn("my-1.5 h-px bg-line", className)} {...props} />;
}
