import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Edge middleware uses only the DB-free config.
export const { auth: middleware } = NextAuth(authConfig);

export default middleware((req) => {
  // `authorized` in auth.config decides access; nothing else needed here.
  void req;
});

export const config = {
  matcher: ["/admin/:path*", "/account/:path*"],
};
