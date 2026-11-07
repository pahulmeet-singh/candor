"use client";

import { CalendarClock, FileText, LayoutDashboard, MessageSquareText, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ICONS = { LayoutDashboard, CalendarClock, MessageSquareText, FileText, ShieldCheck } as const;

export interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
}

/**
 * The only part of the shell that needs the browser: `usePathname` tells it
 * which link to mark as the current page (`aria-current`). `/interviews/new`
 * keeps "Interviews" highlighted because the match is on the path prefix.
 */
export function NavLinks({ items, variant }: { items: readonly NavItem[]; variant: "sidebar" | "tabs" }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  if (variant === "tabs") {
    return (
      <nav aria-label="Main" className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-background/92 backdrop-blur-md lg:hidden">
        <ul className="mx-auto flex max-w-xl pb-[env(safe-area-inset-bottom)]">
          {items.map((item) => {
            const Icon = ICONS[item.icon];
            const active = isActive(item.href);
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex flex-col items-center gap-1 px-1 py-2.5 text-[0.6875rem] font-medium transition-colors",
                    active ? "text-primary" : "text-muted hover:text-foreground",
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  return (
    <nav aria-label="Main">
      <ul className="grid gap-1">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          const active = isActive(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active ? "bg-raised text-foreground" : "text-muted hover:bg-raised/60 hover:text-foreground",
                )}
              >
                {active ? <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" aria-hidden="true" /> : null}
                <Icon className={cn("size-[1.125rem]", active && "text-primary")} aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
