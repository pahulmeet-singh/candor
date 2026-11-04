import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { SITE } from "@/lib/constants/site";

const COLUMNS = [
  {
    title: "Explore",
    links: [
      { href: "/#how-it-works", label: "How it works" },
      { href: "/categories", label: "Interview categories" },
      { href: "/sample-report", label: "A sample report" },
    ],
  },
  {
    title: "Your account",
    links: [
      { href: "/register", label: "Create an account" },
      { href: "/login", label: "Sign in" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="grid content-start gap-3">
          <Logo />
          <p className="max-w-sm text-sm text-muted">
            Practice answering out loud in your own words, then read feedback that points at the sentences it is about.
          </p>
        </div>
        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title} className="grid content-start gap-2.5">
            <h2 className="text-sm font-semibold text-foreground">{column.title}</h2>
            {column.links.map((link) => (
              <Link key={link.href} href={link.href} className="text-sm text-muted transition-colors hover:text-foreground">
                {link.label}
              </Link>
            ))}
          </nav>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-5 text-[0.8125rem] text-faint sm:px-6">
          <p>Built for {SITE.course}.</p>
          <p>AI feedback can be wrong. Treat it as a second opinion, not a verdict.</p>
        </div>
      </div>
    </footer>
  );
}
