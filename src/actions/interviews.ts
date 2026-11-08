"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action";
import { assertUser } from "@/lib/auth/session";
import { assertWithinRate } from "@/lib/rate-limit";
import { bookInterview, cancelInterview } from "@/lib/services/booking";
import { saveAnswer } from "@/lib/services/session";
import type { ActionResult, InterviewDTO } from "@/lib/types";
import { bookingSchema, interviewIdParamSchema } from "@/lib/validations/booking";
import { parseInput } from "@/lib/validations/common";
import { saveAnswerSchema } from "@/lib/validations/session";

/**
 * Mutations the signed-in UI performs. A Server Action is a public POST
 * endpoint with a generated URL, so every one of them re-checks who is calling
 * (`assertUser`) and re-validates its input (`parseInput`) no matter what the
 * form on the page already did.
 */

export async function bookInterviewAction(input: unknown): Promise<ActionResult<InterviewDTO>> {
  return runAction("interview.book", async () => {
    const user = await assertUser();
    assertWithinRate(`book:${user.id}`, 10, 60_000);
    const parsed = parseInput(bookingSchema, input);
    const interview = await bookInterview(user.id, parsed);
    revalidatePath("/interviews");
    revalidatePath("/dashboard");
    return { data: interview, message: "Interview booked." };
  });
}

export async function cancelInterviewAction(id: string): Promise<ActionResult<InterviewDTO>> {
  return runAction("interview.cancel", async () => {
    const user = await assertUser();
    assertWithinRate(`cancel:${user.id}`, 20, 60_000);
    const { id: interviewId } = parseInput(interviewIdParamSchema, { id });
    const interview = await cancelInterview(user.id, interviewId);
    revalidatePath("/interviews");
    revalidatePath(`/interviews/${interviewId}`);
    revalidatePath("/dashboard");
    return { data: interview, message: "Booking cancelled." };
  });
}

/** Autosave from the interview room. No revalidation: the room holds its own state. */
export async function saveAnswerAction(input: unknown): Promise<ActionResult<{ savedAt: string }>> {
  return runAction("interview.saveAnswer", async () => {
    const user = await assertUser();
    assertWithinRate(`save:${user.id}`, 120, 60_000);
    const parsed = parseInput(saveAnswerSchema, input);
    const saved = await saveAnswer(user.id, parsed);
    return { data: saved };
  });
}
