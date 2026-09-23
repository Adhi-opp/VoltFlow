import type { NextAuthConfig } from "next-auth";

/**
 * Edge-compatible auth config (no Prisma imports).
 * Used by middleware.ts to decode JWT and check roles at the edge.
 * The full auth.ts extends this with Credentials provider + Prisma callbacks.
 */
export const authConfig = {
  pages: { signIn: "/login" },
  providers: [], // Credentials provider added in auth.ts (needs Node.js for bcryptjs + Prisma)
  callbacks: {
    session({ session, token }) {
      if (session.user) {
        if (typeof token.id === "string") {
          session.user.id = token.id;
        }
        if (typeof token.role === "string") {
          session.user.role = token.role as "ADMIN" | "DEALER" | "HOMEOWNER";
        }
        if (typeof token.isActive === "boolean") {
          session.user.isActive = token.isActive;
        }
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
