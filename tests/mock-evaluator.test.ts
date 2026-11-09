import { test } from "node:test";
import assert from "node:assert/strict";
import { annotateAnswer, splitSentences } from "@/lib/annotate";
import { mockEvaluate, mockQuestions, MOCK_MODEL } from "@/lib/ai/mock";
import { CATEGORY_KEYS } from "@/lib/constants/categories";
import { COMPETENCY_KEYS } from "@/lib/constants/competencies";
import { QUESTION_BANK } from "@/lib/constants/question-bank";
import { overallScore } from "@/lib/scoring";
import { evaluationSchema } from "@/lib/validations/feedback";
import { transcriptSchema, type Transcript } from "@/lib/validations/session";

const NOW = "2026-10-30T05:00:00.000Z";

function transcriptFor(
  questions: Transcript["questions"],
  answerFor: (question: Transcript["questions"][number], index: number) => string,
): Transcript {
  return {
    questions,
    answers: Object.fromEntries(
      questions.map((q, i) => [q.id, { text: answerFor(q, i), savedAt: NOW }]),
    ),
    source: { provider: "mock", model: MOCK_MODEL, generatedAt: NOW, usedResume: false },
  };
}

const ctx = { category: "FRONTEND", difficulty: "INTERMEDIATE" } as const;

test("mockQuestions returns five schema-valid, seeded questions", () => {
  for (const category of CATEGORY_KEYS) {
    const questions = mockQuestions(category, "INTERMEDIATE", "interview-1");
    assert.equal(questions.length, 5);
    assert.deepEqual(questions.map((q) => q.id), ["q1", "q2", "q3", "q4", "q5"]);
    assert.ok(questions.every((q) => q.seedId));
    assert.equal(transcriptSchema.safeParse(transcriptFor(questions, () => "")).success, true);
  }
});

test("a model answer scores at least 8/10 against its own rubric, for all 48 questions", () => {
  for (const category of CATEGORY_KEYS) {
    for (const bank of QUESTION_BANK[category]) {
      const transcript = transcriptFor(
        [{ id: "q1", text: bank.text, topic: bank.topic, seedId: bank.id }],
        () => bank.modelAnswer,
      );
      const evaluation = mockEvaluate(transcript, { category, difficulty: bank.difficulty });
      assert.ok(evaluation.questions[0].score >= 8, `${bank.id} scored ${evaluation.questions[0].score}`);
    }
  }
});

test("blank and one-word answers score zero and the report is still valid", () => {
  const questions = mockQuestions("BACKEND", "BEGINNER", "blank");
  const evaluation = mockEvaluate(transcriptFor(questions, (_, i) => (i === 0 ? "idk" : "")), {
    category: "BACKEND",
    difficulty: "BEGINNER",
  });
  assert.ok(evaluation.questions.every((q) => q.score === 0));
  assert.equal(overallScore(evaluation.questions.map((q) => q.score)), 0);
  assert.match(evaluation.summary, /scored 0 out of 100/);
  assert.ok(evaluation.topImprovements.length >= 1);
  assert.ok(evaluation.nextSteps.length >= 1);
  assert.equal(evaluationSchema.safeParse(evaluation).success, true);
});

test("a longer, more complete answer never scores lower than a partial one", () => {
  for (const bank of QUESTION_BANK.FULLSTACK_NEXT) {
    const sentences = splitSentences(bank.modelAnswer);
    let previous = -1;
    for (let take = 1; take <= sentences.length; take++) {
      const partial = sentences.slice(0, take).join(" ");
      const transcript = transcriptFor([{ id: "q1", text: bank.text, topic: bank.topic, seedId: bank.id }], () => partial);
      const { score } = mockEvaluate(transcript, { category: "FULLSTACK_NEXT", difficulty: bank.difficulty }).questions[0];
      assert.ok(score >= previous, `${bank.id}: score fell from ${previous} to ${score} at ${take} sentences`);
      previous = score;
    }
  }
});

test("a full session of model answers is rated interview-ready", () => {
  const questions = mockQuestions("DSA", "ADVANCED", "full");
  const evaluation = mockEvaluate(
    transcriptFor(questions, (q) => QUESTION_BANK.DSA.find((b) => b.id === q.seedId)!.modelAnswer),
    { category: "DSA", difficulty: "ADVANCED" },
  );
  const overall = overallScore(evaluation.questions.map((q) => q.score));
  assert.ok(overall >= 80, `overall was ${overall}`);
  assert.match(evaluation.summary, new RegExp(`scored ${overall} out of 100`));
  assert.match(evaluation.nextSteps.join(" "), /different category/); // already at ADVANCED

  const intermediate = mockEvaluate(
    transcriptFor(questions, (q) => QUESTION_BANK.DSA.find((b) => b.id === q.seedId)!.modelAnswer),
    { category: "DSA", difficulty: "INTERMEDIATE" },
  );
  assert.match(intermediate.nextSteps.join(" "), /higher difficulty/);
});

test("the report contains each competency exactly once", () => {
  const questions = mockQuestions("SYSTEM_DESIGN", "INTERMEDIATE", "competencies");
  const evaluation = mockEvaluate(
    transcriptFor(questions, (q) => QUESTION_BANK.SYSTEM_DESIGN.find((b) => b.id === q.seedId)!.modelAnswer.slice(0, 160)),
    { category: "SYSTEM_DESIGN", difficulty: "INTERMEDIATE" },
  );
  assert.deepEqual(evaluation.competencies.map((c) => c.key).sort(), [...COMPETENCY_KEYS].sort());
  for (const c of evaluation.competencies) assert.ok(c.score >= 0 && c.score <= 10);
});

test("every annotation quote can be found in the candidate's answer", () => {
  for (const category of CATEGORY_KEYS) {
    const questions = mockQuestions(category, "INTERMEDIATE", `annotate-${category}`);
    const answers = new Map(
      questions.map((q) => {
        const bank = QUESTION_BANK[category].find((b) => b.id === q.seedId)!;
        return [q.id, splitSentences(bank.modelAnswer).slice(0, 3).join(" ")];
      }),
    );
    const evaluation = mockEvaluate(transcriptFor(questions, (q) => answers.get(q.id)!), {
      category,
      difficulty: "INTERMEDIATE",
    });
    for (const q of evaluation.questions) {
      const result = annotateAnswer(answers.get(q.questionId)!, q.annotations);
      assert.deepEqual(result.unmatched, [], `${category}/${q.questionId} has quotes that are not in the answer`);
    }
  }
});

test("evaluation is deterministic", () => {
  const questions = mockQuestions("BEHAVIOURAL", "BEGINNER", "same");
  const transcript = transcriptFor(questions, () => "I led a small team project and we delivered the demo because we planned well.");
  const a = mockEvaluate(transcript, { category: "BEHAVIOURAL", difficulty: "BEGINNER" });
  const b = mockEvaluate(transcript, { category: "BEHAVIOURAL", difficulty: "BEGINNER" });
  assert.deepEqual(a, b);
});

test("a question without a stored rubric is judged on form only and capped", () => {
  const long = "Because the cache sits in front of the database, reads are fast. However, it can go stale, so we invalidate it on every write. For example, a booking update deletes the key. ".repeat(6);
  const transcript = transcriptFor(
    [{ id: "q1", text: "Describe how you would cache a read-heavy endpoint.", topic: "Caching" }],
    () => long,
  );
  const evaluation = mockEvaluate(transcript, { category: "BACKEND", difficulty: "INTERMEDIATE" });
  assert.ok(evaluation.questions[0].score <= 7);
  assert.match(evaluation.questions[0].summary, /no stored rubric/);
  assert.equal(evaluation.questions[0].annotations.length, 0);
});

test("word-boundary markers: 'authentication' does not count as the word 'then'", () => {
  const withThen = "First we hash the password, then we compare, and finally we create the session cookie.";
  const withoutThen = "Authentication verifies credentials against a stored hash and issues a cookie value.";
  const base = { questions: [{ id: "q1", text: "Explain how login works in a web app.", topic: "Auth" }] };
  const t1 = mockEvaluate(transcriptFor(base.questions, () => withThen), { category: "BACKEND", difficulty: "BEGINNER" });
  const t2 = mockEvaluate(transcriptFor(base.questions, () => withoutThen), { category: "BACKEND", difficulty: "BEGINNER" });
  const structure = (e: ReturnType<typeof mockEvaluate>) => e.competencies.find((c) => c.key === "structure")!.score;
  assert.ok(structure(t1) > structure(t2));
});
