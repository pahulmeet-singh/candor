import Link from "next/link";
import { AnnotatedAnswer } from "@/components/shared/annotated-answer";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { pluralize } from "@/lib/format";
import { SAMPLE_REPORT } from "@/lib/sample-report";
import { scoreTone } from "@/lib/scoring";
import type { PublicStatsDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

/** The question the hero card shows: one that has both a strength and a gap highlighted. */
function featuredQuestion() {
  const { transcript, evaluation } = SAMPLE_REPORT;
  const question = transcript.questions.find((entry) => entry.seedId === "fs-05") ?? transcript.questions[0];
  const entry = evaluation.questions.find((item) => item.questionId === question.id) ?? evaluation.questions[0];
  return { question, entry, answer: transcript.answers[question.id]?.text ?? "" };
}

export function Hero({ stats }: { stats: PublicStatsDTO | null }) {
  const { question, entry, answer } = featuredQuestion();
  const tone = scoreTone(entry.score * 10);

  return (
    <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pt-14 pb-16 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:gap-14 lg:pt-24 lg:pb-24">
      <div>
        <h1 className="font-serif text-[2.75rem] leading-[1.04] font-semibold tracking-tight sm:text-6xl lg:text-[4.25rem]">
          Find <span className="sweep">the exact sentence</span> that sank your answer.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted">
          Book a slot, answer five questions in your own words, and get a report that highlights what worked and what
          did not, with a model answer to compare against.
        </p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Link href="/register" className={buttonVariants({ size: "lg" })}>
            Book a mock interview
          </Link>
          <Link href="/sample-report" className={buttonVariants({ size: "lg", variant: "secondary" })}>
            See a sample report
          </Link>
        </div>
        <ul className="mt-10 grid gap-1.5 border-l-2 border-line-strong pl-4 text-sm text-muted">
          <li>Six interview categories</li>
          <li>Half-hour slots, 10 am to 6 pm IST</li>
          <li>Typed answers, five questions</li>
        </ul>
        {stats && stats.reports > 0 ? (
          <p className="mt-5 text-sm text-faint">
            {pluralize(stats.reports, "report")} written so far for {pluralize(stats.learners, "learner")}.
          </p>
        ) : null}
      </div>

      <Card className="relative overflow-hidden shadow-pop" aria-label="Example of a highlighted answer">
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <p className="text-sm font-semibold">
            Question 2 <span className="font-normal text-muted">· {question.topic}</span>
          </p>
          <span
            className={cn(
              "rounded-full px-3 py-0.5 text-sm font-semibold tabular-nums",
              tone === "high" ? "bg-sage/15 text-sage" : tone === "mid" ? "bg-primary/15 text-primary" : "bg-coral/15 text-coral",
            )}
          >
            {entry.score}/10
          </span>
        </div>
        <div className="grid gap-4 p-5 sm:p-6">
          <h2 className="font-serif text-lg leading-snug font-semibold tracking-tight">{question.text}</h2>
          <div className="rounded-lg border border-line bg-background/60 p-4">
            <AnnotatedAnswer answer={answer} annotations={entry.annotations} />
          </div>
          <p className="text-[0.8125rem] text-faint">
            An example from the sample report: made-up answers, graded by the same evaluator as a real session.
          </p>
        </div>
      </Card>
    </section>
  );
}
