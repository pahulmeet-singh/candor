"use client";

import { ChevronsUpDown, FileText, LogOut } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { logoutAction } from "@/actions/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initialsOf } from "@/lib/format";
import type { SessionUser } from "@/lib/types";
import { cn } from "@/lib/utils";

function Avatar({ user }: { user: SessionUser }) {
  if (user.image) {
    return <Image src={user.image} alt="" width={32} height={32} className="size-8 shrink-0 rounded-full" />;
  }
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary"
    >
      {initialsOf(user.name)}
    </span>
  );
}

/**
 * Account menu built on Radix DropdownMenu. Sign-out is a Server Action, but
 * the <form> that holds it lives outside the menu's portal: the menu content
 * unmounts as soon as an item is chosen, and a form that unmounts mid-submit
 * can lose its action. `requestSubmit()` triggers the same form from the item.
 */
export function UserMenu({ user, compact = false }: { user: SessionUser; compact?: boolean }) {
  const signOutForm = useRef<HTMLFormElement>(null);

  return (
    <>
      <form ref={signOutForm} action={logoutAction} className="hidden" />
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "flex items-center gap-3 rounded-xl text-left transition-colors hover:bg-raised",
            compact ? "p-1" : "w-full p-2",
          )}
          aria-label="Account menu"
        >
          <Avatar user={user} />
          {compact ? null : (
            <>
              <span className="grid min-w-0 flex-1 leading-tight">
                <span className="truncate text-sm font-medium">{user.name}</span>
                <span className="truncate text-xs text-muted">{user.email}</span>
              </span>
              <ChevronsUpDown className="size-4 shrink-0 text-muted" aria-hidden="true" />
            </>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>
            <span className="block truncate text-sm font-medium">{user.name}</span>
            <span className="block truncate text-xs font-normal text-muted">{user.email}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/resume">
              <FileText aria-hidden="true" />
              My résumé
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => signOutForm.current?.requestSubmit()}>
            <LogOut aria-hidden="true" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
