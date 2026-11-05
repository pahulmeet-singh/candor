import Link from "next/link";
import { cn } from "@/lib/utils";

export interface TabLink {
  href: string;
  label: string;
  count?: number;
  active: boolean;
}

/**
 * Tabs that are plain links. The selected tab lives in the URL (`?tab=past`),
 * so the page is a Server Component, the back button works, and a tab can be
 * bookmarked or shared. No client JavaScript is involved.
 */
export function TabLinks({ tabs, label }: { tabs: TabLink[]; label: string }) {
  return (
    <nav aria-label={label} className="flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.active ? "page" : undefined}
          className={cn(
            "-mb-px inline-flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
            tab.active
              ? "border-primary text-foreground"
              : "border-transparent text-muted hover:border-line-strong hover:text-foreground",
          )}
        >
          {tab.label}
          {tab.count !== undefined ? (
            <span
              className={cn(
                "rounded-full px-1.5 text-xs tabular-nums",
                tab.active ? "bg-primary/15 text-primary" : "bg-raised text-muted",
              )}
            >
              {tab.count}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
