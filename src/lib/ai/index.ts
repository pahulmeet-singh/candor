import "server-only";
import { ZodError } from "zod";
import type { CategoryKey } from "@/lib/constants/categories";
import type { Difficulty } from "@/lib/constants/difficulty";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { evaluationSchema, type Evaluation } from "@/lib/validations/feedback";
import {
  generatedQuestionsSchema,
  type Transcript,
  type TranscriptQuestion,
} from "@/lib/validations/session";
import { geminiJson } from "./gemini";
import { MOCK_MODEL, mockEvaluate, mockQuestions } from "./mock";
import {
  evaluationSystemPrompt,
  evaluationUserPrompt,
  questionsSystemPrompt,
  questionsUserPrompt,
  repairHint,
} from "./prompts";
import { reconcileEvaluation } from "./reconcile";
import { EVALUATION_JSON_SCHEMA, QUESTIONS_JSON_SCHEMA } from "./schemas";

/**
 * The only module the rest of the app imports for AI. It hides which provider
 * answered:
 *
 *   gemini  Google's model, asked for JSON that matches a schema.
 *   mock    an offline rubric evaluator over the built-in question bank.
 *
 * Model output is untrusted. Every reply is validated with Zod (and reconciled
 * against the transcript) before it leaves this file, one retry is allowed with
 * the validation problems spelled out, and if Gemini is down, rate limited or
 * keeps replying with unusable JSON the offline provider takes over so a
 * session is never lost. The report records which provider produced it.
 */

export interface GeneratedSession {
  questions: TranscriptQuestion[];
  source: Transcript["source"];
}

export interface EvaluationResult {
  evaluation: Evaluation;
  model: string;
  provider: "gemini" | "mock";
}

interface AskArgs<T> {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  pdf?: Uint8Array | null;
  validate: (json: unknown) => T;
}

/**
 * The AI Route Handlers declare `maxDuration = 60`. Every attempt shares one
 * budget that stays under it, so a slow first reply followed by a repair cannot
 * outlive the function: the second attempt gets whatever time is left, and if
 * that is not enough the offline provider answers instead.
 */
const AI_BUDGET_MS = 50_000;
const ATTEMPT_MAX_MS = 45_000;
const ATTEMPT_MIN_MS = 5_000;

/** One call, plus one repair attempt when the reply does not validate. */
async function ask<T>(args: AskArgs<T>): Promise<{ value: T; model: string }> {
  const deadline = Date.now() + AI_BUDGET_MS;
  let hint = "";
  for (let attempt = 1; ; attempt++) {
    const { json, model } = await geminiJson({
      system: args.system,
      prompt: args.prompt + hint,
      schema: args.schema,
      pdf: args.pdf,
      timeoutMs: Math.min(ATTEMPT_MAX_MS, Math.max(ATTEMPT_MIN_MS, deadline - Date.now())),
    });
    try {
      return { value: args.validate(json), model };
    } catch (error) {
      if (attempt >= 2) {
        if (error instanceof ZodError) {
          throw new AppError("AI_BAD_OUTPUT", "The AI report did not match the expected format.", { cause: error });
        }
        throw error;
      }
      logger.warn("ai.repair", { attempt, error });
      hint =
        error instanceof ZodError
          ? repairHint(error.issues)
          : repairHint([{ path: [], message: error instanceof Error ? error.message : "Invalid reply" }]);
    }
  }
}

function mockSource(usedResume: boolean): Transcript["source"] {
  return { provider: "mock", model: MOCK_MODEL, generatedAt: new Date().toISOString(), usedResume };
}

export async function generateQuestions(args: {
  interviewId: string;
  category: CategoryKey;
  difficulty: Difficulty;
  /** The candidate's résumé PDF, when they asked for tailored questions. */
  resumePdf?: Uint8Array | null;
}): Promise<GeneratedSession> {
  const fromBank = (): GeneratedSession => ({
    questions: mockQuestions(args.category, args.difficulty, args.interviewId),
    // The offline provider cannot read a PDF, so it never claims to have used one.
    source: mockSource(false),
  });

  if (env.aiMode === "mock") return fromBank();

  try {
    const withResume = Boolean(args.resumePdf);
    const { value, model } = await ask({
      system: questionsSystemPrompt(withResume),
      prompt: questionsUserPrompt(args.category, args.difficulty),
      schema: QUESTIONS_JSON_SCHEMA,
      pdf: args.resumePdf,
      validate: (json) => generatedQuestionsSchema.parse(json),
    });
    return {
      questions: value.questions.map((question, index) => ({
        id: `q${index + 1}`,
        text: question.text,
        topic: question.topic,
      })),
      source: { provider: "gemini", model, generatedAt: new Date().toISOString(), usedResume: withResume },
    };
  } catch (error) {
    if (!env.aiFallback) throw error;
    logger.warn("ai.questions.fallback", { error });
    return fromBank();
  }
}

export async function evaluateSession(args: {
  transcript: Transcript;
  category: CategoryKey;
  difficulty: Difficulty;
}): Promise<EvaluationResult> {
  const offline = (): EvaluationResult => ({
    evaluation: reconcileEvaluation(args.transcript, mockEvaluate(args.transcript, args)),
    model: MOCK_MODEL,
    provider: "mock",
  });

  // A session that was generated offline has no model-written questions, but the
  // reverse is also true: questions written by Gemini are graded by Gemini when it is available.
  if (env.aiMode === "mock") return offline();

  try {
    const { value, model } = await ask({
      system: evaluationSystemPrompt(),
      prompt: evaluationUserPrompt(args.transcript, args.category, args.difficulty),
      schema: EVALUATION_JSON_SCHEMA,
      validate: (json) => reconcileEvaluation(args.transcript, evaluationSchema.parse(json)),
    });
    return { evaluation: value, model, provider: "gemini" };
  } catch (error) {
    if (!env.aiFallback) throw error;
    logger.warn("ai.evaluate.fallback", { error });
    return offline();
  }
}
