"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cancelInterviewAction } from "@/actions/interviews";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";

/** Cancel button for the interview detail page. The list has its own optimistic version. */
export function CancelBooking({ interviewId }: { interviewId: string }) {
  const router = useRouter();

  return (
    <ConfirmDialog
      trigger={<Button variant="outline">Cancel booking</Button>}
      title="Cancel this booking?"
      description="The slot goes back to the pool for someone else. You can book another time whenever you like."
      confirmLabel="Cancel booking"
      onConfirm={async () => {
        const result = await cancelInterviewAction(interviewId);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success("Booking cancelled.");
        router.push("/interviews");
      }}
    />
  );
}
