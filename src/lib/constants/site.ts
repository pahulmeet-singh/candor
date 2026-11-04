export const SITE = {
  name: "Candor",
  tagline: "Practice the interview. Hear the honest version of how it went.",
  description:
    "Candor is a mock interview platform. Book a slot, answer five questions in your own words, and get feedback that points at the exact sentences that worked and the ones that did not.",
  course: "INT257 · Modern Web Application Development",
} as const;

/** Public base URL, used for metadata, the sitemap and Open Graph tags. */
export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** Navigation that appears in the signed-in app shell. */
export const APP_NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/interviews", label: "Interviews", icon: "CalendarClock" },
  { href: "/feedback", label: "Feedback", icon: "MessageSquareText" },
  { href: "/resume", label: "Résumé", icon: "FileText" },
] as const;

/** Route prefixes that require a signed-in user (read by proxy.ts and the layouts). */
export const PROTECTED_PREFIXES = ["/dashboard", "/interviews", "/feedback", "/resume", "/admin"] as const;
