/**
 * Demo data for development and the viva: `npm run db:seed`.
 *
 * It builds a believable history through the same code paths the app uses:
 * questions come from the offline bank, reports from the rubric evaluator and
 * the JSON is validated by the shared Zod schemas before it is written. The
 * answers get steadily more complete, so the score trend on the dashboard rises.
 * Safe to run repeatedly: demo users are upserted and their interviews rebuilt.
 */

import "dotenv/config";
import { hash } from "bcryptjs";
import { mockEvaluate, mockQuestions, MOCK_MODEL } from "../src/lib/ai/mock";
import { splitSentences } from "../src/lib/annotate";
import type { CategoryKey } from "../src/lib/constants/categories";
import type { Difficulty } from "../src/lib/constants/difficulty";
import { QUESTION_BANK, getBankQuestion } from "../src/lib/constants/question-bank";
import { Prisma } from "../src/generated/prisma/client";
import { createPrismaClient } from "../src/lib/prisma-client";
import { overallScore } from "../src/lib/scoring";
import { addDays, dateKeyOf, slotStartsFor } from "../src/lib/slots";
import { evaluationSchema } from "../src/lib/validations/feedback";
import { transcriptSchema, type Transcript } from "../src/lib/validations/session";

const PASSWORD = "Password123!";
const MINUTE = 60_000;

interface DemoUser {
  key: string;
  name: string;
  email: string;
  role: "USER" | "ADMIN";
}

const USERS: DemoUser[] = [
  { key: "admin", name: "Priya Nair", email: "admin@candor.test", role: "ADMIN" },
  { key: "student", name: "Aarav Mehta", email: "student@candor.test", role: "USER" },
  { key: "rohan", name: "Rohan Iyer", email: "rohan@candor.test", role: "USER" },
];

interface PastSession {
  user: string;
  daysAgo: number;
  /** Index of the slot in the day (0 = 10:00 IST). */
  slot: number;
  category: CategoryKey;
  difficulty: Difficulty;
  /** Share of the model answer the demo candidate "wrote". */
  completeness: number;
}

const PAST: PastSession[] = [
  { user: "student", daysAgo: 34, slot: 2, category: "FRONTEND", difficulty: "BEGINNER", completeness: 0.3 },
  { user: "student", daysAgo: 28, slot: 5, category: "BACKEND", difficulty: "BEGINNER", completeness: 0.4 },
  { user: "student", daysAgo: 21, slot: 8, category: "DSA", difficulty: "INTERMEDIATE", completeness: 0.5 },
  { user: "student", daysAgo: 14, slot: 3, category: "FULLSTACK_NEXT", difficulty: "INTERMEDIATE", completeness: 0.62 },
  { user: "student", daysAgo: 8, slot: 10, category: "BEHAVIOURAL", difficulty: "INTERMEDIATE", completeness: 0.78 },
  { user: "student", daysAgo: 3, slot: 6, category: "FRONTEND", difficulty: "INTERMEDIATE", completeness: 0.95 },
  { user: "admin", daysAgo: 5, slot: 4, category: "SYSTEM_DESIGN", difficulty: "INTERMEDIATE", completeness: 0.7 },
  { user: "rohan", daysAgo: 12, slot: 7, category: "DSA", difficulty: "BEGINNER", completeness: 0.45 },
  { user: "rohan", daysAgo: 4, slot: 9, category: "BACKEND", difficulty: "INTERMEDIATE", completeness: 0.6 },
];

interface UpcomingSession {
  user: string;
  inDays: number;
  slot: number;
  category: CategoryKey;
  difficulty: Difficulty;
  status: "SCHEDULED" | "CANCELLED";
}

const UPCOMING: UpcomingSession[] = [
  { user: "student", inDays: 1, slot: 4, category: "DSA", difficulty: "INTERMEDIATE", status: "SCHEDULED" },
  { user: "student", inDays: 3, slot: 9, category: "SYSTEM_DESIGN", difficulty: "ADVANCED", status: "SCHEDULED" },
  { user: "student", inDays: 2, slot: 2, category: "BACKEND", difficulty: "BEGINNER", status: "CANCELLED" },
  { user: "rohan", inDays: 1, slot: 4, category: "FRONTEND", difficulty: "BEGINNER", status: "SCHEDULED" },
];

/** The first `share` of the model answer's sentences (at least one). */
function partialAnswer(modelAnswer: string, share: number): string {
  const sentences = splitSentences(modelAnswer);
  const take = Math.max(1, Math.round(sentences.length * Math.min(1, Math.max(0, share))));
  return sentences.slice(0, take).join(" ");
}

async function main() {
  const prisma = createPrismaClient();
  try {
    const passwordHash = await hash(PASSWORD, 12);
    const ids = new Map<string, string>();

    for (const user of USERS) {
      const row = await prisma.user.upsert({
        where: { email: user.email },
        update: { name: user.name, role: user.role, passwordHash },
        create: { name: user.name, email: user.email, role: user.role, passwordHash },
      });
      ids.set(user.key, row.id);
    }
    const idOf = (key: string): string => {
      const id = ids.get(key);
      if (!id) throw new Error(`Unknown demo user ${key}`);
      return id;
    };

    // Rebuild the demo users' interviews from scratch (feedback cascades with them).
    await prisma.interview.deleteMany({ where: { userId: { in: [...ids.values()] } } });

    const today = dateKeyOf(new Date());
    let reports = 0;

    for (const [index, session] of PAST.entries()) {
      const interviewId = `demo-${session.user}-${index + 1}`;
      const scheduledAt = slotStartsFor(addDays(today, -session.daysAgo))[session.slot];
      const startedAt = new Date(scheduledAt.getTime() + MINUTE);
      const completedAt = new Date(scheduledAt.getTime() + 24 * MINUTE);

      const questions = mockQuestions(session.category, session.difficulty, interviewId);
      const answers: Transcript["answers"] = {};
      questions.forEach((question, position) => {
        const bank = getBankQuestion(question.seedId);
        if (!bank) return;
        // A little deterministic variety so the five scores in one report differ.
        const wobble = ((position * 37) % 5 - 2) * 0.06;
        answers[question.id] = {
          text: partialAnswer(bank.modelAnswer, session.completeness + wobble),
          savedAt: new Date(scheduledAt.getTime() + (position + 1) * 4 * MINUTE).toISOString(),
        };
      });

      const transcript = transcriptSchema.parse({
        questions,
        answers,
        source: { provider: "mock", model: MOCK_MODEL, generatedAt: startedAt.toISOString(), usedResume: false },
      });
      const evaluation = evaluationSchema.parse(
        mockEvaluate(transcript, { category: session.category, difficulty: session.difficulty }),
      );

      await prisma.interview.create({
        data: {
          id: interviewId,
          userId: idOf(session.user),
          category: session.category,
          difficulty: session.difficulty,
          scheduledAt,
          durationMin: 30,
          status: "COMPLETED",
          startedAt,
          completedAt,
          transcript: transcript as unknown as Prisma.InputJsonValue,
          feedback: {
            create: {
              overallScore: overallScore(evaluation.questions.map((q) => q.score)),
              evaluation: evaluation as unknown as Prisma.InputJsonValue,
              model: MOCK_MODEL,
              createdAt: completedAt,
            },
          },
        },
      });
      reports += 1;
    }

    for (const [index, session] of UPCOMING.entries()) {
      await prisma.interview.create({
        data: {
          id: `demo-upcoming-${index + 1}`,
          userId: idOf(session.user),
          category: session.category,
          difficulty: session.difficulty,
          scheduledAt: slotStartsFor(addDays(today, session.inDays))[session.slot],
          durationMin: 30,
          status: session.status,
        },
      });
    }

    const bankSize = Object.values(QUESTION_BANK).reduce((sum, list) => sum + list.length, 0);
    console.log(`Seeded ${USERS.length} users, ${PAST.length} completed interviews with ${reports} reports, ${UPCOMING.length} bookings.`);
    console.log(`Question bank in use: ${bankSize} questions. Demo password for every account: ${PASSWORD}`);
    for (const user of USERS) console.log(`  ${user.role.padEnd(5)} ${user.email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
