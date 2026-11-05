import type { Metadata } from "next";
import { CategoryGrid } from "@/components/marketing/category-grid";

export const metadata: Metadata = {
  title: "Interview categories",
  description:
    "Frontend, backend, data structures and algorithms, system design, behavioural and full-stack Next.js. Pick the round you are worried about.",
  alternates: { canonical: "/categories" },
};

/** Static: no data, no cookies, so it is built once and served from the CDN. */
export default function CategoriesPage() {
  return (
    <>
      <section className="mx-auto w-full max-w-6xl px-4 pt-14 sm:px-6">
        <h1 className="max-w-3xl font-serif text-4xl leading-[1.08] font-semibold tracking-tight sm:text-5xl">
          Pick the round you are worried about.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted">
          Each category has its own bank of questions at three levels. A session draws five of them, easiest first, so
          you warm up before the hard one.
        </p>
      </section>
      <CategoryGrid heading={false} />
    </>
  );
}
