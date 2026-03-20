// proxy.ts

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/property-code") ||
    pathname.startsWith("/role-select") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get("rf_session")?.value;

  if (!token) {
    return redirectToEntry(req);
  }

  return NextResponse.next();
}

function redirectToEntry(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = "/property-code";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};