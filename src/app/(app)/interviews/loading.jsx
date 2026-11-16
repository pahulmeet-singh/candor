import { Skeleton } from "@/components/ui/skeleton";

export default function InterviewsLoading() {
  return (
    <div aria-busy="true" aria-label="Loading interviews">
      <div className="pb-7">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="mt-3 h-4 w-72" />
      </div>
      <Skeleton className="mb-5 h-10 w-full max-w-80" />
      <div className="grid gap-px overflow-hidden rounded-xl border border-line">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-[4.5rem] rounded-none" />
        ))}
      </div>
    </div>
  );
}
