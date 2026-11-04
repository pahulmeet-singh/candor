import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";
import { controlClasses } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * A native <select> with the app's styling. The native element is kept on
 * purpose: it is keyboard and screen-reader complete, and on phones it opens
 * the operating system's own picker.
 */
export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        className={cn(controlClasses, "h-10 appearance-none bg-surface pr-9 pl-3", className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted"
        aria-hidden="true"
      />
    </div>
  );
}
