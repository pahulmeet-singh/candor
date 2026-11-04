import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, Newsreader } from "next/font/google";
import type { ReactNode } from "react";
import { WebVitals } from "@/components/shared/web-vitals";
import { Toaster } from "@/components/ui/toaster";
import { SITE, SITE_URL } from "@/lib/constants/site";
import "./globals.css";

/**
 * `next/font` downloads the fonts at build time and serves them from our own
 * domain, so there is no request to Google when a visitor opens the page and
 * no layout shift while they load. Each font becomes a CSS variable that
 * globals.css maps to `font-sans` and `font-serif`.
 */
const hanken = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-hanken", display: "swap" });
const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
  display: "swap",
});

const HEADLINE = `${SITE.name}: mock interviews with honest feedback`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: HEADLINE, template: `%s · ${SITE.name}` },
  description: SITE.description,
  applicationName: SITE.name,
  openGraph: {
    type: "website",
    siteName: SITE.name,
    title: HEADLINE,
    description: SITE.description,
    url: "/",
  },
  twitter: { card: "summary_large_image", title: HEADLINE, description: SITE.description },
};

export const viewport: Viewport = {
  themeColor: "#0a1d21",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${hanken.variable} ${newsreader.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        {children}
        <Toaster />
        <WebVitals />
      </body>
    </html>
  );
}
