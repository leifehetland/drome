import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe auth config: no database or Node-only code here, so it can run in
 * middleware. The Credentials provider (which needs bcrypt + the DB) lives in
 * auth.ts and is spread on top of this.
 */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role ?? "member";
        token.customerId = (user as { customerId?: string | null }).customerId ?? null;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string }).role = (token.role as string) ?? "member";
        (session.user as { customerId?: string | null }).customerId =
          (token.customerId as string | null) ?? null;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const user = auth?.user as { role?: string } | undefined;
      const path = nextUrl.pathname;
      if (path.startsWith("/admin")) {
        return !!user && (user.role === "admin" || user.role === "staff");
      }
      if (path.startsWith("/account")) {
        return !!user;
      }
      return true;
    },
  },
  providers: [], // real providers added in auth.ts
} satisfies NextAuthConfig;
