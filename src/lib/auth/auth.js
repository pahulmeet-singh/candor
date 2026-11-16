import "server-only";
import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { verifyPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { loginSchema } from "@/lib/validations/auth";

/**
 * Auth.js (NextAuth v5) configuration.
 *
 * - Sessions are JWTs stored in an HttpOnly cookie. Credentials sign-in cannot
 *   use database sessions, and a JWT keeps every page free of an extra query.
 * - The Prisma adapter stores users and linked Google accounts.
 * - The user's id and role are copied into the token on sign-in and exposed on
 *   `session.user`. The role in the token can be stale, so anything that
 *   matters (admin pages, role changes) re-reads it from the database.
 */

const providers = [
  Credentials({
    name: "Email and password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(raw) {
      const parsed = loginSchema.safeParse(raw);
      if (!parsed.success) return null;

      const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
      const valid = await verifyPassword(parsed.data.password, user?.passwordHash);
      if (!user || !valid) return null;

      const result = { id: user.id, name: user.name, email: user.email, image: user.image, role: user.role };
      return result;
    },
  }),
];

// The Google button only exists when both variables are configured.
if (env.googleAuthEnabled) providers.push(Google);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  pages: { signIn: "/login", error: "/login" },
  providers,
  // Needed when the app runs behind a proxy or under `next start` on a non-Vercel host.
  trustHost: true,
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role ?? "USER";
      }
      return token;
    },
    session({ session, token }) {
      const target = session.user;
      target.id = typeof token.id === "string" ? token.id : (token.sub ?? "");
      target.role = token.role === "ADMIN" ? "ADMIN" : "USER";
      return session;
    },
  },
});
