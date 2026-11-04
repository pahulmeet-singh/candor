"use client";

import { useReportWebVitals } from "next/web-vitals";

/**
 * Sends Core Web Vitals (LCP, INP, CLS, FCP, TTFB) to `/api/vitals`, which
 * turns each one into a structured log line. Production only: in development
 * the numbers measure the dev server, not the product.
 */
export function WebVitals() {
  useReportWebVitals((metric) => {
    if (process.env.NODE_ENV !== "production") return;
    const body = JSON.stringify({
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      path: window.location.pathname,
    });
    if (typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon("/api/vitals", new Blob([body], { type: "application/json" }));
    } else {
      void fetch("/api/vitals", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } });
    }
  });
  return null;
}
