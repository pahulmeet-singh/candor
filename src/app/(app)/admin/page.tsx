import { Search } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RoleForm } from "@/components/admin/role-form";
import { StatCard } from "@/components/dashboard/stat-card";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { assertRole } from "@/lib/auth/session";
import { categoryLabel } from "@/lib/constants/categories";
import { getAdminOverview, listAdminUsers } from "@/lib/data/admin";
import { formatDay, pluralize } from "@/lib/format";
import { adminUsersQuerySchema } from "@/lib/validations/admin";

export const metadata: Metadata = { title: "Admin" };

/**
 * Role-based access control (RBAC), enforced in three places that each stand on their own:
 *  1. this page asks the database for the caller's role (the JWT's copy can be stale),
 *     and answers 404 rather than 403, so the route does not advertise itself;
 *  2. the nav link is only rendered for admins (cosmetic);
 *  3. every admin Server Action and Route Handler calls `assertRole("ADMIN")` again.
 */
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  let admin;
  try {
    admin = await assertRole("ADMIN");
  } catch {
    notFound();
  }

  const query = adminUsersQuerySchema.parse(await searchParams);
  const [overview, users] = await Promise.all([getAdminOverview(), listAdminUsers(query)]);
  const busiest = Math.max(1, ...overview.byCategory.map((row) => row.interviews));

  const hrefFor = (page: number): string => {
    const params = new URLSearchParams();
    if (query.q) params.set("q", query.q);
    if (page > 1) params.set("page", String(page));
    const text = params.toString();
    return text ? `/admin?${text}` : "/admin";
  };

  return (
    <>
      <PageHeader title="Admin" description="A read-only look at the platform, plus role management." />

      {/* grid-cols-1 keeps this column the width of the screen; the wide users table scrolls inside its card. */}
      <div className="grid grid-cols-1 gap-6">
        <section aria-label="Overview" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
          <StatCard label="Users" value={overview.users} hint={`${pluralize(overview.admins, "admin")}`} />
          <StatCard label="Interviews" value={overview.interviews} />
          <StatCard label="Reports" value={overview.reports} />
          <StatCard label="Résumés" value={overview.resumes} />
          <StatCard
            label="Average score"
            value={overview.averageScore === null ? "–" : overview.averageScore}
            hint="across all reports"
          />
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Interviews by topic</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3">
              {overview.byCategory.map((row) => (
                <li key={row.category} className="grid grid-cols-[minmax(0,11rem)_1fr_3rem] items-center gap-3 text-sm">
                  <span className="truncate text-muted">{categoryLabel(row.category)}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-raised-2" aria-hidden="true">
                    <span
                      className="block h-full rounded-full bg-primary"
                      style={{ width: `${(row.interviews / busiest) * 100}%` }}
                    />
                  </span>
                  <span className="text-right tabular-nums">{row.interviews}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Users</CardTitle>
            <form action="/admin" method="get" role="search" className="flex w-full items-center gap-2 sm:w-auto">
              <label htmlFor="admin-search" className="sr-only">
                Search by name or email
              </label>
              <Input
                id="admin-search"
                name="q"
                type="search"
                defaultValue={query.q ?? ""}
                placeholder="Search by name or email"
                className="h-9 min-w-0 flex-1 sm:w-64 sm:flex-none"
              />
              <Button type="submit" variant="secondary" size="sm">
                <Search aria-hidden="true" />
                Search
              </Button>
            </form>
          </CardHeader>
          <CardContent className="overflow-x-auto pt-4">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <caption className="sr-only">Registered users</caption>
              <thead className="text-muted">
                <tr className="border-b border-line">
                  <th scope="col" className="py-2 pr-4 font-medium">User</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Role</th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">Interviews</th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">Reports</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Joined</th>
                  <th scope="col" className="py-2 font-medium">Change role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {users.items.map((row) => (
                  <tr key={row.id}>
                    <td className="py-3 pr-4">
                      <p className="font-medium">{row.name}</p>
                      <p className="text-muted">{row.email}</p>
                    </td>
                    <td className="py-3 pr-4">
                      <Badge tone={row.role === "ADMIN" ? "primary" : "neutral"}>{row.role === "ADMIN" ? "Admin" : "User"}</Badge>
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums">{row.interviews}</td>
                    <td className="py-3 pr-4 text-right tabular-nums">{row.reports}</td>
                    <td className="py-3 pr-4 whitespace-nowrap text-muted">{formatDay(row.createdAt)}</td>
                    <td className="py-3">
                      <RoleForm userId={row.id} role={row.role} self={row.id === admin.id} label={row.name} />
                    </td>
                  </tr>
                ))}
                {users.items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted">
                      No users match that search.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Pagination page={users.page} totalPages={users.totalPages} hrefFor={hrefFor} />
      </div>
    </>
  );
}
