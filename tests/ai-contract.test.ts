import { test } from "node:test";
import assert from "node:assert/strict";
import { mockEvaluate, mockQuestions, MOCK_MODEL } from "@/lib/ai/mock";
import { EVALUATION_JSON_SCHEMA, QUESTIONS_JSON_SCHEMA } from "@/lib/ai/schemas";
import { COMPETENCY_KEYS } from "@/lib/constants/competencies";
import { QUESTIONS_PER_SESSION } from "@/lib/constants/limits";
import {
  annotationSchema,
  competencyScoreSchema,
  evaluationSchema,
  questionEvaluationSchema,
} from "@/lib/validations/feedback";
import type { Transcript } from "@/lib/validations/session";

/**
 * The JSON Schemas we send to Gemini (lib/ai/schemas.ts) are written by hand next
 * to the Zod schemas that decide what we accept. These tests keep the two in step:
 * if someone adds a field to one and forgets the other, a test fails here instead
 * of the model silently omitting the field in production.
 */

interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: readonly string[];
  items?: JsonSchema;
  enum?: readonly unknown[];
  minItems?: number;
  maxItems?: number;
  minimum?: number;
  maximum?: number;
}

/** A validator for the small subset of JSON Schema that schemas.ts uses. Returns a list of problems. */
function check(schema: JsonSchema, value: unknown, path = "$"): string[] {
  const problems: string[] = [];

  if (schema.enum && !schema.enum.includes(value)) problems.push(`${path}: ${JSON.stringify(value)} is not one of the allowed values`);

  switch (schema.type) {
    case "object": {
      if (typeof value !== "object" || value === null || Array.isArray(value)) return [`${path}: expected an object`];
      const record = value as Record<string, unknown>;
      for (const key of schema.required ?? []) if (!(key in record)) problems.push(`${path}.${key}: missing`);
      for (const key of Object.keys(record)) {
        const sub = schema.properties?.[key];
        // A key the model was never told about means the two schemas have drifted apart.
        if (!sub) problems.push(`${path}.${key}: not described in the JSON schema`);
        else problems.push(...check(sub, record[key], `${path}.${key}`));
      }
      return problems;
    }
    case "array": {
      if (!Array.isArray(value)) return [`${path}: expected an array`];
      if (schema.minItems !== undefined && value.length < schema.minItems) problems.push(`${path}: fewer than ${schema.minItems} items`);
      if (schema.maxItems !== undefined && value.length > schema.maxItems) problems.push(`${path}: more than ${schema.maxItems} items`);
      if (schema.items) value.forEach((item, index) => problems.push(...check(schema.items as JsonSchema, item, `${path}[${index}]`)));
      return problems;
    }
    case "string":
      if (typeof value !== "string") problems.push(`${path}: expected a string`);
      return problems;
    case "integer":
    case "number": {
      if (typeof value !== "number" || (schema.type === "integer" && !Number.isInteger(value))) return [`${path}: expected ${schema.type}`];
      if (schema.minimum !== undefined && value < schema.minimum) problems.push(`${path}: below ${schema.minimum}`);
      if (schema.maximum !== undefined && value > schema.maximum) problems.push(`${path}: above ${schema.maximum}`);
      return problems;
    }
    default:
      return problems;
  }
}

const evaluationJson = EVALUATION_JSON_SCHEMA as unknown as JsonSchema;
const questionsJson = QUESTIONS_JSON_SCHEMA as unknown as JsonSchema;

const shapeKeys = (schema: unknown): string[] =>
  Object.keys((schema as { shape: Record<string, unknown> }).shape).sort();

function sampleTranscript(): Transcript {
  const questions = mockQuestions("BACKEND", "INTERMEDIATE", "contract");
  const savedAt = "2026-10-30T05:00:00.000Z";
  return {
    questions,
    answers: Object.fromEntries(
      questions.map((q) => [
        q.id,
        { text: "A REST API uses HTTP methods and status codes, so a client can tell what happened. I would validate input first.", savedAt },
      ]),
    ),
    source: { provider: "mock", model: MOCK_MODEL, generatedAt: savedAt, usedResume: false },
  };
}

test("the JSON schema lists exactly the fields the Zod evaluation schema knows", () => {
  const props = evaluationJson.properties ?? {};
  assert.deepEqual(Object.keys(props).sort(), shapeKeys(evaluationSchema));
  assert.deepEqual([...(evaluationJson.required ?? [])].sort(), shapeKeys(evaluationSchema));

  const question = props.questions.items as JsonSchema;
  assert.deepEqual(Object.keys(question.properties ?? {}).sort(), shapeKeys(questionEvaluationSchema));
  assert.deepEqual([...(question.required ?? [])].sort(), shapeKeys(questionEvaluationSchema));

  const annotation = (question.properties?.annotations.items ?? {}) as JsonSchema;
  assert.deepEqual(Object.keys(annotation.properties ?? {}).sort(), shapeKeys(annotationSchema));

  const competency = props.competencies.items as JsonSchema;
  assert.deepEqual(Object.keys(competency.properties ?? {}).sort(), shapeKeys(competencyScoreSchema));
});

test("enums and ranges in the JSON schema match the constants the app uses", () => {
  const props = evaluationJson.properties ?? {};
  const competency = props.competencies.items as JsonSchema;
  assert.deepEqual([...(competency.properties?.key.enum ?? [])], [...COMPETENCY_KEYS]);
  assert.equal(props.competencies.minItems, COMPETENCY_KEYS.length);
  assert.equal(props.competencies.maxItems, COMPETENCY_KEYS.length);

  const question = props.questions.items as JsonSchema;
  const annotation = (question.properties?.annotations.items ?? {}) as JsonSchema;
  assert.deepEqual([...(annotation.properties?.kind.enum ?? [])], ["strength", "gap"]);
  assert.equal(question.properties?.score.minimum, 0);
  assert.equal(question.properties?.score.maximum, 10);

  const asked = questionsJson.properties?.questions;
  assert.equal(asked?.minItems, QUESTIONS_PER_SESSION);
  assert.equal(asked?.maxItems, QUESTIONS_PER_SESSION);
});

test("a real report from the offline evaluator satisfies the JSON schema we give the model", () => {
  const transcript = sampleTranscript();
  const evaluation = mockEvaluate(transcript, { category: "BACKEND", difficulty: "INTERMEDIATE" });
  assert.deepEqual(check(evaluationJson, evaluation), []);
  assert.equal(evaluationSchema.safeParse(evaluation).success, true);
});

test("the question payload shape is accepted by both validators", () => {
  const payload = { questions: mockQuestions("DSA", "BEGINNER", "contract").map(({ text, topic }) => ({ text, topic })) };
  assert.deepEqual(check(questionsJson, payload), []);
});

test("the schema validator used here really does catch drift", () => {
  const transcript = sampleTranscript();
  const evaluation = mockEvaluate(transcript, { category: "BACKEND", difficulty: "INTERMEDIATE" });
  const withExtra = { ...evaluation, confidence: 0.9 };
  assert.ok(check(evaluationJson, withExtra).some((problem) => problem.includes("confidence")));
  const withoutSummary: Record<string, unknown> = { ...evaluation };
  delete withoutSummary.summary;
  assert.ok(check(evaluationJson, withoutSummary).some((problem) => problem.includes("summary")));
});
