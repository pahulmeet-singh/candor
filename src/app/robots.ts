import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants/site";

/** Public pages may be indexed; the signed-in area and the API may not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/dashboard", "/interviews", "/feedback", "/resume", "/admin"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
