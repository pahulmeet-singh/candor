import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  /** Change since the previous report. Shown with an icon and a sign, never by colour alone. */
  delta?: number | null;
}

export function StatCard({ label, value, hint, delta }: StatCardProps) {
  return (
    <Card className="p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 font-serif text-4xl leading-none font-semibold tracking-tight tabular-nums">{value}</p>
      <div className="mt-3 flex min-h-5 items-center gap-2 text-[0.8125rem]">
        {delta !== undefined && delta !== null ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 font-medium",
              delta > 0 ? "text-sage" : delta < 0 ? "text-coral" : "text-muted",
            )}
          >
            {delta > 0 ? (
              <TrendingUp className="size-3.5" aria-hidden="true" />
            ) : delta < 0 ? (
              <TrendingDown className="size-3.5" aria-hidden="true" />
            ) : (
              <Minus className="size-3.5" aria-hidden="true" />
            )}
            {delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : "No change"}
            <span className="font-normal text-muted"> since the last one</span>
          </span>
        ) : hint ? (
          <span className="text-muted">{hint}</span>
        ) : null}
      </div>
    </Card>
  );
}
