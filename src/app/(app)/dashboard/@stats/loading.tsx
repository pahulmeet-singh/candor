import { Skeleton } from "@/components/ui/skeleton";

export default function StatsLoading() {
  return (
    <div role="status" aria-label="Loading your numbers" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-[7.75rem]" />
      ))}
    </div>
  );
}
