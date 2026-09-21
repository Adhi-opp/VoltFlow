import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const session = req.auth;
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!session?.user;
  const role = session?.user?.role;

  // NOTE: /login and /register must NOT be in the matcher below,
  // otherwise unauthenticated redirects would loop infinitely.

  // Let demo URLs reach the route layer without any edge auth redirect.
  if (req.nextUrl.searchParams.get("demo") === "true") {
    return NextResponse.next();
  }

  // /admin/* → ADMIN role only
  if (pathname.startsWith("/admin")) {
    if (!isLoggedIn || !role) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    if (role !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  // /dealer/* → DEALER or ADMIN only
  if (pathname.startsWith("/dealer")) {
    if (!isLoggedIn || !role) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    if (role !== "DEALER" && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  // /dashboard/* → any logged-in user; DEALER redirected to dealer dashboard
  if (pathname.startsWith("/dashboard")) {
    if (!isLoggedIn || !role) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    if (role === "DEALER") {
      return NextResponse.redirect(new URL("/dealer/dashboard", req.url));
    }
  }

  // NOTE: /calculator is intentionally PUBLIC and absent from the matcher.
  // It is the top of the acquisition funnel — anyone can compute a full BOM
  // without an account. The wall sits at *saving* an estimate or requesting
  // quotes, which createQuoteRequestAction enforces server-side.

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/dealer/:path*", "/dashboard/:path*"],
};
