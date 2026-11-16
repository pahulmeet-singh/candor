import { z } from "zod";
import { idSchema } from "@/lib/validations/common";

export const setRoleSchema = z.object({
  userId: idSchema,
  role: z.enum(["USER", "ADMIN"], "Choose a role"),
});

/** Query-string state for /admin. Bad values fall back to defaults. */
export const adminUsersQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(80)
    .transform((value) => (value === "" ? undefined : value))
    .optional()
    .catch(undefined),
  page: z.coerce.number().int().min(1).max(500).catch(1),
});
