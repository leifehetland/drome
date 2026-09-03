import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { db } from "./db";
import { appUsers } from "./db/schema";

const credsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const email = parsed.data.email.toLowerCase();

        const rows = await db
          .select()
          .from(appUsers)
          .where(eq(appUsers.email, email))
          .limit(1);
        const user = rows[0];
        if (!user) return null;

        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        return {
          id: String(user.id),
          email: user.email,
          name: user.name ?? user.email,
          role: user.role,
          customerId: user.customerId ?? null,
        };
      },
    }),
  ],
});
