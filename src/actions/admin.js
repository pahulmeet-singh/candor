"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action";
import { assertRole } from "@/lib/auth/session";
import { setUserRole } from "@/lib/services/admin";
import { setRoleSchema } from "@/lib/validations/admin";
import { formDataToObject, parseInput } from "@/lib/validations/common";

/**
 * Role changes. `assertRole` reads the caller's role from the database on every
 * call: a JWT can say "ADMIN" for days after someone was demoted, so it is
 * never trusted for a decision like this.
 */

export async function setRoleAction(_previous, formData) {
  return runAction("admin.setRole", async () => {
    const admin = await assertRole("ADMIN");
    const input = parseInput(setRoleSchema, formDataToObject(formData));
    const updated = await setUserRole(admin.id, input.userId, input.role);
    revalidatePath("/admin");
    return { data: updated, message: "Role updated." };
  });
}
