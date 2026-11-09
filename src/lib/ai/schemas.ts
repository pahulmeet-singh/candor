/**
 * JSON Schemas that describe the two replies we ask Gemini for. They are sent as
 * `responseJsonSchema`, which makes the model return JSON in exactly this shape.
 *
 * They are written by hand next to the Zod schemas in lib/validations on purpose:
 * Zod stays the single authority on what we accept (it clips, rounds and rejects),
 * and these only tell the model what to produce. A mismatch is caught by the
 * contract test in tests/ai-contract.test.ts.
 */

import { COMPETENCY_KEYS } from "@/lib/constants/competencies";
import { QUESTIONS_PER_SESSION } from "@/lib/constants/limits";

export const QUESTIONS_JSON_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      minItems: QUESTIONS_PER_SESSION,
      maxItems: QUESTIONS_PER_SESSION,
      description: `Exactly ${QUESTIONS_PER_SESSION} interview questions, easiest first.`,
      items: {
        type: "object",
        properties: {
          text: { type: "string", description: "The question, written as the interviewer would say it." },
          topic: { type: "string", description: "A short topic label of 2 to 5 words." },
        },
        required: ["text", "topic"],
      },
    },
  },
  required: ["questions"],
} as const;

const score = { type: "integer", minimum: 0, maximum: 10 } as const;

export const EVALUATION_JSON_SCHEMA = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description: "Two to four sentences on how the session went overall. Do not state a total score.",
    },
    competencies: {
      type: "array",
      minItems: COMPETENCY_KEYS.length,
      maxItems: COMPETENCY_KEYS.length,
      description: "One entry for each of the five competencies, each exactly once.",
      items: {
        type: "object",
        properties: {
          key: { type: "string", enum: [...COMPETENCY_KEYS] },
          score,
          note: { type: "string", description: "One sentence explaining the score." },
        },
        required: ["key", "score", "note"],
      },
    },
    questions: {
      type: "array",
      description: "One entry per question, in the order asked.",
      items: {
        type: "object",
        properties: {
          questionId: { type: "string", description: "The id given in the question tag, for example q1." },
          score,
          summary: { type: "string", description: "One or two sentences on this answer." },
          annotations: {
            type: "array",
            description: "Between one and four notes that point at exact words in the answer.",
            items: {
              type: "object",
              properties: {
                kind: { type: "string", enum: ["strength", "gap"] },
                quote: { type: "string", description: "A short excerpt copied exactly from the candidate's answer." },
                note: { type: "string", description: "Why this part is a strength or a gap." },
              },
              required: ["kind", "quote", "note"],
            },
          },
          modelAnswer: { type: "string", description: "A concise strong answer, at most 120 words." },
        },
        required: ["questionId", "score", "summary", "annotations", "modelAnswer"],
      },
    },
    topStrengths: { type: "array", minItems: 1, maxItems: 5, items: { type: "string" } },
    topImprovements: { type: "array", minItems: 1, maxItems: 5, items: { type: "string" } },
    nextSteps: { type: "array", minItems: 1, maxItems: 5, items: { type: "string" } },
  },
  required: ["summary", "competencies", "questions", "topStrengths", "topImprovements", "nextSteps"],
} as const;
