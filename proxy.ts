import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth/constants";

/**
 * Route-level auth gate. Only checks cookie *presence* (edge-safe; SQLite can't run here).
 * Actual session validity is verified by resolveCurrentUser() in server components and route
 * handlers. Public paths — the root, /login/**, /sign-up/**, and /api/auth/** — are always
 * allowed through. The root itself decides anonymous-vs-authed rendering (see
 * `lib/auth/root-route.ts`); every other path here still requires a session cookie.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/sign-up") ||
    pathname.startsWith("/api/auth/")
  ) {
    return NextResponse.next();
  }

  if (!request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt)|serwist).*)",
  ],
};
