import type { NextConfig } from "next";

/**
 * Security headers are applied to every response. The CSP is intentionally not
 * set here: Next injects inline scripts for hydration, and a nonce-based CSP is
 * best added in `proxy.ts` once the deployment target is fixed (see docs/DEPLOYMENT.md).
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Résumé PDFs are posted to a Server Action. The default limit is 1 MB;
    // the app caps files at 4 MB (Vercel's request body limit is 4.5 MB).
    serverActions: { bodySizeLimit: "5mb" },
  },
  deprecated: {
    looseRouteMatching: true,
  },
  images: {
    // Google profile pictures (only used when Google sign-in is configured).
    remotePatterns: [{ protocol: "https", hostname: "lh3.googleusercontent.com" }],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
