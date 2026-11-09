import { Skeleton } from "@/components/ui/skeleton";

export default function TrendLoading() {
  return <Skeleton role="status" aria-label="Loading your score history" className="h-80" />;
}
