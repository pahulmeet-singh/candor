import { FileText, SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { FilterBar } from "@/components/feedback/filter-bar";
import { ReportCard } from "@/components/feedback/report-card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { listFeedback } from "@/lib/data/feedback";
import { pluralize } from "@/lib/format";
import { feedbackFilterSchema } from "@/lib/validations/feedback";

export const metadata: Metadata = { title: "Feedback" };

/**
 * Server-side rendering with the filters in the URL. `feedbackFilterSchema` turns
 * whatever is in the query string into a valid filter (an unknown category or a
 * page of 99999 quietly becomes the default), Prisma runs one count and one
 * page query, and the filter form is the only client JavaScript on the page.
 */
export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const filters = feedbackFilterSchema.parse(await searchParams);
  const list = await listFeedback(user.id, filters);
  const filtered = filters.category !== undefined || filters.range !== "all";

  const hrefFor = (page: number): string => {
    const params = new URLSearchParams();
    if (filters.category) params.set("category", filters.category);
    if (filters.range !== "all") params.set("range", filters.range);
    if (filters.sort !== "recent") params.set("sort", filters.sort);
    if (page > 1) params.set("page", String(page));
    const query = params.toString();
    return query ? `/feedback?${query}` : "/feedback";
  };

  return (
    <>
      <PageHeader
        title="Feedback"
        description={
          list.total === 0 && !filtered
            ? "Reports appear here after you finish an interview."
            : `${pluralize(list.total, "report")}${filtered ? (list.total === 1 ? " matches these filters" : " match these filters") : " so far"}.`
        }
      />

      <div className="grid gap-5">
        {list.total === 0 && !filtered ? null : (
          <FilterBar category={filters.category} range={filters.range} sort={filters.sort} />
        )}

        {list.items.length === 0 ? (
          filtered ? (
            <EmptyState
              icon={SearchX}
              title="No reports match"
              action={
                <Link href="/feedback" className={buttonVariants({ variant: "secondary", size: "sm" })}>
                  Clear filters
                </Link>
              }
            >
              Try a different topic or a longer period.
            </EmptyState>
          ) : (
            <EmptyState
              icon={FileText}
              title="No reports yet"
              action={
                <Link href="/interviews/new" className={buttonVariants({ size: "sm" })}>
                  Book your first interview
                </Link>
              }
            >
              After a session you get a score, five competency scores and your answers with the strong and weak
              sentences highlighted.
            </EmptyState>
          )
        ) : (
          <Card>
            <ul className="divide-y divide-line">
              {list.items.map((report) => (
                <li key={report.id}>
                  <ReportCard report={report} />
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Pagination page={list.page} totalPages={list.totalPages} hrefFor={hrefFor} />
      </div>
    </>
  );
}
