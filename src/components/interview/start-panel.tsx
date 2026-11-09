"use client";

import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CategoryIcon } from "@/components/shared/category-icon";
import { DifficultyBadge } from "@/components/shared/interview-meta";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { categoryLabel, type CategoryKey } from "@/lib/constants/categories";
import type { Difficulty } from "@/lib/constants/difficulty";
import { ANSWER_MAX_CHARS, QUESTIONS_PER_SESSION } from "@/lib/constants/limits";

interface StartPanelProps {
  interviewId: string;
  category: CategoryKey;
  difficulty: Difficulty;
  usesResume: boolean;
}

/**
 * Shown before a session has started. "Start" calls the questions Route Handler,
 * which writes the questions (a slow call to the model) and moves the interview
 * to IN_PROGRESS. When it returns, `router.refresh()` re-runs the server page,
 * which now sees an in-progress interview and renders the room instead of this panel.
 */
export function StartPanel({ interviewId, category, difficulty, usesResume }: StartPanelProps) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setStarting(true);
    setError(null);
    try {
      const response = await fetch(`/api/interviews/${interviewId}/questions`, { method: "POST" });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message ?? "We could not start the session. Please try again.");
      }
      router.refresh();
    } catch (failure) {
      setStarting(false);
      setError(failure instanceof Error ? failure.message : "We could not start the session. Please try again.");
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-5 pt-4">
      <Card className="grid gap-6 p-6 sm:p-8">
        <div className="flex items-center gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-raised text-primary">
            <CategoryIcon category={category} className="size-6" />
          </span>
          <div>
            <h1 className="font-serif text-2xl font-semibold tracking-tight">{categoryLabel(category)} interview</h1>
            <p className="mt-1 flex items-center gap-2 text-sm text-muted">
              <DifficultyBadge difficulty={difficulty} />
              {QUESTIONS_PER_SESSION} questions
            </p>
          </div>
        </div>

        <ul className="grid gap-3 text-[0.9375rem] text-muted">
          <li>Answer in writing, as you would say it out loud. Up to {ANSWER_MAX_CHARS.toLocaleString("en-IN")} characters each.</li>
          <li>Your answers save automatically. You can go back to an earlier question at any point.</li>
          <li>When you submit, every answer is graded and you get a full report. Blank answers score zero.</li>
          {usesResume ? <li>The questions will draw on your résumé.</li> : null}
        </ul>

        {error ? (
          <Alert tone="danger" title="The session did not start">
            {error}
          </Alert>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" onClick={start} disabled={starting}>
            {starting ? (
              <>
                <LoaderCircle className="animate-spin" aria-hidden="true" />
                Writing your questions
              </>
            ) : (
              "Start the interview"
            )}
          </Button>
          <Link href={`/interviews/${interviewId}`} className={buttonVariants({ variant: "ghost", size: "lg" })}>
            Not now
          </Link>
        </div>
        <p className="text-sm text-faint" aria-live="polite">
          {starting ? "This usually takes a few seconds." : " "}
        </p>
      </Card>
    </div>
  );
}
