"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { TrendChartProps } from "@/components/shared/trend-chart";

/**
 * `next/dynamic` splits the chart into its own JavaScript chunk, downloaded
 * after the dashboard has painted. `ssr: false` is allowed here because this
 * file is a Client Component; the skeleton keeps the layout from jumping.
 */
const TrendChart = dynamic<TrendChartProps>(
  () => import("@/components/shared/trend-chart").then((module) => module.TrendChart),
  { ssr: false, loading: () => <Skeleton className="h-60 w-full" /> },
);

export function TrendChartLazy(props: TrendChartProps) {
  return <TrendChart {...props} />;
}
