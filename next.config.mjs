/**
 * Security headers are applied to every response. The CSP is intentionally not
 * set here: Next injects inline scripts for hydration, and a nonce-based CSP is
 * best added in `proxy.js` once the deployment target is fixed (see docs/DEPLOYMENT.md).
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

/**
 * The interview room is the one page that may ask for the camera, because an ASSESSMENT checks the
 * candidate's presence on their own device (see docs/INTEGRITY.md). Next.js applies every header rule
 * that matches a path, and when two set the same header the later rule wins, so this rule only has to
 * come after the global one. The microphone and location stay off everywhere.
 */
const interviewRoomHeaders = [{ key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" }];

/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Résumé PDFs are posted to a Server Action. The default limit is 1 MB;
    // the app caps files at 4 MB (Vercel's request body limit is 4.5 MB).
    serverActions: { bodySizeLimit: "5mb" },
  },
  images: {
    // Google profile pictures (only used when Google sign-in is configured).
    remotePatterns: [{ protocol: "https", hostname: "lh3.googleusercontent.com" }],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/interviews/:id/session", headers: interviewRoomHeaders },
    ];
  },
};

export default nextConfig;
