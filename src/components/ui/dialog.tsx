"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Radix Dialog gives us what is hard to get right by hand: focus is trapped
 * inside, Escape closes it, focus returns to the trigger, the page behind is
 * inert for screen readers, and it is rendered in a portal.
 */

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  hideClose = false,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & { hideClose?: boolean }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="anim-fade fixed inset-0 z-50 bg-black/65 backdrop-blur-[2px]" />
      <DialogPrimitive.Content
        className={cn(
          "anim-pop fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-2xl border border-line-strong bg-surface p-6 shadow-pop",
          className,
        )}
        {...props}
      >
        {children}
        {hideClose ? null : (
          <DialogPrimitive.Close
            className="absolute top-3.5 right-3.5 inline-flex size-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-raised hover:text-foreground"
            aria-label="Close"
          >
            <X className="size-4" aria-hidden="true" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("grid gap-1.5 pr-8", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />;
}

export function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn("font-serif text-xl leading-snug font-semibold tracking-tight", className)}
      {...props}
    />
  );
}

export function DialogDescription({ className, ...props }: ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn("text-sm text-muted", className)} {...props} />;
}
