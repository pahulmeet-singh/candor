import type { Metadata } from "next";
import { CategoryGrid } from "@/components/marketing/category-grid";
import { FinalCta } from "@/components/marketing/final-cta";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { ReportShowcase } from "@/components/marketing/report-showcase";
import { getPublicStats } from "@/lib/data/public-stats";

/**
 * Incremental Static Regeneration (ISR). The page is rendered once at build
 * time and served from the CDN; after 600 seconds the next visitor still gets
 * the cached copy while Next.js rebuilds a fresh one in the background. The
 * counter in the hero is also refreshed on demand, with `revalidateTag`,
 * the moment a new report is saved (see the evaluate Route Handler).
 */
export const revalidate = 600;

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default async function LandingPage() {
  const stats = await getPublicStats();

  return (
    <>
      <Hero stats={stats} />
      <HowItWorks />
      <ReportShowcase />
      <CategoryGrid />
      <FinalCta />
    </>
  );
}
