"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action";
import { assertUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { assertWithinRate } from "@/lib/rate-limit";
import { removeResume, saveResume } from "@/lib/services/resume";
import type { ActionResult, ResumeDTO } from "@/lib/types";

/**
 * Résumé upload. The browser posts the PDF to this Server Action as
 * multipart form data; the action checks it, streams it to a private Supabase
 * Storage bucket with the service-role key (which never leaves the server) and
 * records the object path in PostgreSQL through Prisma.
 */

export async function uploadResumeAction(
  _previous: ActionResult<ResumeDTO> | null,
  formData: FormData,
): Promise<ActionResult<ResumeDTO>> {
  return runAction("resume.upload", async () => {
    const user = await assertUser();
    assertWithinRate(`resume:${user.id}`, 6, 60_000);

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      const message = "Choose a PDF to upload.";
      throw new AppError("FILE_INVALID", message, { fieldErrors: { file: [message] } });
    }

    const resume = await saveResume(user.id, file);
    revalidatePath("/resume");
    revalidatePath("/interviews/new");
    return { data: resume, message: "Résumé saved." };
  });
}

export async function deleteResumeAction(): Promise<ActionResult<undefined>> {
  return runAction("resume.delete", async () => {
    const user = await assertUser();
    assertWithinRate(`resume:${user.id}`, 6, 60_000);
    await removeResume(user.id);
    revalidatePath("/resume");
    revalidatePath("/interviews/new");
    return { data: undefined, message: "Résumé removed." };
  });
}
