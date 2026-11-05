import type { Metadata } from "next";
import Link from "next/link";
import { ReportView } from "@/components/feedback/report-view";
import { PageHeader } from "@/components/shared/page-header";
import { PrintButton } from "@/components/shared/print-button";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { SAMPLE_REPORT } from "@/lib/sample-report";

export const metadata: Metadata = {
  title: "A sample report",
  description: "See what a Candor report looks like: highlighted answers, five competencies and model answers.",
  alternates: { canonical: "/sample-report" },
};

/** Static: the report comes from a fixed fixture, so nothing here depends on a request. */
export default function SampleReportPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 pt-10 sm:px-6">
      <PageHeader
        title="A sample report"
        description="This is what you get after a session: your own words, highlighted, with a score and a model answer for every question."
        actions={
          <>
            <PrintButton />
            <Link href="/register" className={buttonVariants({ size: "sm" })}>
              Get your own
            </Link>
          </>
        }
      />
      <Alert tone="info" title="A demonstration, not a real candidate" className="no-print mb-9">
        The answers below were written for this page and graded by the same offline evaluator that scores real
        sessions when no AI key is configured.
      </Alert>
      <ReportView report={SAMPLE_REPORT} />
    </div>
  );
}
