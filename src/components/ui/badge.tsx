import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3",
  {
    variants: {
      tone: {
        neutral: "border-line bg-raised text-muted",
        primary: "border-primary/30 bg-primary/12 text-primary",
        success: "border-sage/30 bg-sage/12 text-sage",
        danger: "border-coral/30 bg-coral/12 text-coral",
        info: "border-sky/30 bg-sky/12 text-sky",
        outline: "border-line-strong bg-transparent text-muted",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

export function Badge({ className, tone, ...props }: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
