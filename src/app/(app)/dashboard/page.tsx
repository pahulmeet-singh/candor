import { FileText, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ScoreRing } from "@/components/shared/score-ring";
import { PageHeader } from "@/components/shared/page-header";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { categoryLabel } from "@/lib/constants/categories";
import { getRecentFeedback } from "@/lib/data/feedback";
import { getResume } from "@/lib/data/resume";
import { formatDay, greetingFor } from "@/lib/format";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * Server-side rendering (SSR): this page reads the session cookie, so it is
 * rendered on every request and never cached. It is the `children` of the
 * dashboard layout; the stat cards, chart and upcoming list are separate
 * parallel routes beside it.
 */
export default async function DashboardPage() {
  const user = await requireUser();
  const [recent, resume] = await Promise.all([getRecentFeedback(user.id, 3), getResume(user.id)]);
  const firstName = user.name.split(" ")[0];

  return (
    <>
      <PageHeader
        title={`${greetingFor(new Date())}, ${firstName}`}
        description="Here is where your practice stands."
        actions={
          <Link href="/interviews/new" className={buttonVariants()}>
            <Plus aria-hidden="true" />
            Book an interview
          </Link>
        }
        className="pb-0"
      />

      {resume ? null : (
        <Alert tone="info" title="Add your résumé for questions about your own projects">
          Upload a PDF once and switch on &ldquo;tailor to my résumé&rdquo; when you book.{" "}
          <Link href="/resume" className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline">
            <FileText className="size-3.5" aria-hidden="true" />
            Upload a résumé
          </Link>
        </Alert>
      )}

      {recent.length > 0 ? (
        <section aria-labelledby="recent-heading">
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-0">
              <CardTitle id="recent-heading">Latest reports</CardTitle>
              <Link href="/feedback" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                All reports
              </Link>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-1">
                {recent.map((report) => (
                  <li key={report.id}>
                    <Link
                      href={`/feedback/${report.id}`}
                      className="flex items-center gap-4 rounded-lg p-2.5 transition-colors hover:bg-raised"
                    >
                      <ScoreRing score={report.overallScore} size={52} stroke={5} />
                      <span className="grid min-w-0 flex-1 gap-0.5">
                        <span className="font-medium">{categoryLabel(report.category)}</span>
                        <span className="line-clamp-1 text-sm text-muted">{report.summary}</span>
                      </span>
                      <span className="hidden shrink-0 text-sm text-faint sm:block">{formatDay(report.completedAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      ) : null}
    </>
  );
}
