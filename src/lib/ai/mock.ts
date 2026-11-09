/**
 * The offline provider (AI_MODE=mock).
 *
 * It selects questions from the built-in bank and evaluates answers with the
 * bank's rubric: which expected points does the answer cover, how long and how
 * well-ordered is it. It is deliberately simple and transparent, so a demo works
 * without an API key, the seed script can build a realistic history, and the
 * tests can pin the behaviour. It never claims to be a language model: the
 * report shows `candor-rubric-v1` as the model name.
 */

import { splitSentences } from "@/lib/annotate";
import { categoryLabel, type CategoryKey } from "@/lib/constants/categories";
import { COMPETENCY_KEYS, COMPETENCY_META, type CompetencyKey } from "@/lib/constants/competencies";
import { DIFFICULTIES, type Difficulty } from "@/lib/constants/difficulty";
import { ANSWER_MIN_WORDS } from "@/lib/constants/limits";
import {
  getBankQuestion,
  pickBankQuestions,
  type BankQuestion,
  type RubricPoint,
} from "@/lib/constants/question-bank";
import { average, clampInt, countWords, overallScore, READINESS_META, readinessOf } from "@/lib/scoring";
import { evaluationSchema, type Annotation, type Evaluation } from "@/lib/validations/feedback";
import type { Transcript, TranscriptQuestion } from "@/lib/validations/session";

export const MOCK_MODEL = "candor-rubric-v1";

export function mockQuestions(category: CategoryKey, difficulty: Difficulty, seed: string): TranscriptQuestion[] {
  return pickBankQuestions(category, difficulty, seed).map((question, index) => ({
    id: `q${index + 1}`,
    text: question.text,
    topic: question.topic,
    seedId: question.id,
  }));
}

// ───────────────────────── text analysis helpers ─────────────────────────

const REASONING_MARKERS = [
  "because",
  "so that",
  "therefore",
  "which means",
  "trade-off",
  "trade off",
  "tradeoff",
  "however",
  "instead",
  "otherwise",
  "as a result",
  "for example",
  "for instance",
  "e.g.",
  "whereas",
  "unless",
  "if",
];

const STRUCTURE_MARKERS = [
  "first",
  "second",
  "third",
  "then",
  "next",
  "finally",
  "in summary",
  "overall",
  "to conclude",
  "in short",
  "for example",
  "for instance",
  "on the other hand",
];

const FILLERS = ["um", "uh", "you know", "basically", "kind of", "sort of", "i guess", "or something"];

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whole-word (or whole-phrase) matcher, so "then" does not match inside "authentication". */
function phraseRegex(phrase: string): RegExp {
  return new RegExp(`\\b${escapeRegExp(phrase)}(?!\\w)`, "i");
}

const REASONING_REGEX = REASONING_MARKERS.map(phraseRegex);
const STRUCTURE_REGEX = STRUCTURE_MARKERS.map(phraseRegex);
const FILLER_REGEX = FILLERS.map(phraseRegex);

const countDistinct = (text: string, patterns: readonly RegExp[]): number =>
  patterns.reduce((n, pattern) => (pattern.test(text) ? n + 1 : n), 0);

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));
const trimTrailingStop = (s: string): string => s.replace(/[.\s]+$/, "");

type PointStatus = "covered" | "partial" | "missing";

interface PointResult {
  point: RubricPoint;
  status: PointStatus;
  hits: string[];
}

function checkPoint(lowerAnswer: string, point: RubricPoint): PointResult {
  const hits = point.anyOf.filter((phrase) => lowerAnswer.includes(phrase.toLowerCase()));
  const needed = point.min ?? 1;
  const status: PointStatus = hits.length >= needed ? "covered" : hits.length > 0 ? "partial" : "missing";
  return { point, status, hits };
}

function clarityOf(words: number, sentenceCount: number, text: string): number {
  if (words === 0 || sentenceCount === 0) return 0;
  const averageLength = words / sentenceCount;
  const lengthScore =
    averageLength < 6 ? averageLength / 6 : averageLength > 32 ? Math.max(0.3, 32 / averageLength) : 1;
  const fillerPenalty = Math.min(0.4, countDistinct(text, FILLER_REGEX) * 0.1);
  return clamp01(lengthScore - fillerPenalty);
}

// ───────────────────────── per-question analysis ─────────────────────────

interface QuestionAnalysis {
  evaluation: {
    questionId: string;
    score: number;
    summary: string;
    annotations: Annotation[];
    modelAnswer: string;
  };
  topic: string;
  answered: boolean;
  coverage: number;
  lengthFactor: number;
  reasoning: number;
  clarity: number;
  structure: number;
  missing: string[];
}

function sentenceContaining(sentences: readonly string[], hits: readonly string[]): string | undefined {
  const lowered = hits.map((h) => h.toLowerCase());
  return sentences.find((sentence) => {
    const lower = sentence.toLowerCase();
    return lowered.some((hit) => lower.includes(hit));
  });
}

function quoteOf(sentence: string): string {
  if (sentence.length <= 380) return sentence;
  const cut = sentence.slice(0, 380);
  const lastSpace = cut.lastIndexOf(" ");
  return lastSpace > 200 ? cut.slice(0, lastSpace) : cut;
}

function analyseQuestion(question: TranscriptQuestion, answerText: string): QuestionAnalysis {
  const bank: BankQuestion | undefined = getBankQuestion(question.seedId);
  const modelAnswer = bank?.modelAnswer ?? "No model answer is stored for this question.";
  const text = answerText.trim();
  const words = countWords(text);

  if (words < ANSWER_MIN_WORDS) {
    return {
      evaluation: {
        questionId: question.id,
        score: 0,
        summary: words === 0 ? "No answer was written for this question." : "The answer was too short to assess.",
        annotations: [],
        modelAnswer,
      },
      topic: question.topic,
      answered: false,
      coverage: 0,
      lengthFactor: 0,
      reasoning: 0,
      clarity: 0,
      structure: 0,
      missing: bank ? bank.rubric.map((p) => p.label) : [],
    };
  }

  const lower = text.toLowerCase();
  const sentences = splitSentences(text);
  const lengthFactor = clamp01(words / 70);
  const reasoning = clamp01(countDistinct(text, REASONING_REGEX) / 3);
  const structure = clamp01(
    0.6 * clamp01(countDistinct(text, STRUCTURE_REGEX) / 3) + 0.4 * clamp01(sentences.length / 4),
  );
  const clarity = clarityOf(words, sentences.length, text);

  let coverage: number;
  let summary: string;
  const annotations: Annotation[] = [];
  const missing: string[] = [];

  if (bank) {
    const results = bank.rubric.map((point) => checkPoint(lower, point));
    const covered = results.filter((r) => r.status === "covered").length;
    const partial = results.filter((r) => r.status === "partial").length;
    coverage = (covered + 0.5 * partial) / results.length;

    const used = new Set<string>();
    for (const result of [...results].sort((a, b) => Number(a.status === "partial") - Number(b.status === "partial"))) {
      if (result.status === "missing") {
        missing.push(result.point.label);
        continue;
      }
      const sentence = sentenceContaining(sentences, result.hits);
      if (!sentence || used.has(sentence)) continue;
      used.add(sentence);
      const label = trimTrailingStop(result.point.label);
      annotations.push({
        kind: result.status === "covered" ? "strength" : "gap",
        quote: quoteOf(sentence),
        note:
          result.status === "covered"
            ? `This lands a point interviewers look for: ${label}.`
            : `A start on this point, but it needs more: ${label}.`,
      });
    }

    const stillMissing = [...missing, ...results.filter((r) => r.status === "partial").map((r) => r.point.label)];
    summary =
      `You covered ${covered} of ${results.length} expected points.` +
      (stillMissing.length > 0
        ? ` Still to add: ${stillMissing
            .slice(0, 2)
            .map((label) => trimTrailingStop(label).replace(/^./, (c) => c.toLowerCase()))
            .join("; ")}.`
        : " Nothing important is missing.");
  } else {
    coverage = Math.min(0.6, words / 120);
    summary = "This question has no stored rubric, so the answer was judged on length, reasoning and structure only.";
  }

  const raw = 0.8 * coverage + 0.2 * lengthFactor;
  return {
    evaluation: {
      questionId: question.id,
      score: clampInt(raw * 10, 0, 10),
      summary,
      annotations: annotations.slice(0, 5),
      modelAnswer,
    },
    topic: question.topic,
    answered: true,
    coverage,
    lengthFactor,
    reasoning,
    clarity,
    structure,
    missing,
  };
}

// ───────────────────────── report-level wording ─────────────────────────

const COMPETENCY_TEXT: Record<CompetencyKey, { high: string; mid: string; low: string; action: string }> = {
  technical_accuracy: {
    high: "Your answers hit most of the points an interviewer would look for.",
    mid: "You cover the basics, but several expected points are missing or only touched on.",
    low: "Many expected points are missing. Revisit the fundamentals for these topics.",
    action:
      "Before the next session, write down the three or four points a complete answer must contain for each topic you missed.",
  },
  depth: {
    high: "You go past definitions into how things work and why.",
    mid: "You explain what things are, but not always how they work or why.",
    low: "Answers stay at the surface. Add the mechanism behind each claim.",
    action: "For every answer, add one sentence on how it works internally and one on a trade-off.",
  },
  problem_solving: {
    high: "You reason towards a solution and weigh alternatives.",
    mid: "Some reasoning shows, but alternatives and trade-offs are thin.",
    low: "Answers state facts without reasoning. Say why, and what you would pick instead.",
    action: "Practise one pattern: state the problem, give two options, pick one and say why.",
  },
  communication: {
    high: "Clear, well-paced sentences that are easy to follow out loud.",
    mid: "Mostly clear, with some long or rambling sentences.",
    low: "Answers are hard to follow: fragments, run-on sentences or filler words.",
    action: "Keep sentences under about 25 words and cut filler such as basically and kind of.",
  },
  structure: {
    high: "Answers have an order: claim, reasoning, example.",
    mid: "There is some order, but the steps are not always signposted.",
    low: "Answers lack a visible order. Signpost with first, then, finally.",
    action: "Open each answer with a one-line claim, then give reasoning, then an example.",
  },
};

function band(score: number): "high" | "mid" | "low" {
  if (score >= 7) return "high";
  if (score >= 4) return "mid";
  return "low";
}

function nextDifficulty(current: Difficulty, overall: number): Difficulty {
  if (overall < 75) return current;
  const index = DIFFICULTIES.indexOf(current);
  return DIFFICULTIES[Math.min(DIFFICULTIES.length - 1, index + 1)];
}

// ───────────────────────── the evaluator ─────────────────────────

export function mockEvaluate(
  transcript: Transcript,
  context: { category: CategoryKey; difficulty: Difficulty },
): Evaluation {
  const analyses = transcript.questions.map((question) =>
    analyseQuestion(question, transcript.answers[question.id]?.text ?? ""),
  );

  const questionScores = analyses.map((a) => a.evaluation.score);
  const overall = overallScore(questionScores);
  const answered = analyses.filter((a) => a.answered).length;

  const competencyScore = (pick: (a: QuestionAnalysis) => number): number =>
    clampInt(average(analyses.map((a) => (a.answered ? pick(a) : 0))) * 10, 0, 10);

  const rawScores: Record<CompetencyKey, number> = {
    technical_accuracy: competencyScore((a) => a.coverage),
    depth: competencyScore((a) => 0.6 * a.coverage + 0.4 * a.lengthFactor),
    problem_solving: competencyScore((a) => 0.5 * a.reasoning + 0.5 * a.coverage),
    communication: competencyScore((a) => a.clarity),
    structure: competencyScore((a) => a.structure),
  };

  const competencies = COMPETENCY_KEYS.map((key) => ({
    key,
    score: rawScores[key],
    note: COMPETENCY_TEXT[key][band(rawScores[key])],
  }));

  const ranked = [...competencies].sort((a, b) => b.score - a.score);
  const strongest = ranked[0];
  const weakest = ranked[ranked.length - 1];

  // Most common missing rubric points across the whole session.
  const missingCounts = new Map<string, number>();
  for (const analysis of analyses) {
    if (!analysis.answered) continue;
    for (const label of analysis.missing) missingCounts.set(label, (missingCounts.get(label) ?? 0) + 1);
  }
  const commonMissing = [...missingCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label]) => `${trimTrailingStop(label)}.`);

  const topStrengths: string[] = ranked
    .filter((c) => c.score >= 6)
    .slice(0, 2)
    .map((c) => `${COMPETENCY_META[c.key].label}: ${COMPETENCY_TEXT[c.key].high}`);
  for (const analysis of analyses) {
    if (topStrengths.length >= 3) break;
    if (analysis.evaluation.score >= 8) topStrengths.push(`A strong answer on ${analysis.topic.toLowerCase()}.`);
  }
  if (topStrengths.length === 0) {
    topStrengths.push("You wrote your answers down. That habit is what makes every later session better.");
  }

  const topImprovements: string[] = [...commonMissing];
  if (answered < analyses.length) topImprovements.push("Answer every question, even briefly. A blank answer scores zero.");
  if (weakest.score < 7) {
    topImprovements.push(`${COMPETENCY_META[weakest.key].label}: ${COMPETENCY_TEXT[weakest.key][band(weakest.score)]}`);
  }
  if (topImprovements.length === 0) {
    topImprovements.push("Practise saying your answers out loud against a timer. Delivery is the last ten percent.");
  }

  const weakestQuestion = [...analyses].sort((a, b) => a.evaluation.score - b.evaluation.score)[0];
  const upNext = nextDifficulty(context.difficulty, overall);
  const nextSteps = [
    COMPETENCY_TEXT[weakest.key].action,
    `Rewrite your answer on ${weakestQuestion.topic.toLowerCase()} using the model answer as a checklist, not a script.`,
    upNext !== context.difficulty
      ? `You are ready to move up: book a ${categoryLabel(context.category)} session at a higher difficulty.`
      : overall >= 75
        ? "You are already at the top level here. Try a different category to test the same skills on new ground."
        : `Book another ${categoryLabel(context.category)} session at the same level and aim to beat this score.`,
  ];

  const readiness = readinessOf(overall);
  const summary =
    `You answered ${answered} of ${analyses.length} questions and scored ${overall} out of 100. ` +
    `Your strongest area was ${COMPETENCY_META[strongest.key].label.toLowerCase()} and the one to work on is ` +
    `${COMPETENCY_META[weakest.key].label.toLowerCase()}. ${READINESS_META[readiness].blurb}`;

  // Parsing through the shared schema guarantees the offline report has exactly
  // the same shape and limits as one produced by a language model.
  return evaluationSchema.parse({
    summary,
    competencies,
    questions: analyses.map((a) => a.evaluation),
    topStrengths,
    topImprovements,
    nextSteps,
  });
}
