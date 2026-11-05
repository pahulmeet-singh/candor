import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** What a list shows when it has nothing in it: say why, then offer the next step. */
export function EmptyState({ icon: Icon, title, children, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border border-dashed border-line-strong px-6 py-12 text-center",
        className,
      )}
    >
      <span className="inline-flex size-11 items-center justify-center rounded-full bg-raised text-primary">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <h2 className="font-serif text-xl font-semibold tracking-tight">{title}</h2>
      {children ? <p className="max-w-md text-sm text-muted">{children}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
