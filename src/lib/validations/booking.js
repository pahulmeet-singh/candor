import { z } from "zod";
import { CONSENT_REQUIRED_MESSAGE, INTERVIEW_MODES } from "@/lib/integrity/constants";
import { categorySchema, difficultySchema, idSchema } from "@/lib/validations/common";
import { isDateKey } from "@/lib/slots";

export const bookingSchema = z
  .object({
    category: categorySchema,
    difficulty: difficultySchema,
    /** An ISO-8601 instant. The service then checks it is a real, open slot. */
    scheduledAt: z.iso.datetime({ offset: true, message: "Choose a time slot" }).transform((value) => new Date(value)),
    /** Ask the AI to tailor questions to the saved résumé. */
    useResume: z.boolean().default(false),
    /** PRACTICE is private and is the default. ASSESSMENT turns on the camera and focus checks. */
    mode: z.enum(INTERVIEW_MODES).default("PRACTICE"),
    /** The candidate's agreement to those checks. Needed for ASSESSMENT, ignored for PRACTICE. */
    monitoringConsent: z.boolean().default(false),
  })
  .refine((booking) => booking.mode === "PRACTICE" || booking.monitoringConsent, {
    path: ["monitoringConsent"],
    message: CONSENT_REQUIRED_MESSAGE,
  });

export const slotsQuerySchema = z.object({
  date: z.string().refine(isDateKey, "Use the format YYYY-MM-DD"),
});

export const interviewIdParamSchema = z.object({ id: idSchema });

export const interviewListSchema = z.object({
  tab: z.enum(["upcoming", "past", "cancelled"]).catch("upcoming"),
  page: z.coerce.number().int().min(1).max(500).catch(1),
});
