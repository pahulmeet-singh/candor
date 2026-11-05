import { Check, ChevronDown } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CategoryIcon } from "@/components/shared/category-icon";
import { DifficultyBadge } from "@/components/shared/interview-meta";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CATEGORIES, getCategoryBySlug } from "@/lib/constants/categories";
import { DIFFICULTIES, DIFFICULTY_META } from "@/lib/constants/difficulty";
import { QUESTION_BANK } from "@/lib/constants/question-bank";
import { SITE_URL } from "@/lib/constants/site";

/**
 * Static Site Generation with dynamic segments. `generateStaticParams` tells
 * Next.js every slug at build time, so each category page is rendered once to
 * plain HTML. `dynamicParams = false` makes any other slug a 404 instead of
 * rendering it on demand.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return CATEGORIES.map((category) => ({ slug: category.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = getCategoryBySlug(slug);
  if (!category) return {};
  return {
    title: `${category.label} mock interview`,
    description: `${category.short} ${category.description}`,
    alternates: { canonical: `/categories/${category.slug}` },
  };
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const category = getCategoryBySlug(slug);
  if (!category) notFound();

  // One example per level, taken from the real question bank.
  const examples = DIFFICULTIES.map((difficulty) => QUESTION_BANK[category.key].find((q) => q.difficulty === difficulty)).filter(
    (question) => question !== undefined,
  );

  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Candor", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Categories", item: `${SITE_URL}/categories` },
      { "@type": "ListItem", position: 3, name: category.label, item: `${SITE_URL}/categories/${category.slug}` },
    ],
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-10 pb-6 sm:px-6">
      <script
        type="application/ld+json"
        // Escaping "<" keeps the JSON from ever closing the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs).replace(/</g, "\\u003c") }}
      />

      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/categories" className="hover:text-foreground">
          Categories
        </Link>
        <span aria-hidden="true" className="px-2 text-faint">
          /
        </span>
        <span className="text-foreground">{category.label}</span>
      </nav>

      <header className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start">
        <span className="inline-flex size-14 shrink-0 items-center justify-center rounded-xl bg-raised text-primary">
          <CategoryIcon category={category.key} className="size-7" />
        </span>
        <div>
          <h1 className="font-serif text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">{category.label}</h1>
          <p className="mt-3 max-w-2xl text-lg text-muted">{category.description}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={`/interviews/new?category=${category.key}`} className={buttonVariants({ size: "lg" })}>
              Book a {category.label} interview
            </Link>
            <Link href="/sample-report" className={buttonVariants({ size: "lg", variant: "secondary" })}>
              See a sample report
            </Link>
          </div>
        </div>
      </header>

      <div className="mt-14 grid gap-10 md:grid-cols-2">
        <section aria-labelledby="topics-heading">
          <h2 id="topics-heading" className="font-serif text-2xl font-semibold tracking-tight">
            What gets asked
          </h2>
          <ul className="mt-4 grid gap-2.5">
            {category.topics.map((topic) => (
              <li key={topic} className="flex gap-3">
                <Check className="mt-1 size-4 shrink-0 text-sage" aria-hidden="true" />
                <span className="text-muted">{topic}</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="levels-heading">
          <h2 id="levels-heading" className="font-serif text-2xl font-semibold tracking-tight">
            Choose your level
          </h2>
          <dl className="mt-4 grid gap-4">
            {DIFFICULTIES.map((difficulty) => (
              <div key={difficulty} className="border-l-2 border-line-strong pl-4">
                <dt className="font-medium">{DIFFICULTY_META[difficulty].label}</dt>
                <dd className="mt-0.5 text-sm text-muted">{DIFFICULTY_META[difficulty].blurb}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <section aria-labelledby="examples-heading" className="mt-14">
        <h2 id="examples-heading" className="font-serif text-2xl font-semibold tracking-tight">
          Example questions
        </h2>
        <p className="mt-2 max-w-2xl text-muted">One from each level, taken from the real question bank.</p>
        <div className="mt-6 grid gap-4">
          {examples.map((question) => (
            <Card key={question.id} className="p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2.5">
                <DifficultyBadge difficulty={question.difficulty} />
                <span className="text-sm text-muted">{question.topic}</span>
              </div>
              <p className="prose-reading mt-3 font-medium">{question.text}</p>
              <details className="group mt-4 rounded-lg border border-line bg-raised/40">
                <summary className="flex items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm font-medium select-none marker:content-none [&::-webkit-details-marker]:hidden">
                  What a strong answer covers
                  <ChevronDown className="size-4 text-muted transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <ul className="grid gap-2 border-t border-line px-4 py-4 text-sm text-muted">
                  {question.rubric.map((point) => (
                    <li key={point.label} className="flex gap-2.5">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                      {point.label}
                    </li>
                  ))}
                </ul>
              </details>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
