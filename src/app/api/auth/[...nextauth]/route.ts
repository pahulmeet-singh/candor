import { handlers } from "@/lib/auth/auth";

/** Auth.js owns everything under /api/auth: the session endpoint, CSRF token and the Google OAuth callback. */
export const { GET, POST } = handlers;
