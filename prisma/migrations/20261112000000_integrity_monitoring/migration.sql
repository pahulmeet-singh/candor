-- CreateEnum
CREATE TYPE "InterviewMode" AS ENUM ('PRACTICE', 'ASSESSMENT');

-- CreateEnum
CREATE TYPE "IntegrityEventType" AS ENUM ('FACE_MISSING', 'MULTIPLE_FACES', 'LOOKING_AWAY', 'TAB_HIDDEN', 'FOCUS_LOST', 'PASTE', 'CAMERA_OFF');

-- AlterTable
ALTER TABLE "Interview" ADD COLUMN     "mode" "InterviewMode" NOT NULL DEFAULT 'PRACTICE',
ADD COLUMN     "monitoringConsentAt" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "IntegrityEvent" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "type" "IntegrityEventType" NOT NULL,
    "questionId" TEXT,
    "startedAt" TIMESTAMPTZ(3) NOT NULL,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "detail" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntegrityEvent_interviewId_startedAt_idx" ON "IntegrityEvent"("interviewId", "startedAt");

-- AddForeignKey
ALTER TABLE "IntegrityEvent" ADD CONSTRAINT "IntegrityEvent_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Everything above is what `prisma migrate dev` generates from schema.prisma. The three constraints
-- below are written by hand, because Prisma has no syntax for CHECK constraints. They keep the
-- database honest even if the application code has a bug.

-- An ASSESSMENT interview must record that the candidate agreed to be monitored.
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_assessment_requires_consent_check"
    CHECK ("mode" = 'PRACTICE' OR "monitoringConsentAt" IS NOT NULL);

-- A duration cannot be negative.
ALTER TABLE "IntegrityEvent" ADD CONSTRAINT "IntegrityEvent_durationMs_check"
    CHECK ("durationMs" >= 0);

-- Privacy: `detail` may hold nothing but a character count, such as {"chars": 312}. No text and no
-- other keys. NULL and {} are allowed.
ALTER TABLE "IntegrityEvent" ADD CONSTRAINT "IntegrityEvent_detail_only_chars_check"
    CHECK (
        "detail" IS NULL
        OR (
            jsonb_typeof("detail") = 'object'
            AND ("detail" - 'chars') = '{}'::jsonb
            AND jsonb_typeof("detail" -> 'chars') = 'number'
        )
    );
