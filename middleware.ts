// middleware.ts

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function isProtected(path: string) {
  return (
    path.startsWith("/tenant") ||
    path.startsWith("/manager") ||
    path.startsWith("/maintenance")
  );
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!isProtected(pathname)) {
    return NextResponse.next();
  }

  const sessionCookie = req.cookies.get("rf_session");

  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/property-code", req.url));
  }

  try {
    const session = JSON.parse(sessionCookie.value);

    if (!session?.role || !session?.propertyId) {
      return NextResponse.redirect(new URL("/property-code", req.url));
    }

    // Role-based protection
    if (pathname.startsWith("/tenant") && session.role !== "TENANT") {
      return NextResponse.redirect(new URL("/role-select", req.url));
    }

    if (pathname.startsWith("/manager") && session.role !== "MANAGER") {
      return NextResponse.redirect(new URL("/role-select", req.url));
    }

    if (
      pathname.startsWith("/maintenance") &&
      session.role !== "MAINTENANCE"
    ) {
      return NextResponse.redirect(new URL("/role-select", req.url));
    }

    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/property-code", req.url));
  }
}

export const config = {
  matcher: ["/tenant/:path*", "/manager/:path*", "/maintenance/:path*"],
};