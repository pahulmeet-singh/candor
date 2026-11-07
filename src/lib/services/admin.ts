import "server-only";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { isSerializationFailure } from "@/lib/prisma-errors";
import type { Role } from "@/lib/types";

/**
 * Changes a user's role. Two rules protect the platform from locking itself out:
 *  - you cannot change your own role, and
 *  - the last remaining admin can never be demoted.
 * The second rule is a count followed by a write, so it runs in a SERIALIZABLE
 * transaction; two admins demoting each other at the same instant cannot both succeed.
 */
export async function setUserRole(actorId: string, targetId: string, role: Role): Promise<{ id: string; role: Role }> {
  if (actorId === targetId) {
    throw new AppError("FORBIDDEN", "You cannot change your own role. Ask another admin.");
  }

  try {
    return await prisma.$transaction(
      async (tx) => {
        const target = await tx.user.findUnique({ where: { id: targetId }, select: { id: true, role: true } });
        if (!target) throw new AppError("NOT_FOUND", "We could not find that user.");
        if (target.role === role) return { id: target.id, role };

        if (role === "USER") {
          const otherAdmins = await tx.user.count({ where: { role: "ADMIN", id: { not: targetId } } });
          if (otherAdmins === 0) throw new AppError("INVALID_STATE", "There must be at least one admin.");
        }

        const updated = await tx.user.update({ where: { id: targetId }, data: { role }, select: { id: true, role: true } });
        logger.info("admin.role_changed", { actorId, targetId, role });
        return { id: updated.id, role: updated.role as Role };
      },
      { isolationLevel: "Serializable", maxWait: 5_000, timeout: 10_000 },
    );
  } catch (error) {
    if (isSerializationFailure(error)) {
      throw new AppError("CONFLICT", "Another admin change was in progress. Please try again.", { cause: error });
    }
    throw error;
  }
}
