"use client";

import { CircleAlert, ArrowLeft, ArrowRight, Check, CircleDashed, LoaderCircle, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { saveAnswerAction } from "@/actions/interviews";
import { CategoryIcon } from "@/components/shared/category-icon";
import { DifficultyBadge } from "@/components/shared/interview-meta";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { categoryLabel, type CategoryKey } from "@/lib/constants/categories";
import type { Difficulty } from "@/lib/constants/difficulty";
import { ANSWER_MAX_CHARS, ANSWER_MIN_WORDS } from "@/lib/constants/limits";
import { formatClock, formatTime, pluralize } from "@/lib/format";
import { countWords } from "@/lib/scoring";
import { cn } from "@/lib/utils";
import type { TranscriptQuestion } from "@/lib/validations/session";

interface InterviewRoomProps {
  interviewId: string;
  category: CategoryKey;
  difficulty: Difficulty;
  startedAt: string;
  durationMin: number;
  questions: TranscriptQuestion[];
  /** Question id to the text saved so far (from a refresh or an earlier visit). */
  initialAnswers: Record<string, string>;
}

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

/** How long to wait after the last keystroke before saving. */
const AUTOSAVE_MS = 1200;

/** A once-a-second clock as an external store, so the timer needs no state or effect of its own. */
function subscribeToClock(onChange: () => void): () => void {
  const id = window.setInterval(onChange, 1000);
  return () => window.clearInterval(id);
}
const readClock = (): number => Math.floor(Date.now() / 1000);
/** 0 on the server: the timer renders a placeholder first, then the real value after hydration. */
const readServerClock = (): number => 0;

function SaveIndicator({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  switch (state) {
    case "dirty":
      return <span className="flex items-center gap-1.5"><CircleDashed className="size-3.5" aria-hidden="true" />Unsaved changes</span>;
    case "saving":
      return <span className="flex items-center gap-1.5"><LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />Saving</span>;
    case "saved":
      return <span className="flex items-center gap-1.5 text-sage"><Check className="size-3.5" aria-hidden="true" />Saved {formatTime(new Date())}</span>;
    case "error":
      return (
        <span className="flex items-center gap-2 text-coral">
          <CircleAlert className="size-3.5" aria-hidden="true" />
          Could not save.
          <button type="button" onClick={onRetry} className="font-medium underline underline-offset-4">
            Try again
          </button>
        </span>
      );
    default:
      return <span>Saves automatically</span>;
  }
}

/**
 * The live interview room (a Client Component: it owns the typing, the timer and
 * the autosave). Three things worth knowing:
 *
 *  - Autosave is debounced per question and goes through a Server Action. The
 *    server patches only that one key of the JSONB transcript, so two saves can
 *    never overwrite each other.
 *  - The newest text always lives in a ref, so a save that finishes late can tell
 *    whether the user has typed more since and leave the state as "unsaved".
 *  - "Submit" sends every answer in the request body, so the report is built from
 *    exactly what is on screen even if the last save is still in flight.
 */
export function InterviewRoom({
  interviewId,
  category,
  difficulty,
  startedAt,
  durationMin,
  questions,
  initialAnswers,
}: InterviewRoomProps) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [saves, setSaves] = useState<Record<string, SaveState>>({});
  const [index, setIndex] = useState(0);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [grading, setGrading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const latest = useRef<Record<string, string>>(initialAnswers);
  const timers = useRef(new Map<string, number>());

  const nowSeconds = useSyncExternalStore(subscribeToClock, readClock, readServerClock);
  const remaining = nowSeconds === 0 ? null : Date.parse(startedAt) + durationMin * 60_000 - nowSeconds * 1000;

  async function persist(questionId: string) {
    const scheduled = timers.current.get(questionId);
    if (scheduled !== undefined) {
      window.clearTimeout(scheduled);
      timers.current.delete(questionId);
    }
    const text = latest.current[questionId] ?? "";
    setSaves((current) => ({ ...current, [questionId]: "saving" }));
    const result = await saveAnswerAction({ interviewId, questionId, text });
    const unchanged = (latest.current[questionId] ?? "") === text;
    setSaves((current) => ({ ...current, [questionId]: !result.ok ? "error" : unchanged ? "saved" : "dirty" }));
  }

  function edit(questionId: string, text: string) {
    latest.current[questionId] = text;
    setAnswers((current) => ({ ...current, [questionId]: text }));
    setSaves((current) => ({ ...current, [questionId]: "dirty" }));
    const scheduled = timers.current.get(questionId);
    if (scheduled !== undefined) window.clearTimeout(scheduled);
    timers.current.set(
      questionId,
      window.setTimeout(() => void persist(questionId), AUTOSAVE_MS),
    );
  }

  function go(next: number) {
    const current = questions[index];
    if (saves[current.id] === "dirty") void persist(current.id);
    setIndex(Math.min(questions.length - 1, Math.max(0, next)));
  }

  // Leaving the room (a link in the sidebar, say) flushes whatever is still waiting on its timer.
  useEffect(() => {
    const waiting = timers.current;
    const draft = latest.current;
    return () => {
      for (const [questionId, id] of waiting) {
        window.clearTimeout(id);
        void saveAnswerAction({ interviewId, questionId, text: draft[questionId] ?? "" });
      }
      waiting.clear();
    };
  }, [interviewId]);

  // Closing the tab with unsaved text asks for confirmation first.
  const hasUnsaved = Object.values(saves).some((state) => state === "dirty" || state === "saving" || state === "error");
  useEffect(() => {
    if (!hasUnsaved) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsaved]);

  async function submit() {
    setReviewOpen(false);
    setGrading(true);
    setSubmitError(null);
    for (const id of timers.current.values()) window.clearTimeout(id);
    timers.current.clear();
    setSaves({});
    try {
      const response = await fetch(`/api/interviews/${interviewId}/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: latest.current }),
      });
      const body = (await response.json().catch(() => null)) as {
        feedbackId?: string;
        error?: { message?: string };
      } | null;
      if (!response.ok || !body?.feedbackId) {
        throw new Error(body?.error?.message ?? "We could not grade this session. Your answers are saved, so you can try again.");
      }
      router.push(`/feedback/${body.feedbackId}`);
    } catch (failure) {
      setGrading(false);
      setSubmitError(failure instanceof Error ? failure.message : "We could not grade this session. Please try again.");
    }
  }

  const question = questions[index];
  const text = answers[question.id] ?? "";
  const words = countWords(text);
  const answered = questions.filter((item) => countWords(answers[item.id] ?? "") >= ANSWER_MIN_WORDS).length;
  const isLast = index === questions.length - 1;

  return (
    <div className="grid gap-5">
      <Card className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-raised text-primary">
            <CategoryIcon category={category} className="size-5" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate font-serif text-lg font-semibold">{categoryLabel(category)} interview</h1>
            <p className="mt-0.5 flex items-center gap-2 text-sm text-muted">
              <DifficultyBadge difficulty={difficulty} />
              Question {index + 1} of {questions.length}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span role="timer" className="text-sm tabular-nums text-muted">
            {remaining === null ? "–:––" : remaining > 0 ? `${formatClock(remaining)} left` : "Time is up, finish when ready"}
          </span>
          <Button onClick={() => setReviewOpen(true)}>
            <Send aria-hidden="true" />
            Finish and submit
          </Button>
        </div>
      </Card>

      {submitError ? (
        <Alert tone="danger" title="Could not submit">
          {submitError}
        </Alert>
      ) : null}

      <nav aria-label="Questions">
        <ol className="flex flex-wrap gap-2">
          {questions.map((item, position) => {
            const done = countWords(answers[item.id] ?? "") >= ANSWER_MIN_WORDS;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => go(position)}
                  aria-current={position === index ? "step" : undefined}
                  aria-label={`Question ${position + 1}${done ? ", answered" : ""}`}
                  className={cn(
                    "inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-medium tabular-nums transition-colors",
                    position === index
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-line bg-surface text-muted hover:bg-raised hover:text-foreground",
                  )}
                >
                  {position + 1}
                  {done ? <Check className="size-3.5 text-sage" aria-hidden="true" /> : null}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <Card className="grid gap-6 p-5 sm:p-8">
        <div className="grid gap-3">
          <Badge tone="outline" className="w-fit">
            {question.topic}
          </Badge>
          <h2 id="question-text" className="font-serif text-[1.375rem] leading-snug font-medium text-balance sm:text-[1.75rem]">
            {question.text}
          </h2>
        </div>

        <div className="grid gap-2">
          <label htmlFor="answer" className="sr-only">
            Your answer
          </label>
          <Textarea
            id="answer"
            key={question.id}
            value={text}
            onChange={(event) => edit(question.id, event.target.value)}
            maxLength={ANSWER_MAX_CHARS}
            rows={11}
            placeholder="Answer as you would out loud: what you would do first, why, and what could go wrong."
            className="min-h-64 resize-y font-serif text-[1.0625rem] leading-relaxed"
            aria-describedby="answer-meta"
          />
          <div id="answer-meta" className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm text-faint">
            <span>
              {pluralize(words, "word")} &middot; {text.length.toLocaleString("en-IN")} / {ANSWER_MAX_CHARS.toLocaleString("en-IN")}
            </span>
            <span aria-live="polite">
              <SaveIndicator state={saves[question.id] ?? "idle"} onRetry={() => void persist(question.id)} />
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
          <Button variant="ghost" onClick={() => go(index - 1)} disabled={index === 0}>
            <ArrowLeft aria-hidden="true" />
            Previous
          </Button>
          {isLast ? (
            <Button onClick={() => setReviewOpen(true)}>Review and submit</Button>
          ) : (
            <Button variant="secondary" onClick={() => go(index + 1)}>
              Next question
              <ArrowRight aria-hidden="true" />
            </Button>
          )}
        </div>
      </Card>

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit for feedback?</DialogTitle>
            <DialogDescription>
              You have answered {answered} of {questions.length} questions. Unanswered questions score zero, and you
              cannot change your answers after submitting.
            </DialogDescription>
          </DialogHeader>
          <ul className="grid gap-1.5 text-sm">
            {questions.map((item, position) => {
              const count = countWords(answers[item.id] ?? "");
              const done = count >= ANSWER_MIN_WORDS;
              return (
                <li key={item.id} className="flex items-center justify-between gap-3 rounded-md bg-raised px-3 py-2">
                  <span className="truncate">
                    {position + 1}. {item.topic}
                  </span>
                  <span className={cn("shrink-0 tabular-nums", done ? "text-sage" : "text-coral")}>
                    {done ? pluralize(count, "word") : "No answer"}
                  </span>
                </li>
              );
            })}
          </ul>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Keep writing</Button>
            </DialogClose>
            <Button onClick={() => void submit()}>Submit answers</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {grading ? (
        <div
          role="status"
          aria-live="polite"
          className="anim-fade fixed inset-0 z-[60] grid place-items-center bg-background/92 p-6 backdrop-blur-sm"
        >
          <div className="grid max-w-sm justify-items-center gap-4 text-center">
            <LoaderCircle className="size-9 animate-spin text-primary" aria-hidden="true" />
            <h2 className="font-serif text-2xl font-semibold">Reading your answers</h2>
            <p className="text-muted">
              Each answer is checked against what a strong one covers, and the sentences that worked or fell short are
              marked. This can take up to a minute. Please keep this tab open.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
