import { CalendarPlus } from "lucide-react";
import Link from "next/link";
import { UpcomingList } from "@/components/dashboard/upcoming-list";
import { EmptyState } from "@/components/shared/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { getUpcomingInterviews } from "@/lib/data/interviews";

/** Parallel route `@upcoming`: the next few bookings. */
export default async function UpcomingSlot() {
  const user = await requireUser();
  const upcoming = await getUpcomingInterviews(user.id, 4);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Coming up</CardTitle>
        <Link href="/interviews" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          All interviews
        </Link>
      </CardHeader>
      <CardContent>
        {upcoming.length === 0 ? (
          <EmptyState
            icon={CalendarPlus}
            title="Nothing booked"
            action={
              <Link href="/interviews/new" className={buttonVariants({ size: "sm" })}>
                Pick a slot
              </Link>
            }
          >
            Slots run from 10 am to 6 pm IST, every half hour.
          </EmptyState>
        ) : (
          <UpcomingList interviews={upcoming} />
        )}
      </CardContent>
    </Card>
  );
}
