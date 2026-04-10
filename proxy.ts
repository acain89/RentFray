// /proxy.ts

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "rf_session";

function isPublicRoute(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/setup" ||
    pathname.startsWith("/property-code") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/manager/login") ||
    pathname.startsWith("/tenant/login") ||
    pathname.startsWith("/login/manager") ||
    pathname.startsWith("/login/tenant") ||
    pathname.startsWith("/login/maintenance") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/request-illustration") ||
    pathname.startsWith("/role-select") ||
    pathname.startsWith("/api/setup") ||
    pathname.startsWith("/api/admin/session") ||
    pathname.startsWith("/api/admin/properties/list") ||
    pathname.startsWith("/api/admin/requests/list") ||
    pathname.startsWith("/api/request-setup") ||
    pathname.startsWith("/api/property/resolve") ||
    pathname.startsWith("/api/public/property/lookup") ||
    pathname.startsWith("/api/manager/session") ||
    pathname.startsWith("/api/tenant/session") ||
    pathname.startsWith("/api/tenant/activate") ||
    pathname.startsWith("/api/maintenance/session")
  );
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = req.cookies.get(SESSION_COOKIE)?.value;

  if (
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/api/stripe/webhook") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/icons")
  ) {
    return NextResponse.next();
  }

  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  if (!session) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = req.nextUrl.clone();
    url.pathname = "/property-code";
    url.search = "";

    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};