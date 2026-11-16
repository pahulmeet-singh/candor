import { Skeleton } from "@/components/ui/skeleton";

/** Shown inside the app shell while any signed-in page below it is loading. */
export default function AppLoading() {
  return (
    <div role="status" aria-label="Loading" className="grid gap-6">
      <div className="grid gap-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-full max-w-96" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
