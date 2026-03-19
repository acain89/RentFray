// middleware.ts

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/session";

function getLoginPath(role?: string) {
  if (role === "MANAGER") return "/login/manager";
  if (role === "TENANT") return "/login/tenant";
  if (role === "MAINTENANCE") return "/login/maintenance";
  return "/property-code";
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public routes (no auth required)
  if (
    pathname.startsWith("/property-code") ||
    pathname.startsWith("/role-select") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth/session") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/public")
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get("rf_session")?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/property-code", req.url));
  }

  const session = verifySessionToken(token);

  if (!session) {
    const res = NextResponse.redirect(new URL("/property-code", req.url));
    res.cookies.set("rf_session", "", { path: "/", expires: new Date(0) });
    return res;
  }

  // Role-based route protection

  // MANAGER routes
  if (pathname.startsWith("/manager")) {
    if (session.role !== "MANAGER") {
      return NextResponse.redirect(new URL(getLoginPath(session.role), req.url));
    }
  }

  // TENANT routes
  if (pathname.startsWith("/tenant")) {
    if (session.role !== "TENANT") {
      return NextResponse.redirect(new URL(getLoginPath(session.role), req.url));
    }
  }

  // MAINTENANCE routes
  if (pathname.startsWith("/maintenance")) {
    if (session.role !== "MAINTENANCE") {
      return NextResponse.redirect(new URL(getLoginPath(session.role), req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
      Protect all routes except:
      - Next internals
      - static files
      - auth/public routes handled above
    */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};