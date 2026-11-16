import { NextResponse } from "next/server";
import { PROTECTED_PREFIXES } from "@/lib/constants/site";

/**
 * Next.js 16's `proxy.js` (the new name for `middleware.js`). It runs before a
 * request reaches a page, on the Node.js runtime, and does two cheap things:
 *
 *  1. Sends a visitor with no session cookie away from the signed-in area
 *     before any page code runs, remembering where they were going.
 *  2. Gives every request an id, so a log line from a Route Handler can be
 *     matched with the request that produced it.
 *
 * It is an *optimistic* check: it only looks for the cookie's presence and
 * cannot know whether the session is still valid. The real check is
 * `requireUser()` in the layouts and `assertUser()` in every action and
 * handler. Redirecting signed-in users away from /login is deliberately NOT
 * done here: a stale cookie would then loop between /login and /dashboard.
 */

/** Auth.js v5 cookie: `authjs.session-token`, `__Secure-` prefixed on HTTPS, `.0 .1 ...` when chunked. */
const SESSION_COOKIE = /^(__Secure-)?authjs\.session-token(\.\d+)?$/;

function isProtected(pathname) {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function proxy(request) {
  const { pathname, search } = request.nextUrl;

  if (isProtected(pathname) && !request.cookies.getAll().some((cookie) => SESSION_COOKIE.test(cookie.name))) {
    const login = new URL("/login", request.url);
    login.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }

  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const headers = new Headers(request.headers);
  headers.set("x-request-id", requestId);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = {
  // Everything except Next's static assets, the metadata files, and the face detector's WebAssembly
  // runtime (large static files that `postinstall` copies to public/mediapipe).
  matcher: ["/((?!_next/static|_next/image|mediapipe/|favicon.ico|icon.svg|robots.txt|sitemap.xml).*)"],
};
