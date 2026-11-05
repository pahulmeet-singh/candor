import Link from "next/link";
import { CategoryIcon } from "@/components/shared/category-icon";
import { CATEGORIES } from "@/lib/constants/categories";

export function CategoryGrid({ heading = true }: { heading?: boolean }) {
  return (
    <section aria-labelledby="categories-heading" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
      {heading ? (
        <div className="max-w-2xl">
          <h2 id="categories-heading" className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
            Six categories, each with its own question bank.
          </h2>
          <p className="mt-4 text-lg text-muted">
            Pick the round you are worried about. Every category has beginner, intermediate and advanced questions.
          </p>
        </div>
      ) : (
        <h2 id="categories-heading" className="sr-only">
          Interview categories
        </h2>
      )}
      <ul className={`${heading ? "mt-10" : ""} grid gap-4 sm:grid-cols-2 lg:grid-cols-3`}>
        {CATEGORIES.map((category) => (
          <li key={category.key}>
            <Link
              href={`/categories/${category.slug}`}
              className="group flex h-full flex-col gap-3 rounded-xl border border-line bg-surface p-5 shadow-card transition-colors hover:border-line-strong hover:bg-raised"
            >
              <span className="inline-flex size-10 items-center justify-center rounded-lg bg-raised text-primary transition-colors group-hover:bg-raised-2">
                <CategoryIcon category={category.key} className="size-5" />
              </span>
              <h3 className="font-serif text-xl font-semibold tracking-tight">{category.label}</h3>
              <p className="text-sm text-muted">{category.short}</p>
              <p className="mt-auto pt-2 text-[0.8125rem] text-faint">{category.topics.length} topic areas</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
