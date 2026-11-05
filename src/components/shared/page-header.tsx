import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pb-7", className)}>
      <div className="min-w-0">
        <h1 className="font-serif text-[1.75rem] leading-tight font-semibold tracking-tight sm:text-[2rem]">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="no-print flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
