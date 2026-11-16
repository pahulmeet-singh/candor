import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Page not found" };

/** Rendered for any unknown URL and whenever a page calls `notFound()`. */
export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-8">
      <Logo />
      <main id="main" className="flex flex-1 flex-col items-start justify-center gap-4 py-16">
        <p className="text-sm font-medium text-primary">Error 404</p>
        <h1 className="max-w-xl font-serif text-5xl leading-[1.05] font-semibold tracking-tight">
          We could not find that page.
        </h1>
        <p className="max-w-md text-muted">
          The link may be old, or the interview or report it pointed to is not on your account.
        </p>
        <div className="flex flex-wrap gap-3 pt-3">
          <Link href="/" className={buttonVariants()}>
            Back to the start
          </Link>
          <Link href="/dashboard" className={buttonVariants({ variant: "secondary" })}>
            Open my dashboard
          </Link>
        </div>
      </main>
    </div>
  );
}
