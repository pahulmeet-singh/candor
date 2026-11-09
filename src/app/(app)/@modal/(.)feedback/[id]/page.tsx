import { notFound } from "next/navigation";
import { ReportModal } from "@/components/feedback/report-modal";
import { ReportView } from "@/components/feedback/report-view";
import { requireUser } from "@/lib/auth/session";
import { categoryLabel } from "@/lib/constants/categories";
import { getFeedback } from "@/lib/data/feedback";

/**
 * Intercepting route: `(.)feedback/[id]` matches `/feedback/[id]` one level up.
 * When someone follows a report link from inside the app, Next.js renders this
 * into the `@modal` slot on top of the current page instead of navigating away.
 * A hard load of the same URL skips the interception and renders the full page.
 */
export default async function InterceptedReport({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const report = await getFeedback(user.id, id);
  if (!report) notFound();

  return (
    <ReportModal title={`${categoryLabel(report.interview.category)} report`} href={`/feedback/${id}`}>
      <ReportView report={report} />
    </ReportModal>
  );
}
