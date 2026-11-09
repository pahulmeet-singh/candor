"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { Select } from "@/components/ui/select";
import { CATEGORIES, type CategoryKey } from "@/lib/constants/categories";

export interface FeedbackFilterValues {
  category: CategoryKey | undefined;
  range: "all" | "30d" | "90d";
  sort: "recent" | "score_desc" | "score_asc";
}

const DEFAULTS = { category: "", range: "all", sort: "recent" } as const;

function Labelled({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="grid min-w-40 flex-1 gap-1.5 sm:flex-none">
      <label htmlFor={htmlFor} className="text-sm font-medium text-muted">
        {label}
      </label>
      {children}
    </div>
  );
}

/**
 * Filters for the reports list. It is a real GET form, so it works without
 * JavaScript (the Apply button is shown only then). With JavaScript, changing a
 * select submits the form and navigates softly, which keeps the page state and
 * puts the filters in the URL.
 */
export function FilterBar({ category, range, sort }: FeedbackFilterValues) {
  const router = useRouter();
  const active = category !== undefined || range !== "all" || sort !== "recent";

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    for (const key of ["category", "range", "sort"] as const) {
      const value = data.get(key);
      if (typeof value === "string" && value !== "" && value !== DEFAULTS[key]) params.set(key, value);
    }
    const query = params.toString();
    router.push(query ? `/feedback?${query}` : "/feedback");
  }

  const submitOnChange = (event: ChangeEvent<HTMLSelectElement>) => event.currentTarget.form?.requestSubmit();

  return (
    // Remounted when the URL changes, so the (uncontrolled) selects always show what the URL says.
    <form
      key={`${category ?? ""}|${range}|${sort}`}
      action="/feedback"
      method="get"
      onSubmit={apply}
      className="flex flex-wrap items-end gap-3"
    >
      <Labelled label="Topic" htmlFor="filter-category">
        <Select id="filter-category" name="category" defaultValue={category ?? ""} onChange={submitOnChange}>
          <option value="">All topics</option>
          {CATEGORIES.map((item) => (
            <option key={item.key} value={item.key}>
              {item.label}
            </option>
          ))}
        </Select>
      </Labelled>
      <Labelled label="Period" htmlFor="filter-range">
        <Select id="filter-range" name="range" defaultValue={range} onChange={submitOnChange}>
          <option value="all">All time</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
        </Select>
      </Labelled>
      <Labelled label="Order" htmlFor="filter-sort">
        <Select id="filter-sort" name="sort" defaultValue={sort} onChange={submitOnChange}>
          <option value="recent">Newest first</option>
          <option value="score_desc">Highest score</option>
          <option value="score_asc">Lowest score</option>
        </Select>
      </Labelled>
      <noscript>
        <button type="submit" className="h-10 rounded-lg border border-field px-4 text-sm">
          Apply
        </button>
      </noscript>
      {active ? (
        <Link href="/feedback" className="h-10 content-center text-sm font-medium text-primary underline-offset-4 hover:underline">
          Clear filters
        </Link>
      ) : null}
    </form>
  );
}
