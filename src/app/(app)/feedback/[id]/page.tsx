import { ArrowLeft, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportView } from "@/components/feedback/report-view";
import { PageHeader } from "@/components/shared/page-header";
import { PrintButton } from "@/components/shared/print-button";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { categoryLabel } from "@/lib/constants/categories";
import { getFeedback } from "@/lib/data/feedback";

export const metadata: Metadata = { title: "Report" };

/**
 * The full report page. Opening a report from inside the app shows it in a modal
 * instead (the intercepting route in `@modal/(.)feedback/[id]`); this page is
 * what a direct visit, a refresh or a shared link renders. Both use `ReportView`.
 */
export default async function FeedbackReportPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  // The query includes the owner, so another user's report is a plain 404, not a 403 that confirms it exists.
  const report = await getFeedback(user.id, id);
  if (!report) notFound();

  return (
    <div className="mx-auto w-full max-w-4xl">
      <Link
        href="/feedback"
        className="no-print mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted underline-offset-4 hover:text-foreground hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        All reports
      </Link>
      <PageHeader
        title={`${categoryLabel(report.interview.category)} report`}
        description="Your answers with the strong and weak sentences marked, a score for each question and a model answer to compare against."
        actions={
          <>
            <PrintButton />
            <Link href={`/interviews/new?category=${report.interview.category}`} className={buttonVariants({ size: "sm" })}>
              <Plus aria-hidden="true" />
              Practise again
            </Link>
          </>
        }
      />
      <ReportView report={report} />
    </div>
  );
}
