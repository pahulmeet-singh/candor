import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Shared look for every text-like control, so inputs, textareas and selects match. */
export const controlClasses = [
  "field-shadow w-full rounded-lg border border-field bg-surface text-[0.9375rem] text-foreground",
  "placeholder:text-faint transition-colors hover:border-muted",
  "focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary/40",
  "disabled:cursor-not-allowed disabled:opacity-60",
  "aria-[invalid=true]:border-coral aria-[invalid=true]:focus-visible:outline-coral/40",
].join(" ");

export function Input({ className, type = "text", ...props }: ComponentProps<"input">) {
  return <input type={type} className={cn(controlClasses, "h-10 px-3", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(controlClasses, "min-h-24 px-3 py-2.5 leading-relaxed", className)} {...props} />;
}
