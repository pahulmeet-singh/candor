import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export function FinalCta() {
  return (
    <section aria-labelledby="cta-heading" className="mx-auto w-full max-w-6xl px-4 pt-8 sm:px-6">
      <div className="flex flex-col items-start justify-between gap-8 rounded-2xl border border-line-strong bg-raised px-7 py-10 sm:flex-row sm:items-center sm:px-12 sm:py-12">
        <div className="max-w-xl">
          <h2 id="cta-heading" className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
            Run through it once before it counts.
          </h2>
          <p className="mt-3 text-muted">
            A beginner round takes half an hour and shows you where your answers go quiet.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/register" className={buttonVariants({ size: "lg" })}>
            Create an account
          </Link>
          <Link href="/login" className={buttonVariants({ size: "lg", variant: "outline" })}>
            Sign in
          </Link>
        </div>
      </div>
    </section>
  );
}
