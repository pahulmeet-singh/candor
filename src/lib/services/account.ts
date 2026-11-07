import "server-only";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { isUniqueViolation } from "@/lib/prisma-errors";
import type { RegisterInput } from "@/lib/validations/auth";

/**
 * Creates a password account. The database's UNIQUE constraint on `User.email`
 * is the real guard against duplicates: checking first and inserting second would
 * let two simultaneous sign-ups both pass the check, so we insert and translate
 * the constraint violation (P2002) into a friendly error instead.
 *
 * Trade-off worth knowing: saying "that email is registered" makes it possible
 * to test whether an address has an account. Most products accept that for
 * sign-up; the login form, where it would matter more, gives one generic message.
 */
export async function registerUser(input: RegisterInput): Promise<{ id: string; email: string }> {
  const passwordHash = await hashPassword(input.password);
  try {
    const user = await prisma.user.create({
      data: { name: input.name, email: input.email, passwordHash },
      select: { id: true, email: true },
    });
    return user;
  } catch (error) {
    if (isUniqueViolation(error)) {
      const message = "An account with this email already exists. Try signing in.";
      throw new AppError("CONFLICT", message, { fieldErrors: { email: [message] }, cause: error });
    }
    throw error;
  }
}
