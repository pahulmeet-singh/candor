import { StatCard } from "@/components/dashboard/stat-card";
import { ReadinessBadge } from "@/components/shared/interview-meta";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { getUserStats } from "@/lib/data/feedback";
import { READINESS_META } from "@/lib/scoring";

/** Parallel route `@stats`: four numbers, fetched on their own. */
export default async function StatsSlot() {
  const user = await requireUser();
  const stats = await getUserStats(user.id);
  const none = stats.completed === 0;

  return (
    <section aria-label="Your numbers" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <StatCard
        label="Sessions completed"
        value={stats.completed}
        hint={stats.upcoming > 0 ? `${stats.upcoming} coming up` : "Nothing booked yet"}
      />
      <StatCard
        label="Average score"
        value={stats.average ?? "–"}
        hint={none ? "Appears after your first report" : stats.best !== null ? `Best so far: ${stats.best}` : undefined}
      />
      <StatCard
        label="Latest score"
        value={stats.latest ?? "–"}
        delta={stats.delta}
        hint={none ? "Appears after your first report" : "Your first report, so nothing to compare yet"}
      />
      <Card className="col-span-2 p-5 lg:col-span-1">
        <p className="text-sm text-muted">Where you stand</p>
        <div className="mt-3 flex min-h-10 items-center">
          {stats.readiness ? (
            <ReadinessBadge readiness={stats.readiness} />
          ) : (
            <span className="font-serif text-4xl leading-none font-semibold text-faint">–</span>
          )}
        </div>
        <p className="mt-3 text-[0.8125rem] text-muted">
          {stats.readiness ? READINESS_META[stats.readiness].blurb : "Based on your last three reports"}
        </p>
      </Card>
    </section>
  );
}
