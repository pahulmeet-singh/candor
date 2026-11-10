import type { MetadataRoute } from "next";
import { CATEGORIES } from "@/lib/constants/categories";
import { SITE_URL } from "@/lib/constants/site";

/** Built once at build time: every public URL is known in advance (see `generateStaticParams`). */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/categories", "/sample-report", "/login", "/register"];
  const categories = CATEGORIES.map((category) => `/categories/${category.slug}`);
  return [...pages, ...categories].map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : path.startsWith("/categories/") ? 0.7 : 0.5,
  }));
}
