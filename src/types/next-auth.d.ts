import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      role?: string;
      customerId?: string | null;
    } & DefaultSession["user"];
  }
  interface User {
    role?: string;
    customerId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    customerId?: string | null;
  }
}
