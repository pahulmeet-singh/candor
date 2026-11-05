import { Check } from "lucide-react";
import Link from "next/link";
import { CompetencyRadar } from "@/components/shared/competency-radar";
import { ReadinessBadge } from "@/components/shared/interview-meta";
import { ScoreRing } from "@/components/shared/score-ring";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SAMPLE_REPORT } from "@/lib/sample-report";

const POINTS = [
  "Five competencies, scored the same way every time, so progress is visible.",
  "A model answer beside each of yours, to use as a checklist rather than a script.",
  "Your score over time on a dashboard, so you know when to move up a level.",
] as const;

export function ReportShowcase() {
  const { evaluation, overallScore, readiness } = SAMPLE_REPORT;

  return (
    <section aria-labelledby="report-heading" className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16">
      <div>
        <h2 id="report-heading" className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
          A report built around your own words.
        </h2>
        <p className="mt-5 max-w-lg text-lg text-muted">
          Most feedback says &ldquo;add more detail&rdquo;. Candor quotes you back to yourself: the sentence that landed
          a point is highlighted, and so is the one that stayed vague.
        </p>
        <ul className="mt-7 grid gap-3">
          {POINTS.map((point) => (
            <li key={point} className="flex gap-3">
              <Check className="mt-1 size-4 shrink-0 text-sage" aria-hidden="true" />
              <span className="text-muted">{point}</span>
            </li>
          ))}
        </ul>
        <Link href="/sample-report" className={`${buttonVariants({ variant: "secondary" })} mt-8`}>
          Read the full sample report
        </Link>
      </div>

      <Card className="p-6" aria-label="Scores from the sample report">
        <div className="flex items-center gap-5">
          <ScoreRing score={overallScore} size={96} stroke={9} />
          <div className="grid justify-items-start gap-1.5">
            <ReadinessBadge readiness={readiness} />
            <p className="text-sm text-muted">Overall score from the sample session.</p>
          </div>
        </div>
        <CompetencyRadar competencies={evaluation.competencies} className="mx-auto mt-3 w-full max-w-sm" />
      </Card>
    </section>
  );
}
