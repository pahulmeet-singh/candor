import { TriangleAlert, CircleCheck, Info, CircleX } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TONES = {
  info: { icon: Info, box: "border-sky/30 bg-sky/8", accent: "text-sky" },
  success: { icon: CircleCheck, box: "border-sage/30 bg-sage/8", accent: "text-sage" },
  warning: { icon: TriangleAlert, box: "border-primary/30 bg-primary/8", accent: "text-primary" },
  danger: { icon: CircleX, box: "border-coral/35 bg-coral/8", accent: "text-coral" },
} as const;

export type AlertTone = keyof typeof TONES;

interface AlertProps {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
  className?: string;
}

/** Errors use role="alert" (announced immediately); everything else is a polite status. */
export function Alert({ tone = "info", title, children, className }: AlertProps) {
  const { icon: Icon, box, accent } = TONES[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex gap-3 rounded-xl border p-4 text-sm", box, className)}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", accent)} aria-hidden="true" />
      <div className="grid gap-1">
        {title ? <p className="font-medium text-foreground">{title}</p> : null}
        {children ? <div className="text-muted">{children}</div> : null}
      </div>
    </div>
  );
}
