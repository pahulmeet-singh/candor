import "server-only";
import { toResumeDTO } from "@/lib/data/mappers";
import { prisma } from "@/lib/db";
import type { ResumeDTO } from "@/lib/types";

/** The user's saved résumé, or null. There is at most one per user (`Resume.userId` is unique). */
export async function getResume(userId: string): Promise<ResumeDTO | null> {
  const row = await prisma.resume.findUnique({
    where: { userId },
    select: { id: true, fileName: true, sizeBytes: true, uploadedAt: true },
  });
  return row ? toResumeDTO(row) : null;
}
