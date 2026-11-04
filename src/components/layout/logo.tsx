import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The mark is a highlighter stroke behind a "C": the product in one picture.
 * It is inline SVG, so it costs no request and takes the page's colours.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--raised)" />
      <rect x="7" y="17" width="19" height="7" rx="1.5" fill="var(--primary)" fillOpacity="0.92" />
      <path
        d="M21.5 11.2a6.3 6.3 0 1 0 0 9.6"
        fill="none"
        stroke="var(--foreground)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      aria-label="Candor, home"
      className={cn("inline-flex items-center gap-2.5 rounded-md text-foreground", className)}
    >
      <LogoMark />
      <span className="font-serif text-xl font-semibold tracking-tight">Candor</span>
    </Link>
  );
}
