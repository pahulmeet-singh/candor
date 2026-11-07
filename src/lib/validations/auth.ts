import { z } from "zod";
import { emailSchema } from "@/lib/validations/common";

/**
 * bcrypt only reads the first 72 BYTES of a password, so we cap there. A letter
 * outside English takes 2 to 4 bytes, which is why the length is checked in
 * bytes as well as characters: 25 Devanagari letters already pass 72 bytes.
 */
export const PASSWORD_MAX = 72;

const fitsBcrypt = (value: string): boolean => new TextEncoder().encode(value).length <= PASSWORD_MAX;
const TOO_LONG = `Use at most ${PASSWORD_MAX} bytes (letters outside English take 2 to 4 bytes each).`;

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(60, "Keep your name under 60 characters"),
  email: emailSchema,
  password: z
    .string()
    .min(8, "Use at least 8 characters")
    .max(PASSWORD_MAX, `Use at most ${PASSWORD_MAX} characters`)
    .regex(/[A-Za-z]/, "Include at least one letter")
    .regex(/\d/, "Include at least one number")
    .refine(fitsBcrypt, TOO_LONG),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password").max(PASSWORD_MAX, "Enter your password").refine(fitsBcrypt, "Enter your password"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Only same-site relative paths may be used as a post-login redirect.
 *
 * Browsers silently drop tabs and line breaks inside a URL, so "/\t/evil.example"
 * would become "//evil.example" on its way to the address bar. Control
 * characters and backslashes are therefore rejected along with "//".
 */
export function safeCallbackUrl(raw: string | null | undefined, fallback = "/dashboard"): string {
  if (!raw) return fallback;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\\]/.test(raw)) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  return raw;
}
