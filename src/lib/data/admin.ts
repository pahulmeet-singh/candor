import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { CATEGORY_KEYS } from "@/lib/constants/categories";
import { PAGE_SIZE } from "@/lib/constants/limits";
import { prisma } from "@/lib/db";
import type { AdminOverviewDTO, AdminUserRowDTO, Paginated, Role } from "@/lib/types";
import type { AdminUsersQuery } from "@/lib/validations/admin";

/**
 * Read-side queries for the admin console. Callers must have passed
 * `assertRole("ADMIN")` (or the page's own role check) first: nothing in here
 * looks at who is asking.
 */

export async function getAdminOverview(): Promise<AdminOverviewDTO> {
  const [users, admins, interviews, reports, resumes, average, perCategory] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.interview.count(),
    prisma.feedback.count(),
    prisma.resume.count(),
    prisma.feedback.aggregate({ _avg: { overallScore: true } }),
    Promise.all(CATEGORY_KEYS.map((category) => prisma.interview.count({ where: { category } }))),
  ]);

  return {
    users,
    admins,
    interviews,
    reports,
    resumes,
    averageScore: average._avg.overallScore === null ? null : Math.round(average._avg.overallScore),
    byCategory: CATEGORY_KEYS.map((category, index) => ({ category, interviews: perCategory[index] })),
  };
}

export async function listAdminUsers(query: AdminUsersQuery): Promise<Paginated<AdminUserRowDTO>> {
  const where: Prisma.UserWhereInput = query.q
    ? {
        OR: [
          { name: { contains: query.q, mode: "insensitive" } },
          { email: { contains: query.q, mode: "insensitive" } },
        ],
      }
    : {};

  const total = await prisma.user.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(query.page, totalPages);

  const users = await prisma.user.findMany({
    where,
    // ADMIN sorts after USER in the enum, so descending puts admins first.
    orderBy: [{ role: "desc" }, { createdAt: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      _count: { select: { interviews: true } },
    },
  });

  // One extra query for the page's report counts: a completed interview has exactly one report.
  const completed = await prisma.interview.findMany({
    where: { userId: { in: users.map((user) => user.id) }, status: "COMPLETED" },
    select: { userId: true },
  });
  const reportsByUser = new Map<string, number>();
  for (const row of completed) reportsByUser.set(row.userId, (reportsByUser.get(row.userId) ?? 0) + 1);

  return {
    items: users.map((user) => ({
      id: user.id,
      name: user.name?.trim() || user.email.split("@")[0],
      email: user.email,
      role: user.role as Role,
      createdAt: user.createdAt.toISOString(),
      interviews: user._count.interviews,
      reports: reportsByUser.get(user.id) ?? 0,
    })),
    page,
    pageSize: PAGE_SIZE,
    total,
    totalPages,
  };
}
