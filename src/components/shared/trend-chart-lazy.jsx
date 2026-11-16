"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * `next/dynamic` splits the chart into its own JavaScript chunk, downloaded
 * after the dashboard has painted. `ssr: false` is allowed here because this
 * file is a Client Component; the skeleton keeps the layout from jumping.
 */
const TrendChart = dynamic(() => import("@/components/shared/trend-chart").then((module) => module.TrendChart), {
  ssr: false,
  loading: () => <Skeleton className="h-60 w-full" />,
});

export function TrendChartLazy(props) {
  return <TrendChart {...props} />;
}
