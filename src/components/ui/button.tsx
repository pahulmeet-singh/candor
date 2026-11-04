import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * The button recipe lives in `buttonVariants` so a Next.js <Link> can look like
 * a button without nesting a <button> inside an <a>:
 *
 *   <Link href="/interviews/new" className={buttonVariants({ size: "lg" })}>Book</Link>
 */
export const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium select-none",
    "transition-[background-color,border-color,color,transform] duration-150 active:translate-y-px",
    "disabled:pointer-events-none disabled:opacity-50 aria-busy:cursor-progress",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-[0_1px_0_0_rgb(255_255_255/0.28)_inset] hover:bg-primary/90",
        secondary: "border border-line-strong bg-raised text-foreground hover:bg-raised-2",
        outline: "border border-field bg-transparent text-foreground hover:bg-raised",
        ghost: "text-muted hover:bg-raised hover:text-foreground",
        danger: "border border-coral/35 bg-coral/12 text-coral hover:bg-coral/20",
        link: "h-auto rounded-sm px-0 text-primary underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-[0.8125rem]",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-base",
        icon: "size-9",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Shows a spinner, disables the button and sets aria-busy. */
    loading?: boolean;
  };

export function Button({
  className,
  variant,
  size,
  loading = false,
  disabled,
  type = "button",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
