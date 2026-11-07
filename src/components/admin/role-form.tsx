"use client";

import { useActionState } from "react";
import { toast } from "sonner";
import { setRoleAction } from "@/actions/admin";
import { SubmitButton } from "@/components/shared/submit-button";
import { Select } from "@/components/ui/select";
import type { ActionResult, Role } from "@/lib/types";

type State = ActionResult<{ id: string; role: Role }> | null;

/**
 * Change one user's role. A plain form posting to a Server Action: the action
 * re-checks that the caller is an admin in the database, so hiding this control
 * from other users is a convenience, not the security boundary.
 */
export function RoleForm({ userId, role, self, label }: { userId: string; role: Role; self: boolean; label: string }) {
  const [, formAction] = useActionState(async (previous: State, formData: FormData): Promise<State> => {
    const result = await setRoleAction(previous, formData);
    if (result.ok) toast.success(`${label} is now ${result.data.role === "ADMIN" ? "an admin" : "a regular user"}.`);
    else toast.error(result.error);
    return result;
  }, null);

  return (
    // Remounted when the saved role changes, so the (uncontrolled) select shows the new value.
    <form key={role} action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <Select
        name="role"
        defaultValue={role}
        disabled={self}
        aria-label={`Role for ${label}`}
        className="h-8 w-28 text-[0.8125rem]"
        title={self ? "You cannot change your own role" : undefined}
      >
        <option value="USER">User</option>
        <option value="ADMIN">Admin</option>
      </Select>
      <SubmitButton size="sm" variant="secondary" disabled={self} pendingText="Saving">
        Save
      </SubmitButton>
    </form>
  );
}
