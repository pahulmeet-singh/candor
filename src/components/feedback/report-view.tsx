import { Check, ChevronDown, ListChecks, Target } from "lucide-react";
import type { ReactNode } from "react";
import { MOCK_MODEL } from "@/lib/ai/mock";
import { CategoryIcon } from "@/components/shared/category-icon";
import { AnnotatedAnswer } from "@/components/shared/annotated-answer";
import { CompetencyRadar } from "@/components/shared/competency-radar";
import { DifficultyBadge, ReadinessBadge } from "@/components/shared/interview-meta";
import { ScoreRing } from "@/components/shared/score-ring";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { categoryLabel } from "@/lib/constants/categories";
import { COMPETENCY_META } from "@/lib/constants/competencies";
import { formatLongDate, formatTime } from "@/lib/format";
import { READINESS_META, scoreTone, type ScoreTone } from "@/lib/scoring";
import type { FeedbackDetailDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

const BAR: Record<ScoreTone, string> = { low: "bg-coral", mid: "bg-primary", high: "bg-sage" };
const PILL: Record<ScoreTone, string> = {
  low: "bg-coral/15 text-coral",
  mid: "bg-primary/15 text-primary",
  high: "bg-sage/15 text-sage",
};

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid gap-4">
      <h2 id={id} className="font-serif text-xl font-semibold tracking-tight sm:text-2xl">
        {title}
      </h2>
      {children}
    </section>
  );
}

function TakeawayList({ title, icon: Icon, items, tone }: { title: string; icon: typeof Check; items: string[]; tone: string }) {
  return (
    <Card className="p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Icon className={cn("size-4", tone)} aria-hidden="true" />
        {title}
      </h3>
      <ul className="mt-3 grid gap-2.5 text-sm text-muted">
        {items.map((item) => (
          <li key={item} className="flex gap-2.5">
            <span className={cn("mt-2 size-1.5 shrink-0 rounded-full bg-current", tone)} aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/**
 * One evaluation report. It is a Server Component with no state, so the same
 * markup renders on the full page, inside the intercepted modal, on the public
 * sample page and in print.
 */
export function ReportView({ report }: { report: FeedbackDetailDTO }) {
  const { evaluation, transcript, interview } = report;
  const completedAt = interview.completedAt ?? report.createdAt;
  const minutes =
    interview.startedAt && interview.completedAt
      ? Math.max(1, Math.round((Date.parse(interview.completedAt) - Date.parse(interview.startedAt)) / 60_000))
      : null;
  const questions = new Map(transcript.questions.map((question) => [question.id, question]));
  const offline = report.model === MOCK_MODEL;

  return (
    <div className="grid gap-10">
      <Card className="flex flex-col items-center gap-7 p-6 sm:flex-row sm:items-start sm:p-8">
        <ScoreRing score={report.overallScore} size={152} stroke={11} caption="out of 100" />
        <div className="min-w-0 text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <ReadinessBadge readiness={report.readiness} />
            <DifficultyBadge difficulty={interview.difficulty} />
            <Badge tone="outline">
              <CategoryIcon category={interview.category} />
              {categoryLabel(interview.category)}
            </Badge>
          </div>
          <p className="mt-2 text-sm text-faint">
            {formatLongDate(completedAt)}, {formatTime(completedAt)}
            {minutes ? ` · ${minutes} min` : ""} · {READINESS_META[report.readiness].blurb}
          </p>
          <p className="prose-reading mt-4 max-w-2xl">{evaluation.summary}</p>
        </div>
      </Card>

      <Section id="competencies-heading" title="Five ways your answers were judged">
        <Card className="grid items-center gap-8 p-6 md:grid-cols-[minmax(0,22rem)_1fr]">
          <CompetencyRadar competencies={evaluation.competencies} className="mx-auto w-full max-w-sm" />
          <ul className="grid gap-4">
            {evaluation.competencies.map((competency) => {
              const tone = scoreTone(competency.score * 10);
              return (
                <li key={competency.key}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">{COMPETENCY_META[competency.key].label}</span>
                    <span className="text-sm font-semibold tabular-nums">{competency.score}/10</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-raised-2" aria-hidden="true">
                    <div className={cn("h-full rounded-full", BAR[tone])} style={{ width: `${competency.score * 10}%` }} />
                  </div>
                  <p className="mt-1.5 text-sm text-muted">{competency.note}</p>
                </li>
              );
            })}
          </ul>
        </Card>
      </Section>

      <Section id="takeaways-heading" title="What to take from it">
        <div className="grid gap-4 md:grid-cols-3">
          <TakeawayList title="What worked" icon={Check} items={evaluation.topStrengths} tone="text-sage" />
          <TakeawayList title="Fix these first" icon={Target} items={evaluation.topImprovements} tone="text-coral" />
          <TakeawayList title="Next steps" icon={ListChecks} items={evaluation.nextSteps} tone="text-sky" />
        </div>
      </Section>

      <Section id="answers-heading" title="Your answers, question by question">
        <p className="-mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
          <span>The highlighter marks the exact words each note is about:</span>
          <span className="prose-reading text-sm">
            <mark className="hl" data-kind="strength">
              a strength
            </mark>
          </span>
          <span className="prose-reading text-sm">
            <mark className="hl" data-kind="gap">
              a gap
            </mark>
          </span>
        </p>

        <div className="grid gap-5">
          {evaluation.questions.map((entry, index) => {
            const question = questions.get(entry.questionId);
            const answer = transcript.answers[entry.questionId]?.text ?? "";
            const tone = scoreTone(entry.score * 10);
            return (
              <Card key={entry.questionId} className="overflow-hidden" id={`question-${index + 1}`}>
                <article aria-label={`Question ${index + 1}`}>
                  <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5 sm:px-6">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="text-sm font-semibold">Question {index + 1}</span>
                      {question ? <Badge tone="outline">{question.topic}</Badge> : null}
                    </div>
                    <span className={cn("rounded-full px-3 py-0.5 text-sm font-semibold tabular-nums", PILL[tone])}>
                      {entry.score}/10
                    </span>
                  </header>

                  <div className="grid gap-5 p-5 sm:p-6">
                    <h3 className="font-serif text-lg leading-snug font-semibold tracking-tight sm:text-xl">
                      {question?.text ?? "Question not available"}
                    </h3>

                    <div className="grid gap-2">
                      <p className="text-sm font-medium text-muted">Your answer</p>
                      <div className="rounded-lg border border-line bg-background/60 p-4 sm:p-5">
                        <AnnotatedAnswer answer={answer} annotations={entry.annotations} />
                      </div>
                    </div>

                    <p className="text-sm text-muted">{entry.summary}</p>

                    <details className="group rounded-lg border border-line bg-raised/40">
                      <summary className="flex items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm font-medium select-none marker:content-none [&::-webkit-details-marker]:hidden">
                        A strong answer sounds like this
                        <ChevronDown className="size-4 text-muted transition-transform group-open:rotate-180" aria-hidden="true" />
                      </summary>
                      <p className="prose-reading border-t border-line px-4 py-4 text-base">{entry.modelAnswer}</p>
                    </details>
                  </div>
                </article>
              </Card>
            );
          })}
        </div>
      </Section>

      <footer className="grid gap-1 text-[0.8125rem] text-faint">
        <p>
          {offline
            ? "Scored by Candor's offline rubric evaluator: it checks your answer against a checklist of points, and no AI model was used for this report."
            : `Written by ${report.model}.`}{" "}
          {transcript.source.usedResume ? "The questions were tailored to your résumé. " : ""}
        </p>
        <p>An automated report can miss good ideas and over-reward keywords. Use it to find questions to practise again.</p>
      </footer>
    </div>
  );
}
