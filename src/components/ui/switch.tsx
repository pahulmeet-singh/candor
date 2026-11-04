"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type SwitchProps = Omit<ComponentProps<"button">, "onChange" | "role" | "aria-checked" | "type"> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

/**
 * A controlled on/off switch. It is a <button role="switch" aria-checked>,
 * which is exactly what assistive technology expects, with no extra library.
 */
export function Switch({ checked, onCheckedChange, className, ...props }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      data-state={checked ? "checked" : "unchecked"}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "group relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-field bg-raised transition-colors",
        "data-[state=checked]:border-primary data-[state=checked]:bg-primary disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none block size-4 translate-x-1 rounded-full bg-foreground transition-transform group-data-[state=checked]:translate-x-6 group-data-[state=checked]:bg-primary-foreground"
      />
    </button>
  );
}
