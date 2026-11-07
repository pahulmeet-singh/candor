import { Plus } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/layout/logo";
import { NavLinks, type NavItem } from "@/components/layout/nav-links";
import { UserMenu } from "@/components/layout/user-menu";
import { buttonVariants } from "@/components/ui/button";
import { APP_NAV } from "@/lib/constants/site";
import type { SessionUser } from "@/lib/types";

const ADMIN_ITEM: NavItem = { href: "/admin", label: "Admin", icon: "ShieldCheck" };

/**
 * The frame around every signed-in page: a sidebar on large screens, a top bar
 * and a bottom tab bar on phones. It is a Server Component; only the links
 * (active state) and the account menu are Client Components.
 */
export function AppShell({ user, children }: { user: SessionUser; children: ReactNode }) {
  const items: readonly NavItem[] = user.role === "ADMIN" ? [...APP_NAV, ADMIN_ITEM] : APP_NAV;

  return (
    <div className="flex min-h-dvh flex-1">
      <aside className="no-print sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 border-r border-line bg-surface/60 p-4 lg:flex">
        <Logo href="/dashboard" className="px-2 pt-2" />
        <Link href="/interviews/new" className={buttonVariants({ className: "w-full" })}>
          <Plus aria-hidden="true" />
          Book an interview
        </Link>
        <NavLinks items={items} variant="sidebar" />
        <div className="mt-auto border-t border-line pt-3">
          <UserMenu user={user} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-background/85 px-4 backdrop-blur-md lg:hidden">
          <Logo href="/dashboard" />
          <UserMenu user={user} compact />
        </header>

        <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 pb-28 sm:px-8 lg:py-10 lg:pb-12">
          {children}
        </main>

        <NavLinks items={items} variant="tabs" />
      </div>
    </div>
  );
}
