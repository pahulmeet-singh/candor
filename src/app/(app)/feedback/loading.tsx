import { Skeleton } from "@/components/ui/skeleton";

export default function FeedbackLoading() {
  return (
    <div aria-busy="true" aria-label="Loading reports">
      <div className="pb-7">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="mt-3 h-4 w-56" />
      </div>
      <div className="mb-5 flex gap-3">
        <Skeleton className="h-14 w-44" />
        <Skeleton className="h-14 w-44" />
        <Skeleton className="h-14 w-44" />
      </div>
      <div className="grid gap-px overflow-hidden rounded-xl border border-line">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-24 rounded-none" />
        ))}
      </div>
    </div>
  );
}
