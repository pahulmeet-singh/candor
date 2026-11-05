/**
 * The report shown on the public /sample-report page and in the landing-page
 * preview. It is not hand-written feedback: a made-up candidate's answers go
 * through the same offline evaluator and the same scoring rules as a real
 * session, so the page shows exactly what the product produces. Everything is
 * fixed (seed, dates, answers), which keeps the page statically renderable.
 */

import { mockEvaluate, mockQuestions, MOCK_MODEL } from "@/lib/ai/mock";
import { reconcileEvaluation } from "@/lib/ai/reconcile";
import { overallScore, readinessOf } from "@/lib/scoring";
import type { FeedbackDetailDTO } from "@/lib/types";
import type { Transcript } from "@/lib/validations/session";

export const SAMPLE_CATEGORY = "FULLSTACK_NEXT" as const;
export const SAMPLE_DIFFICULTY = "INTERMEDIATE" as const;

/** 10:00 am IST on a Monday; the session ran for 29 minutes. */
const SCHEDULED_AT = "2026-10-12T04:30:00.000Z";
const STARTED_AT = "2026-10-12T04:31:10.000Z";
const COMPLETED_AT = "2026-10-12T05:00:20.000Z";

/** Keyed by question-bank id, so the answer stays with its question if the picker changes. */
export const SAMPLE_ANSWERS: Record<string, string> = {
  "fs-01":
    "Every folder inside app/ is a URL segment, and a folder only becomes a public route when it contains a page.tsx file. A layout.tsx wraps the pages below it and persists across navigation, so something like a sidebar keeps its state and does not re-render when you move between child routes. loading.tsx is the Suspense fallback: Next streams that skeleton first and swaps the page in when its data is ready. There are also dynamic segments like [id] and route groups like (marketing) that organise folders without changing the URL.",
  "fs-05":
    "Static rendering means the page is built once at build time and served from a CDN, so it is very fast. Dynamic pages are rendered when someone asks for them, for example when they read cookies. ISR sits in between: the page is served from the cache and regenerated in the background once the revalidate time has passed.",
  "fs-04":
    "A Server Action is an async function marked with 'use server' that runs on the server, and you can pass it to a form as the action. A Route Handler is an endpoint defined in route.ts that other clients can call. For security you should remember to validate the input.",
  "fs-06":
    "You protect pages by checking with auth() that the user is logged in and sending them to the login page if not. Hiding a button does not protect anything because someone can still call the endpoint directly.",
  "fs-07":
    "This is the N+1 problem: one query loads the list and then there is an extra query per row for the feedback. It gets slow because the latency grows with the number of rows. In Prisma I would use include to load the feedback together with the interviews in a single query.",
};

function buildReport(): FeedbackDetailDTO {
  const questions = mockQuestions(SAMPLE_CATEGORY, SAMPLE_DIFFICULTY, "sample-report");
  const savedAt = new Date(COMPLETED_AT).toISOString();

  const transcript: Transcript = {
    questions,
    answers: Object.fromEntries(
      questions.map((question) => [question.id, { text: SAMPLE_ANSWERS[question.seedId ?? ""] ?? "", savedAt }]),
    ),
    source: { provider: "mock", model: MOCK_MODEL, generatedAt: STARTED_AT, usedResume: false },
  };

  const evaluation = reconcileEvaluation(
    transcript,
    mockEvaluate(transcript, { category: SAMPLE_CATEGORY, difficulty: SAMPLE_DIFFICULTY }),
  );
  const score = overallScore(evaluation.questions.map((question) => question.score));

  return {
    id: "sample",
    interviewId: "sample",
    overallScore: score,
    readiness: readinessOf(score),
    model: MOCK_MODEL,
    createdAt: COMPLETED_AT,
    evaluation,
    transcript,
    interview: {
      id: "sample",
      category: SAMPLE_CATEGORY,
      difficulty: SAMPLE_DIFFICULTY,
      scheduledAt: SCHEDULED_AT,
      startedAt: STARTED_AT,
      completedAt: COMPLETED_AT,
      durationMin: 30,
    },
  };
}

export const SAMPLE_REPORT: FeedbackDetailDTO = buildReport();
