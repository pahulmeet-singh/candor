import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { Role, SessionUser } from "@/lib/types";

/**
 * The three ways server code asks "who is this?":
 *
 *   getCurrentUser  returns the user or null. Use it when both answers are fine.
 *   requireUser     for pages and layouts: redirects to /login when signed out.
 *   assertUser      for Server Actions and Route Handlers: throws AppError(401)
 *                   so the caller can answer with JSON instead of a redirect.
 *
 * `React.cache` makes the lookup free to repeat within one request, so a layout
 * and the page under it can both ask without decoding the cookie twice.
 */

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  const user = session?.user as
    | { id?: string; name?: string | null; email?: string | null; image?: string | null; role?: Role }
    | undefined;
  if (!user?.id || !user.email) return null;
  return {
    id: user.id,
    name: user.name?.trim() || user.email.split("@")[0],
    email: user.email,
    image: user.image ?? null,
    role: user.role === "ADMIN" ? "ADMIN" : "USER",
  };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function assertUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AppError("UNAUTHENTICATED", "Please sign in to continue.");
  return user;
}

/** Re-reads the role from the database, because the one in the JWT can be stale. */
export async function assertRole(role: Role): Promise<SessionUser> {
  const user = await assertUser();
  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } });
  if (!row || row.role !== role) throw new AppError("FORBIDDEN", "You do not have access to this.");
  return { ...user, role: row.role };
}
