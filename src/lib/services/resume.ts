import "server-only";
import { toResumeDTO } from "@/lib/data/mappers";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { RESUME_MAX_BYTES } from "@/lib/constants/limits";
import { deleteResume, putResume, signedResumeUrl } from "@/lib/supabase/storage";
import type { ResumeDTO } from "@/lib/types";
import { checkResumeMeta, cleanFileName, hasPdfSignature } from "@/lib/validations/resume";

/**
 * Résumé handling. The PDF goes to a private Supabase Storage bucket; the
 * database keeps one small row per user that says where it is.
 */

const SELECT = { id: true, fileName: true, sizeBytes: true, uploadedAt: true } as const;

function invalid(message: string): AppError {
  return new AppError("FILE_INVALID", message, { fieldErrors: { file: [message] } });
}

/**
 * Validate -> store the object -> write the row -> remove the previous object.
 * That order means a failure at any step leaves the user with their old
 * résumé intact, and at worst an orphaned file we can delete later.
 */
export async function saveResume(userId: string, file: File): Promise<ResumeDTO> {
  const metaIssue = checkResumeMeta({ name: file.name, size: file.size, type: file.type });
  if (metaIssue) throw invalid(metaIssue.message);

  // The browser's MIME type is only a claim; the first bytes of the file are the evidence.
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length > RESUME_MAX_BYTES) throw invalid("That file is larger than 4 MB.");
  if (!hasPdfSignature(bytes)) throw invalid("That file does not look like a PDF.");

  const storagePath = `${userId}/${crypto.randomUUID()}.pdf`;
  await putResume(storagePath, bytes);

  const previous = await prisma.resume.findUnique({ where: { userId }, select: { storagePath: true } });

  const row = await prisma.resume
    .upsert({
      where: { userId },
      create: { userId, fileName: cleanFileName(file.name), storagePath, sizeBytes: bytes.length },
      update: { fileName: cleanFileName(file.name), storagePath, sizeBytes: bytes.length, uploadedAt: new Date() },
      select: SELECT,
    })
    .catch(async (error: unknown) => {
      // The row was not written, so the object we just stored is garbage.
      await deleteResume(storagePath).catch((cleanup: unknown) =>
        logger.warn("resume.cleanup_failed", { storagePath, error: cleanup }),
      );
      throw error;
    });

  if (previous && previous.storagePath !== storagePath) {
    await deleteResume(previous.storagePath).catch((cleanup: unknown) =>
      logger.warn("resume.old_object_left_behind", { storagePath: previous.storagePath, error: cleanup }),
    );
  }

  return toResumeDTO(row);
}

/** Deletes the row first (interviews that used it keep working, `resumeId` becomes null), then the object. */
export async function removeResume(userId: string): Promise<void> {
  const existing = await prisma.resume.findUnique({ where: { userId }, select: { id: true, storagePath: true } });
  if (!existing) throw new AppError("NOT_FOUND", "You have not uploaded a résumé.");

  await prisma.resume.delete({ where: { id: existing.id } });
  await deleteResume(existing.storagePath).catch((cleanup: unknown) =>
    logger.warn("resume.object_left_behind", { storagePath: existing.storagePath, error: cleanup }),
  );
}

/** A 60-second link, issued only after checking the résumé belongs to the caller. */
export async function createDownloadUrl(userId: string, resumeId: string): Promise<string> {
  const resume = await prisma.resume.findFirst({
    where: { id: resumeId, userId },
    select: { storagePath: true, fileName: true },
  });
  if (!resume) throw new AppError("NOT_FOUND", "We could not find that résumé.");
  return signedResumeUrl(resume.storagePath, resume.fileName);
}
