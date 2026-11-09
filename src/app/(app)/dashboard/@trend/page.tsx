import { ChartLine } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { TrendChartLazy } from "@/components/shared/trend-chart-lazy";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { getTrend } from "@/lib/data/feedback";

/** Parallel route `@trend`: the score history. The chart itself is loaded lazily on the client. */
export default async function TrendSlot() {
  const user = await requireUser();
  const points = await getTrend(user.id);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Score over time</CardTitle>
        <CardDescription>
          {points.length > 1 ? "Hover, tap or tab to a point for the details." : "Each finished session adds a point."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {points.length === 0 ? (
          <EmptyState
            icon={ChartLine}
            title="No scores yet"
            action={
              <Link href="/interviews/new" className={buttonVariants({ size: "sm" })}>
                Book your first session
              </Link>
            }
          >
            Finish a session and your score appears here.
          </EmptyState>
        ) : (
          <TrendChartLazy points={points} />
        )}
      </CardContent>
    </Card>
  );
}
