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

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/dealer/:path*", "/dashboard/:path*"],
};
